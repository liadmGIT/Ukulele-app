import { Fft, hannWindow } from './fft';

/**
 * Chroma: what a moment of audio sounds like, reduced to twelve pitch classes.
 *
 * Folding every octave onto one twelve-bin profile throws away exactly the
 * thing that varies between voicings of the same chord — which octave each note
 * landed in — and keeps the thing that identifies it. That makes two strums of
 * the same chord look nearly identical even when played with different force,
 * and two different chords look clearly different, which is all the
 * chord-change drill needs to count changes rather than strums.
 */

/** Ignore rumble below this; handling noise carries no pitch. */
const MIN_FREQUENCY = 70;
/** Above this, partials are dense enough to smear the profile. */
const MAX_FREQUENCY = 2200;

export class ChromaAnalyser {
  private readonly fft: Fft;
  private readonly window: Float32Array;
  private readonly magnitudes: Float32Array;
  private readonly real: Float64Array;
  private readonly imag: Float64Array;
  private readonly windowed: Float32Array;
  /** Pitch class of each bin, or -1 for bins outside the useful range. */
  private readonly binPitchClass: Int8Array;

  constructor(
    readonly sampleRate: number,
    readonly frameSize = 4096,
  ) {
    this.fft = new Fft(frameSize);
    this.window = hannWindow(frameSize);
    this.magnitudes = new Float32Array(frameSize / 2 + 1);
    this.real = new Float64Array(frameSize);
    this.imag = new Float64Array(frameSize);
    this.windowed = new Float32Array(frameSize);

    this.binPitchClass = new Int8Array(this.magnitudes.length).fill(-1);
    for (let bin = 1; bin < this.magnitudes.length; bin += 1) {
      const frequency = (bin * sampleRate) / frameSize;
      if (frequency < MIN_FREQUENCY || frequency > MAX_FREQUENCY) continue;

      const midi = Math.round(12 * Math.log2(frequency / 440) + 69);
      this.binPitchClass[bin] = ((midi % 12) + 12) % 12;
    }
  }

  /**
   * The twelve-bin profile of a window, normalised to unit length.
   *
   * Normalising is what makes the comparison indifferent to how hard the strum
   * was — a soft strum of C and a hard strum of C must look the same, or the
   * drill would count a dynamic change as a chord change.
   */
  analyse(samples: Float32Array, start: number): Float32Array {
    const chroma = new Float32Array(12);

    for (let i = 0; i < this.frameSize; i += 1) {
      this.windowed[i] = (samples[start + i] ?? 0) * this.window[i]!;
    }

    this.fft.magnitudes(this.windowed, this.magnitudes, this.real, this.imag);

    for (let bin = 1; bin < this.magnitudes.length; bin += 1) {
      const pitchClass = this.binPitchClass[bin]!;
      if (pitchClass < 0) continue;
      chroma[pitchClass]! += this.magnitudes[bin]!;
    }

    let norm = 0;
    for (let i = 0; i < 12; i += 1) norm += chroma[i]! * chroma[i]!;
    norm = Math.sqrt(norm);

    if (norm > 0) {
      for (let i = 0; i < 12; i += 1) chroma[i]! /= norm;
    }

    return chroma;
  }
}

/** Cosine similarity of two unit-length chroma vectors, 0..1. */
export function chromaSimilarity(a: Float32Array, b: Float32Array): number {
  let dot = 0;
  for (let i = 0; i < 12; i += 1) dot += a[i]! * b[i]!;
  return Math.max(0, Math.min(1, dot));
}
