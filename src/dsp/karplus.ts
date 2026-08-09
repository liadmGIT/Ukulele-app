/**
 * Plucked-string synthesis (Karplus-Strong).
 *
 * A strum is four strings struck a few milliseconds apart, not one sound. To
 * make a rhythm pattern *feel* like a strum rather than a drum machine, the app
 * needs to actually sound the chord — and Karplus-Strong gets a convincing
 * plucked string out of a noise burst and a short delay line, cheaply enough to
 * render in JavaScript.
 *
 * Pure functions over `Float32Array`, so the synthesiser can be checked in CI
 * by the pitch detector in `./pitch` — one piece of DSP verifying another.
 */

export type PluckOptions = {
  frequency: number;
  sampleRate: number;
  durationSeconds: number;
  /**
   * Time for the note to fall by 60 dB. Long for a ringing string (~2 s),
   * very short for a damped "chnk" (~0.06 s).
   */
  decaySeconds?: number;
  amplitude?: number;
  /**
   * 0..1 — how much of the initial noise burst survives unfiltered. Lower is a
   * softer, rounder attack, as though plucked with the pad of the thumb rather
   * than a nail.
   */
  brightness?: number;
  /** Fixed seed keeps rendering deterministic, which tests depend on. */
  seed?: number;
};

const DEFAULTS = {
  decaySeconds: 2,
  amplitude: 0.9,
  brightness: 0.85,
  seed: 1,
} as const;

/** Deterministic white noise in -1..1 (xorshift32). */
function noiseGenerator(seed: number): () => number {
  let state = seed || 1;
  return () => {
    state ^= state << 13;
    state ^= state >>> 17;
    state ^= state << 5;
    return ((state >>> 0) / 0xffffffff) * 2 - 1;
  };
}

/**
 * Renders a single plucked note.
 *
 * The delay line length sets the pitch, and getting it right needs more care
 * than rounding to whole samples: at 44.1 kHz an integer-length loop puts A4
 * about four cents sharp, and the error grows with pitch — by the top of the
 * ukulele's range it is badly out of tune. So the loop length is split into a
 * whole-sample delay line plus a first-order all-pass filter that supplies the
 * fractional remainder.
 */
export function pluckedString(options: PluckOptions): Float32Array<ArrayBuffer> {
  const {
    frequency,
    sampleRate,
    durationSeconds,
    decaySeconds = DEFAULTS.decaySeconds,
    amplitude = DEFAULTS.amplitude,
    brightness = DEFAULTS.brightness,
    seed = DEFAULTS.seed,
  } = options;

  if (frequency <= 0) throw new Error(`frequency must be positive, got ${frequency}`);
  if (sampleRate <= 0) throw new Error(`sampleRate must be positive, got ${sampleRate}`);

  const length = Math.max(1, Math.round(durationSeconds * sampleRate));
  const output = new Float32Array(length);

  const period = sampleRate / frequency;
  // The two-point averaging loop filter contributes half a sample of delay, so
  // the delay line itself must be that much shorter.
  const totalDelay = period - 0.5;
  if (totalDelay < 2) return output; // above the useful range; silence beats noise

  const lineLength = Math.floor(totalDelay);
  const fraction = totalDelay - lineLength;
  // All-pass delay of `fraction` samples: H(z) = (a + z⁻¹) / (1 + a z⁻¹).
  const allpassCoefficient = (1 - fraction) / (1 + fraction);

  // Energy lost per round trip, chosen so the note falls 60 dB in decaySeconds.
  const roundTrips = (decaySeconds * sampleRate) / period;
  const loopGain = roundTrips > 0 ? 10 ** (-3 / roundTrips) : 0;

  const line = new Float32Array(lineLength);
  const nextNoise = noiseGenerator(seed);

  // Excite with noise, optionally rounded off, then remove the DC component —
  // a biased excitation would leave a constant offset ringing in the loop for
  // the whole life of the note.
  let previous = 0;
  let sum = 0;
  for (let i = 0; i < lineLength; i += 1) {
    const white = nextNoise();
    const shaped = brightness * white + (1 - brightness) * previous;
    previous = shaped;
    line[i] = shaped;
    sum += shaped;
  }
  const mean = sum / lineLength;
  for (let i = 0; i < lineLength; i += 1) line[i]! -= mean;

  let index = 0;
  let lastRead = 0;
  let allpassInput = 0;
  let allpassOutput = 0;

  for (let n = 0; n < length; n += 1) {
    const sample = line[index]!;
    output[n] = sample * amplitude;

    // Loop filter: average with the previous sample. This is what makes the
    // high partials die away faster than the fundamental, which is most of why
    // the result sounds like a string rather than a buzzer.
    const filtered = loopGain * 0.5 * (sample + lastRead);
    lastRead = sample;

    const delayed = allpassCoefficient * filtered + allpassInput - allpassCoefficient * allpassOutput;
    allpassInput = filtered;
    allpassOutput = delayed;

    line[index] = delayed;
    index = index + 1 === lineLength ? 0 : index + 1;
  }

  return output;
}

/**
 * A damped percussive stroke — the "chnk" of a muted strum.
 *
 * Same model with the decay collapsed, so the strings are heard being stopped
 * rather than allowed to ring.
 */
export function mutedPluck(
  options: Omit<PluckOptions, 'decaySeconds' | 'brightness'>,
): Float32Array<ArrayBuffer> {
  return pluckedString({
    ...options,
    decaySeconds: 0.05,
    brightness: 1,
  });
}

/**
 * Applies a short fade at the start and end of a rendered note.
 *
 * Without the fade-out, a note cut off mid-cycle ends on a step discontinuity,
 * which is heard as a click — and worse, would show up as a spurious onset when
 * the analysis in M4 looks for transients.
 */
export function applyFades<T extends Float32Array>(
  samples: T,
  sampleRate: number,
  fadeInSeconds = 0.001,
  fadeOutSeconds = 0.01,
): T {
  const fadeIn = Math.min(samples.length, Math.round(fadeInSeconds * sampleRate));
  const fadeOut = Math.min(samples.length, Math.round(fadeOutSeconds * sampleRate));

  for (let i = 0; i < fadeIn; i += 1) {
    samples[i]! *= i / fadeIn;
  }
  for (let i = 0; i < fadeOut; i += 1) {
    const index = samples.length - 1 - i;
    if (index < 0) break;
    samples[index]! *= i / fadeOut;
  }

  return samples;
}
