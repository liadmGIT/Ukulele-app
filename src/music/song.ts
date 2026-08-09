import type { SongData, SongMeasureData } from '@/content/schemas';

import { beatDurationSeconds, type TimeSignature } from './grid';

/**
 * Turning a song's sections and measures into a flat, timed chart.
 *
 * The player needs to answer two questions on every frame — which chord is
 * sounding, and which bar to highlight — and neither should require walking a
 * nested structure. So a song is flattened once into bars with absolute beat
 * positions, and everything downstream is arithmetic on that.
 */

export type SongChordSlot = {
  chordId: string;
  beats: number;
  cueWord?: string;
  /** Beats from the start of the song. */
  startBeat: number;
};

export type SongBar = {
  /** Position among all bars in the song. */
  index: number;
  sectionIndex: number;
  sectionKind: SongData['sections'][number]['kind'];
  sectionLabel?: string;
  /** True on the first bar of a section, so the chart can print a heading. */
  startsSection: boolean;
  /** Bar number within its section, 1-based. */
  barInSection: number;
  startBeat: number;
  chords: SongChordSlot[];
};

export type SongTimeline = {
  bars: SongBar[];
  totalBeats: number;
  totalBars: number;
  timeSignature: TimeSignature;
  /** Distinct chords the song needs, in order of first appearance. */
  chordIds: string[];
};

export function buildSongTimeline(song: SongData): SongTimeline {
  const beatsPerBar = song.beatsPerBar;
  const bars: SongBar[] = [];
  const chordIds: string[] = [];

  let beat = 0;
  let barIndex = 0;

  song.sections.forEach((section, sectionIndex) => {
    let barInSection = 0;
    let pending: SongChordSlot[] = [];
    let pendingBeats = 0;

    const flush = () => {
      if (pending.length === 0) return;

      bars.push({
        index: barIndex,
        sectionIndex,
        sectionKind: section.kind,
        ...(section.label ? { sectionLabel: section.label } : {}),
        startsSection: barInSection === 0,
        barInSection: barInSection + 1,
        startBeat: pending[0]!.startBeat,
        chords: pending,
      });

      barIndex += 1;
      barInSection += 1;
      pending = [];
      pendingBeats = 0;
    };

    for (const measure of section.measures as SongMeasureData[]) {
      if (!chordIds.includes(measure.chordId)) chordIds.push(measure.chordId);

      pending.push({
        chordId: measure.chordId,
        beats: measure.beats,
        ...(measure.cueWord ? { cueWord: measure.cueWord } : {}),
        startBeat: beat,
      });

      beat += measure.beats;
      pendingBeats += measure.beats;

      if (pendingBeats >= beatsPerBar) flush();
    }

    // A section whose last bar is short still gets drawn; the generator rejects
    // it at build time, so reaching here means something unusual and losing the
    // bar would be worse than showing it.
    flush();
  });

  return {
    bars,
    totalBeats: beat,
    totalBars: bars.length,
    timeSignature: { beatsPerBar: song.beatsPerBar, beatUnit: song.beatUnit },
    chordIds,
  };
}

/** The chord slot sounding at a given beat, or null past the end. */
export function chordAtBeat(timeline: SongTimeline, beat: number): SongChordSlot | null {
  if (beat < 0 || beat >= timeline.totalBeats) return null;

  for (const bar of timeline.bars) {
    for (const slot of bar.chords) {
      if (beat >= slot.startBeat && beat < slot.startBeat + slot.beats) return slot;
    }
  }
  return null;
}

/** The bar containing a given beat. */
export function barAtBeat(timeline: SongTimeline, beat: number): SongBar | null {
  if (beat < 0) return null;

  for (let i = timeline.bars.length - 1; i >= 0; i -= 1) {
    const bar = timeline.bars[i]!;
    if (beat >= bar.startBeat) return bar;
  }
  return null;
}

/** How long the song runs, at a given tempo. */
export function songDurationSeconds(
  timeline: SongTimeline,
  bpm: number,
  tempoFraction = 1,
): number {
  return timeline.totalBeats * beatDurationSeconds(bpm * tempoFraction);
}

/** Beats elapsed at a moment, for driving the playhead. */
export function beatAtSecond(
  seconds: number,
  bpm: number,
  tempoFraction = 1,
): number {
  return seconds / beatDurationSeconds(bpm * tempoFraction);
}
