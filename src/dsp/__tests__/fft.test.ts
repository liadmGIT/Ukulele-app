import { Fft, hannWindow } from '../fft';

import { DEFAULT_SAMPLE_RATE, tone } from './signals';

function magnitudesOf(samples: Float32Array, size: number): Float32Array {
  const fft = new Fft(size);
  const output = new Float32Array(size / 2 + 1);
  fft.magnitudes(samples, output, new Float64Array(size), new Float64Array(size));
  return output;
}

describe('Fft', () => {
  it('rejects sizes that are not powers of two', () => {
    expect(() => new Fft(1000)).toThrow();
    expect(() => new Fft(1)).toThrow();
    expect(() => new Fft(0)).toThrow();
    expect(() => new Fft(1024)).not.toThrow();
  });

  it('puts a constant signal entirely in the DC bin', () => {
    const size = 64;
    const constant = new Float32Array(size).fill(0.5);
    const magnitudes = magnitudesOf(constant, size);

    expect(magnitudes[0]).toBeCloseTo(size * 0.5, 4);
    for (let bin = 1; bin < magnitudes.length; bin += 1) {
      expect(magnitudes[bin]).toBeLessThan(1e-6);
    }
  });

  it('puts a sine exactly on a bin centre into that bin alone', () => {
    const size = 1024;
    const bin = 16;
    const samples = new Float32Array(size);
    for (let i = 0; i < size; i += 1) {
      samples[i] = Math.sin((2 * Math.PI * bin * i) / size);
    }

    const magnitudes = magnitudesOf(samples, size);
    const loudest = magnitudes.indexOf(Math.max(...magnitudes));
    expect(loudest).toBe(bin);
    expect(magnitudes[bin]).toBeCloseTo(size / 2, 3);
  });

  it('finds the bin a real tone belongs in', () => {
    const size = 2048;
    const frequency = 440;
    const samples = tone({ frequency, durationSeconds: size / DEFAULT_SAMPLE_RATE });

    const magnitudes = magnitudesOf(samples, size);
    const loudest = magnitudes.indexOf(Math.max(...magnitudes));
    const expected = Math.round((frequency * size) / DEFAULT_SAMPLE_RATE);

    expect(Math.abs(loudest - expected)).toBeLessThanOrEqual(1);
  });

  it('conserves energy (Parseval)', () => {
    const size = 256;
    const samples = tone({ frequency: 1000, durationSeconds: size / DEFAULT_SAMPLE_RATE });

    const real = new Float64Array(size);
    const imag = new Float64Array(size);
    for (let i = 0; i < size; i += 1) real[i] = samples[i]!;

    let timeEnergy = 0;
    for (let i = 0; i < size; i += 1) timeEnergy += real[i]! * real[i]!;

    new Fft(size).transform(real, imag);

    let spectrumEnergy = 0;
    for (let i = 0; i < size; i += 1) {
      spectrumEnergy += real[i]! * real[i]! + imag[i]! * imag[i]!;
    }

    expect(spectrumEnergy / size).toBeCloseTo(timeEnergy, 3);
  });

  it('rejects arrays of the wrong length', () => {
    const fft = new Fft(64);
    expect(() => fft.transform(new Float64Array(32), new Float64Array(64))).toThrow();
  });

  it('pads a short input rather than reading past its end', () => {
    const magnitudes = magnitudesOf(new Float32Array(10).fill(1), 64);
    expect(magnitudes[0]).toBeCloseTo(10, 4);
  });
});

describe('hannWindow', () => {
  it('starts at zero and peaks in the middle', () => {
    const window = hannWindow(64);
    expect(window[0]).toBeCloseTo(0, 10);
    expect(window[32]).toBeCloseTo(1, 10);
  });

  it('is symmetric about its centre', () => {
    const window = hannWindow(64);
    for (let i = 1; i < 32; i += 1) {
      expect(window[32 - i]).toBeCloseTo(window[32 + i]!, 10);
    }
  });

  it('is periodic, so overlapping frames sum smoothly', () => {
    // A periodic (rather than symmetric) window is what makes 50%-overlapped
    // frames reconstruct without a ripple.
    const size = 8;
    const window = hannWindow(size);
    const half = size / 2;

    for (let i = 0; i < half; i += 1) {
      // Float32 storage, so six decimal places is the honest precision here.
      expect(window[i]! + window[i + half]!).toBeCloseTo(1, 6);
    }
  });
});
