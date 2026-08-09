import type { AudioBuffer } from 'react-native-audio-api';

import { applyFades, mutedPluck, pluckedString } from '@/dsp/karplus';
import { accentGain, type StrumStep } from '@/music/strum';
import { strumNotes } from '@/music/voicing';

import { getAudioContext } from './engine';

/**
 * Plays strums of a chord.
 *
 * Notes are rendered once per chord and replayed from buffers rather than
 * synthesised per strum: a pattern fires up to four notes every eighth note,
 * and re-running Karplus-Strong each time would stutter the JS thread exactly
 * when the beat needs to be steady.
 *
 * Several chords are held at once, because a song moves between them every bar
 * or two and re-rendering on each change would put a gap in the music at every
 * chord change — the one place a learner is already struggling.
 */

const RING_SECONDS = 2.2;
const MUTE_SECONDS = 0.22;
/** Per-string seed variation, so a chord is not one filtered tone. */
const SEEDS = [11, 29, 53, 97];

/**
 * How many chords to keep rendered. Songs in the library use at most five, and
 * each costs roughly 1.5 MB of buffers.
 */
const MAX_CACHED_SHAPES = 8;

type Voice = { ringing: AudioBuffer; muted: AudioBuffer };
type Shape = { frets: readonly number[]; voices: Map<number, Voice> };

export class Strummer {
  private shapes = new Map<string, Shape>();
  private master = 0.5;

  /** Overall level, so a four-note chord does not clip against the metronome. */
  setLevel(level: number): void {
    this.master = Math.max(0, Math.min(1, level));
  }

  /**
   * Renders a chord's notes. Cheap to call repeatedly with the same shape — it
   * returns immediately once that shape is cached.
   */
  prepare(frets: readonly number[]): void {
    const key = frets.join(',');
    if (this.shapes.has(key)) return;

    const context = getAudioContext();
    const sampleRate = context.sampleRate;
    const voices = new Map<number, Voice>();

    // Rendered per string rather than per pitch: two strings sounding the same
    // note (A minor doubles A4) should not be bit-identical, or the chord
    // acquires a hollow, phasey quality.
    strumNotes(frets, 'D').forEach((note) => {
      const seed = SEEDS[note.stringIndex % SEEDS.length]!;

      voices.set(note.stringIndex, {
        ringing: toAudioBuffer(
          applyFades(
            pluckedString({
              frequency: note.frequency,
              sampleRate,
              durationSeconds: RING_SECONDS,
              decaySeconds: 2,
              seed,
            }),
            sampleRate,
          ),
          sampleRate,
        ),
        muted: toAudioBuffer(
          applyFades(
            mutedPluck({
              frequency: note.frequency,
              sampleRate,
              durationSeconds: MUTE_SECONDS,
              seed: seed + 1,
            }),
            sampleRate,
            0.001,
            0.02,
          ),
          sampleRate,
        ),
      });
    });

    if (this.shapes.size >= MAX_CACHED_SHAPES) {
      // Oldest out. Map preserves insertion order, so the first key is it.
      const oldest = this.shapes.keys().next().value;
      if (oldest !== undefined) this.shapes.delete(oldest);
    }

    this.shapes.set(key, { frets: [...frets], voices });
  }

  /**
   * Schedules one stroke.
   *
   * @param when audio-clock time the *first* string is struck.
   * @param frets the chord to sound. Prepared on demand if not already cached.
   */
  strum(when: number, step: StrumStep, frets: readonly number[]): void {
    if (step.dir === 'rest') return;

    const key = frets.join(',');
    if (!this.shapes.has(key)) this.prepare(frets);

    const shape = this.shapes.get(key);
    if (!shape || shape.voices.size === 0) return;

    const context = getAudioContext();
    const gain = accentGain(step.accent) * this.master;
    // A soft stroke is also a faster one — a light flick crosses the strings
    // more quickly than a firm one, and matching that is most of what makes
    // dynamics sound like dynamics rather than a volume knob.
    const spread = step.accent === 'soft' ? 0.007 : step.accent === 'strong' ? 0.014 : 0.011;

    for (const note of strumNotes(shape.frets, step.dir, spread)) {
      const voice = shape.voices.get(note.stringIndex);
      if (!voice) continue;

      const source = context.createBufferSource();
      source.buffer = step.muted ? voice.muted : voice.ringing;

      const amp = context.createGain();
      amp.gain.value = gain;

      source.connect(amp);
      amp.connect(context.destination);
      source.start(when + note.offsetSeconds);
    }
  }

  dispose(): void {
    this.shapes.clear();
  }
}

// Float32Array<ArrayBuffer> rather than the looser Float32Array: copyToChannel
// will not accept a possibly-shared backing buffer.
function toAudioBuffer(samples: Float32Array<ArrayBuffer>, sampleRate: number): AudioBuffer {
  const buffer = getAudioContext().createBuffer(1, samples.length, sampleRate);
  buffer.copyToChannel(samples, 0);
  return buffer;
}
