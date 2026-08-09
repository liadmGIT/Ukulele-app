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
 */

const RING_SECONDS = 2.2;
const MUTE_SECONDS = 0.22;
/** Slight per-string detune, so a chord does not sound like one filtered tone. */
const SEEDS = [11, 29, 53, 97];

type Voice = { ringing: AudioBuffer; muted: AudioBuffer };

export class Strummer {
  private voices = new Map<number, Voice>();
  private shapeKey = '';
  private frets: readonly number[] = [];
  private master = 0.5;

  /** Overall level, so a four-note chord does not clip against the metronome. */
  setLevel(level: number): void {
    this.master = Math.max(0, Math.min(1, level));
  }

  getFrets(): readonly number[] {
    return this.frets;
  }

  /**
   * Renders the chord's notes. Cheap to call repeatedly with the same shape —
   * it returns immediately when nothing has changed.
   */
  prepare(frets: readonly number[]): void {
    const key = frets.join(',');
    if (key === this.shapeKey) return;

    const context = getAudioContext();
    const sampleRate = context.sampleRate;

    this.voices.clear();
    this.frets = [...frets];
    this.shapeKey = key;

    // Rendered per string rather than per pitch: two strings sounding the same
    // note (A minor doubles A4) should not be bit-identical, or the chord
    // acquires a hollow, phasey quality.
    strumNotes(frets, 'D').forEach((note) => {
      const seed = SEEDS[note.stringIndex % SEEDS.length]!;

      this.voices.set(note.stringIndex, {
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
  }

  /**
   * Schedules one stroke.
   *
   * @param when audio-clock time the *first* string is struck.
   */
  strum(when: number, step: StrumStep): void {
    if (step.dir === 'rest') return;
    if (this.voices.size === 0) return;

    const context = getAudioContext();
    const gain = accentGain(step.accent) * this.master;
    // A soft stroke is also a faster one — a light flick crosses the strings
    // more quickly than a firm one, and matching that is most of what makes
    // dynamics sound like dynamics rather than a volume knob.
    const spread = step.accent === 'soft' ? 0.007 : step.accent === 'strong' ? 0.014 : 0.011;

    for (const note of strumNotes(this.frets, step.dir, spread)) {
      const voice = this.voices.get(note.stringIndex);
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
    this.voices.clear();
    this.shapeKey = '';
  }
}

// Float32Array<ArrayBuffer> rather than the looser Float32Array: copyToChannel
// will not accept a possibly-shared backing buffer.
function toAudioBuffer(samples: Float32Array<ArrayBuffer>, sampleRate: number): AudioBuffer {
  const buffer = getAudioContext().createBuffer(1, samples.length, sampleRate);
  buffer.copyToChannel(samples, 0);
  return buffer;
}
