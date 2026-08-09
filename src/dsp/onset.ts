import { Fft, hannWindow } from './fft';
import { peak, rms } from './level';

/**
 * Onset detection: finding the moment each strum happens.
 *
 * Two stages, because the two hard parts are different problems.
 *
 * **Deciding that a strum happened** uses spectral flux — the frame-to-frame
 * rise in energy across the whole spectrum. A strum is a broadband transient:
 * dozens of partials start at once. That is the easy case for spectral flux and
 * a hard case for a plain amplitude threshold, which cannot tell a new strum
 * from the still-ringing tail of the previous one — and a learner strumming
 * over a chord that has not died away is the normal case, not the exception.
 *
 * **Deciding exactly when it happened** cannot come from the flux frame. A
 * 2048-sample window is 46 ms long, and the frame whose flux peaks depends on
 * where the transient sits under the Hann window, which would bias every
 * measurement by tens of milliseconds — fatal when the tolerance being reported
 * is ±50 ms. So each coarse detection is refined against the local amplitude
 * envelope at ~0.7 ms resolution.
 *
 * Pure functions over `Float32Array`, so accuracy is measured in CI against
 * signals whose onset times are known exactly.
 */

export type OnsetOptions = {
  sampleRate: number;
  /** Transform size. 2048 at 44.1 kHz is ~46 ms — enough resolution, still sharp. */
  frameSize?: number;
  /** Hop between frames. 512 gives ~11.6 ms of scanning resolution. */
  hopSize?: number;
  /**
   * How far above the local median the flux must rise to count, as a multiple
   * of the median. Adaptive rather than absolute so a quietly strummed ukulele
   * and a loud one need the same setting.
   */
  thresholdRatio?: number;
  /** Half-width of the median window, in frames. */
  medianWindow?: number;
  /**
   * Minimum gap between onsets. A single strum spreads its strings over ~12 ms
   * and can otherwise register several times; 60 ms is shorter than any
   * playable subdivision but long enough to fuse one stroke into one onset.
   */
  minimumSeparationSeconds?: number;
  /** Frames quieter than this are ignored outright. */
  silenceThreshold?: number;
  /**
   * Threshold floor, as a fraction of this take's strong-frame level. Guards
   * against false onsets in the decaying tail of a ringing chord, where the
   * local median collapses towards zero.
   */
  floorRatio?: number;
};

export type Onset = {
  /** Seconds from the start of the recording. */
  time: number;
  /** Flux value at the peak — how sharp the attack was. */
  strength: number;
  /** Peak amplitude just after the onset, used for the dynamics score. */
  peakAmplitude: number;
};

export type OnsetDetectionResult = {
  onsets: Onset[];
  /** The flux curve, for drawing a waveform with the detections marked. */
  flux: Float32Array;
  /** Seconds per flux frame. */
  frameSeconds: number;
};

const DEFAULTS = {
  frameSize: 2048,
  hopSize: 512,
  thresholdRatio: 1.6,
  medianWindow: 8,
  minimumSeparationSeconds: 0.06,
  silenceThreshold: 0.004,
  floorRatio: 0.15,
} as const;

/** Envelope resolution used when refining an onset's time. */
const ENVELOPE_BLOCK = 64;
const ENVELOPE_HOP = 32;

export function detectOnsets(
  samples: Float32Array,
  options: OnsetOptions,
): OnsetDetectionResult {
  const {
    sampleRate,
    frameSize = DEFAULTS.frameSize,
    hopSize = DEFAULTS.hopSize,
    thresholdRatio = DEFAULTS.thresholdRatio,
    medianWindow = DEFAULTS.medianWindow,
    minimumSeparationSeconds = DEFAULTS.minimumSeparationSeconds,
    silenceThreshold = DEFAULTS.silenceThreshold,
    floorRatio = DEFAULTS.floorRatio,
  } = options;

  const frameSeconds = hopSize / sampleRate;
  const frameCount = Math.max(0, Math.floor((samples.length - frameSize) / hopSize) + 1);

  if (frameCount < 3) {
    return { onsets: [], flux: new Float32Array(0), frameSeconds };
  }

  const flux = computeSpectralFlux(samples, frameSize, hopSize, frameCount);
  const threshold = adaptiveThreshold(flux, medianWindow, thresholdRatio, floorRatio);

  const amplitudeWindow = Math.round(0.05 * sampleRate);
  const minimumSeparation = minimumSeparationSeconds;
  const onsets: Onset[] = [];

  for (let frame = 1; frame < flux.length - 1; frame += 1) {
    const value = flux[frame]!;
    if (value <= threshold[frame]!) continue;
    if (value < flux[frame - 1]! || value < flux[frame + 1]!) continue; // local maximum

    const refinedSample = refineOnsetSample(samples, frame * hopSize, frameSize, hopSize);
    const time = refinedSample / sampleRate;

    const amplitude = peak(samples, refinedSample, amplitudeWindow);
    if (amplitude < silenceThreshold) continue;

    const previous = onsets[onsets.length - 1];
    if (previous && time - previous.time < minimumSeparation) {
      // Two detections inside one stroke: keep the stronger of the pair.
      if (value > previous.strength) {
        previous.time = time;
        previous.strength = value;
        previous.peakAmplitude = amplitude;
      }
      continue;
    }

    onsets.push({ time, strength: value, peakAmplitude: amplitude });
  }

  return { onsets, flux, frameSeconds };
}

/**
 * Frame-to-frame increase in magnitude, summed over all bins.
 *
 * Only *rises* are counted. Energy falling away is a note decaying, which is
 * not an event; counting it would put a phantom onset at the end of every note.
 */
function computeSpectralFlux(
  samples: Float32Array,
  frameSize: number,
  hopSize: number,
  frameCount: number,
): Float32Array {
  const fft = new Fft(frameSize);
  const window = hannWindow(frameSize);
  const bins = frameSize / 2 + 1;

  const windowed = new Float32Array(frameSize);
  const real = new Float64Array(frameSize);
  const imag = new Float64Array(frameSize);
  let previous = new Float32Array(bins);
  let current = new Float32Array(bins);

  const flux = new Float32Array(frameCount);

  for (let frame = 0; frame < frameCount; frame += 1) {
    const start = frame * hopSize;
    for (let i = 0; i < frameSize; i += 1) {
      windowed[i] = (samples[start + i] ?? 0) * window[i]!;
    }

    fft.magnitudes(windowed, current, real, imag);

    if (frame > 0) {
      let sum = 0;
      for (let bin = 0; bin < bins; bin += 1) {
        const rise = current[bin]! - previous[bin]!;
        if (rise > 0) sum += rise;
      }
      flux[frame] = sum;
    }

    const swap = previous;
    previous = current;
    current = swap;
  }

  return flux;
}

/**
 * A running median of the flux, scaled up, with a floor under it.
 *
 * The local median adapts to how loudly the learner plays and how close the
 * phone is — a fixed threshold could not do that. But on its own it produces
 * false onsets in the tail of a ringing chord: as the note decays the local
 * median collapses towards zero, so a ripple a hundredth the size of a real
 * strum still clears `median × ratio`.
 *
 * The floor fixes that. It is set relative to how strong this recording's real
 * strums are — the mean of the loudest tenth of frames — rather than to any
 * absolute value, so it scales with the take and a quiet performance is
 * analysed exactly as reliably as a loud one. Averaging the top tenth rather
 * than taking the maximum keeps one cough or a dropped instrument from raising
 * the floor above the actual playing.
 */
function adaptiveThreshold(
  flux: Float32Array,
  halfWindow: number,
  ratio: number,
  floorRatio: number,
): Float32Array {
  const threshold = new Float32Array(flux.length);
  const floor = strongFrameLevel(flux) * floorRatio;
  const scratch: number[] = [];

  for (let i = 0; i < flux.length; i += 1) {
    const from = Math.max(0, i - halfWindow);
    const to = Math.min(flux.length - 1, i + halfWindow);

    scratch.length = 0;
    for (let j = from; j <= to; j += 1) scratch.push(flux[j]!);
    scratch.sort((a, b) => a - b);

    const middle = Math.floor(scratch.length / 2);
    const median =
      scratch.length % 2 === 1
        ? scratch[middle]!
        : (scratch[middle - 1]! + scratch[middle]!) / 2;

    threshold[i] = Math.max(median * ratio, floor);
  }

  return threshold;
}

/** Mean of the loudest tenth of frames — this take's idea of "a real strum". */
function strongFrameLevel(flux: Float32Array): number {
  if (flux.length === 0) return 0;

  const sorted = Array.from(flux).sort((a, b) => b - a);
  const count = Math.max(1, Math.round(sorted.length * 0.1));

  let sum = 0;
  for (let i = 0; i < count; i += 1) sum += sorted[i]!;
  return sum / count;
}

/**
 * Pins an onset to the moment the amplitude actually starts rising.
 *
 * Finds the steepest rise in the local energy envelope rather than a threshold
 * crossing, because the level before a strum is not silence — the previous
 * chord is usually still ringing — and any absolute threshold would trigger
 * early or late depending on how loud that tail happens to be. A slope is
 * indifferent to the floor it starts from.
 */
function refineOnsetSample(
  samples: Float32Array,
  frameStart: number,
  frameSize: number,
  hopSize: number,
): number {
  // Where to look, and why it is not centred on the frame.
  //
  // A transient at sample T sits at position `T - frameStart` under the Hann
  // window. Its contribution grows as that position falls from `frameSize`
  // towards the window's centre, so the *rise* — which is what flux measures —
  // is largest while the transient is roughly three quarters of the way into
  // the window. The onset therefore lies ahead of the frame start, not around
  // it. Searching symmetrically finds the previous strum instead once the
  // tempo passes about eight notes a second.
  const from = Math.max(0, frameStart + frameSize / 4);
  const to = Math.min(samples.length - ENVELOPE_BLOCK, frameStart + frameSize + hopSize);
  if (to <= from) return frameStart;

  let bestSlope = -Infinity;
  let bestIndex = frameStart;
  let previousEnergy = rms(samples, from, ENVELOPE_BLOCK);

  for (let i = from + ENVELOPE_HOP; i <= to; i += ENVELOPE_HOP) {
    const energy = rms(samples, i, ENVELOPE_BLOCK);
    const slope = energy - previousEnergy;

    if (slope > bestSlope) {
      bestSlope = slope;
      // The rise is measured between the previous block and this one, so the
      // attack begins at the earlier of the two.
      bestIndex = i - ENVELOPE_HOP;
    }

    previousEnergy = energy;
  }

  return bestIndex;
}
