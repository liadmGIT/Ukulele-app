import { rms } from './level';

/**
 * Monophonic pitch detection using the YIN algorithm.
 *
 * YIN rather than a bare FFT peak because a plucked ukulele string is rich in
 * harmonics, and the loudest partial is frequently *not* the fundamental — an
 * FFT-peak tuner reports the wrong octave on exactly the notes a beginner needs
 * most help with. YIN's cumulative-mean normalisation is specifically what
 * suppresses that octave error.
 *
 * Pure functions over `Float32Array`: no audio graph, no React, no native
 * calls, so accuracy is proved in CI against synthetic signals rather than by
 * ear on a device.
 */

export type PitchDetectorOptions = {
  sampleRate: number;
  /** Lowest frequency to look for. Below the ukulele's open C leaves headroom. */
  minFrequency?: number;
  /** Highest frequency to look for. */
  maxFrequency?: number;
  /**
   * YIN's absolute threshold. Lower is stricter: fewer readings, but the ones
   * that come back are more trustworthy. 0.15 is the value from the paper.
   */
  threshold?: number;
  /** Frames quieter than this RMS are reported as silence rather than guessed at. */
  silenceThreshold?: number;
};

export type PitchResult = {
  /** Detected frequency in Hz, or null when the frame has no discernible pitch. */
  frequency: number | null;
  /** 0..1 — how periodic the frame is. Below ~0.8 the reading is doubtful. */
  clarity: number;
  /** RMS amplitude of the analysed frame. */
  level: number;
};

const DEFAULTS = {
  // The lowest note on a re-entrant ukulele is the open C at 261.6 Hz; going
  // down to 150 Hz leaves room for a badly flat string without wasting work.
  minFrequency: 150,
  // 15th fret on the A string is roughly 1046 Hz; 1400 covers it with headroom.
  maxFrequency: 1400,
  threshold: 0.15,
  silenceThreshold: 0.005,
} as const;

export class PitchDetector {
  private readonly sampleRate: number;
  private readonly minTau: number;
  private readonly maxTau: number;
  private readonly threshold: number;
  private readonly silenceThreshold: number;
  private readonly buffer: Float32Array;

  constructor(options: PitchDetectorOptions) {
    const {
      sampleRate,
      minFrequency = DEFAULTS.minFrequency,
      maxFrequency = DEFAULTS.maxFrequency,
      threshold = DEFAULTS.threshold,
      silenceThreshold = DEFAULTS.silenceThreshold,
    } = options;

    this.sampleRate = sampleRate;
    this.threshold = threshold;
    this.silenceThreshold = silenceThreshold;
    this.minTau = Math.max(2, Math.floor(sampleRate / maxFrequency));
    this.maxTau = Math.ceil(sampleRate / minFrequency);
    // Reused across calls so a running tuner allocates nothing per frame.
    this.buffer = new Float32Array(this.maxTau + 1);
  }

  /**
   * Analyses one frame. The frame must be at least twice `maxTau` long — about
   * 600 samples at 44.1 kHz for the defaults — or there is not enough signal to
   * compare a period against itself.
   */
  detect(samples: Float32Array): PitchResult {
    const level = rms(samples);
    if (level < this.silenceThreshold) {
      return { frequency: null, clarity: 0, level };
    }

    const maxTau = Math.min(this.maxTau, Math.floor(samples.length / 2));
    if (maxTau <= this.minTau) {
      return { frequency: null, clarity: 0, level };
    }

    const cmnd = this.cumulativeMeanNormalisedDifference(samples, maxTau);
    const tau = this.absoluteThreshold(cmnd, maxTau);

    if (tau === -1) {
      return { frequency: null, clarity: 0, level };
    }

    const refined = parabolicInterpolation(cmnd, tau);
    const clarity = 1 - Math.min(1, Math.max(0, cmnd[tau]!));

    return { frequency: this.sampleRate / refined, clarity, level };
  }

  /**
   * Steps 1-3 of YIN: squared difference, cumulative mean, normalisation.
   *
   * The normalisation is the important part — it divides each lag's difference
   * by the running mean of all shorter lags, which pushes the value at twice the
   * true period back up and stops the detector from locking onto a sub-harmonic.
   */
  private cumulativeMeanNormalisedDifference(samples: Float32Array, maxTau: number): Float32Array {
    const cmnd = this.buffer;
    const window = Math.min(samples.length - maxTau, maxTau);

    cmnd[0] = 1;
    let runningSum = 0;

    for (let tau = 1; tau <= maxTau; tau += 1) {
      let difference = 0;
      for (let i = 0; i < window; i += 1) {
        const delta = samples[i]! - samples[i + tau]!;
        difference += delta * delta;
      }

      runningSum += difference;
      cmnd[tau] = runningSum === 0 ? 1 : (difference * tau) / runningSum;
    }

    return cmnd;
  }

  /**
   * Step 4: the first lag that dips below the threshold and has settled at its
   * local minimum. Taking the *first* such dip rather than the global minimum is
   * what keeps the detector on the fundamental instead of an octave above.
   */
  private absoluteThreshold(cmnd: Float32Array, maxTau: number): number {
    for (let tau = this.minTau; tau <= maxTau; tau += 1) {
      if (cmnd[tau]! >= this.threshold) continue;

      let best = tau;
      while (best + 1 <= maxTau && cmnd[best + 1]! < cmnd[best]!) {
        best += 1;
      }
      return best;
    }
    return -1;
  }
}

/**
 * Step 5: fit a parabola through the minimum and its neighbours to recover
 * sub-sample precision.
 *
 * Without this the tuner quantises badly — at 44.1 kHz, one whole sample of
 * period error near the open A string is already about 4 cents, which is
 * visible on a needle.
 */
export function parabolicInterpolation(cmnd: Float32Array, tau: number): number {
  const previous = tau > 0 ? cmnd[tau - 1]! : cmnd[tau]!;
  const current = cmnd[tau]!;
  const next = tau + 1 < cmnd.length ? cmnd[tau + 1]! : cmnd[tau]!;

  const denominator = 2 * (2 * current - next - previous);
  if (denominator === 0) return tau;

  const adjustment = (next - previous) / denominator;
  // A well-formed minimum shifts by less than half a sample; anything larger
  // means the neighbours are not bracketing a real minimum.
  if (!Number.isFinite(adjustment) || Math.abs(adjustment) > 1) return tau;

  return tau + adjustment;
}
