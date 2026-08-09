/**
 * Radix-2 FFT and the windowing around it.
 *
 * Written out rather than pulled from a library so it stays a pure function
 * over `Float32Array` with no native dependency — the same property that lets
 * the whole analysis chain be tested in CI against signals with known answers.
 */

/**
 * In-place iterative Cooley-Tukey FFT.
 *
 * Twiddle factors are precomputed once per size and reused, because the onset
 * detector runs this on every 512-sample hop of a recording — a three-minute
 * take is fifteen thousand transforms.
 */
export class Fft {
  private readonly cosTable: Float64Array;
  private readonly sinTable: Float64Array;
  private readonly reverseTable: Uint32Array;

  constructor(readonly size: number) {
    if (size < 2 || (size & (size - 1)) !== 0) {
      throw new Error(`FFT size must be a power of two of at least 2, got ${size}`);
    }

    const half = size / 2;
    this.cosTable = new Float64Array(half);
    this.sinTable = new Float64Array(half);

    for (let i = 0; i < half; i += 1) {
      this.cosTable[i] = Math.cos((-2 * Math.PI * i) / size);
      this.sinTable[i] = Math.sin((-2 * Math.PI * i) / size);
    }

    const bits = Math.log2(size);
    this.reverseTable = new Uint32Array(size);
    for (let i = 0; i < size; i += 1) {
      let reversed = 0;
      for (let bit = 0; bit < bits; bit += 1) {
        reversed = (reversed << 1) | ((i >>> bit) & 1);
      }
      this.reverseTable[i] = reversed;
    }
  }

  /** Transforms `real`/`imag` in place. */
  transform(real: Float64Array, imag: Float64Array): void {
    const { size, cosTable, sinTable, reverseTable } = this;

    if (real.length !== size || imag.length !== size) {
      throw new Error(`Expected arrays of length ${size}`);
    }

    for (let i = 0; i < size; i += 1) {
      const j = reverseTable[i]!;
      if (j > i) {
        const tempReal = real[i]!;
        real[i] = real[j]!;
        real[j] = tempReal;

        const tempImag = imag[i]!;
        imag[i] = imag[j]!;
        imag[j] = tempImag;
      }
    }

    for (let stride = 2; stride <= size; stride *= 2) {
      const half = stride / 2;
      const step = size / stride;

      for (let start = 0; start < size; start += stride) {
        for (let offset = 0, twiddle = 0; offset < half; offset += 1, twiddle += step) {
          const evenIndex = start + offset;
          const oddIndex = evenIndex + half;

          const cos = cosTable[twiddle]!;
          const sin = sinTable[twiddle]!;

          const oddReal = real[oddIndex]! * cos - imag[oddIndex]! * sin;
          const oddImag = real[oddIndex]! * sin + imag[oddIndex]! * cos;

          real[oddIndex] = real[evenIndex]! - oddReal;
          imag[oddIndex] = imag[evenIndex]! - oddImag;
          real[evenIndex] = real[evenIndex]! + oddReal;
          imag[evenIndex] = imag[evenIndex]! + oddImag;
        }
      }
    }
  }

  /**
   * Magnitude spectrum of a real signal, filling `output` with `size / 2 + 1`
   * bins. Reuses caller-provided scratch arrays so a long recording does not
   * allocate per frame.
   */
  magnitudes(
    input: Float32Array,
    output: Float32Array,
    real: Float64Array,
    imag: Float64Array,
  ): void {
    const { size } = this;

    for (let i = 0; i < size; i += 1) {
      real[i] = i < input.length ? input[i]! : 0;
      imag[i] = 0;
    }

    this.transform(real, imag);

    const bins = size / 2 + 1;
    for (let i = 0; i < bins; i += 1) {
      output[i] = Math.hypot(real[i]!, imag[i]!);
    }
  }
}

/**
 * Periodic Hann window.
 *
 * Without it, each frame ends abruptly and the transform smears energy across
 * every bin — which the onset detector would read as a burst of broadband
 * change, i.e. a strum that never happened, on every single frame.
 */
export function hannWindow(size: number): Float32Array {
  const window = new Float32Array(size);
  for (let i = 0; i < size; i += 1) {
    window[i] = 0.5 * (1 - Math.cos((2 * Math.PI * i) / size));
  }
  return window;
}
