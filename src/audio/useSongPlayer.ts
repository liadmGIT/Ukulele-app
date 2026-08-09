import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import type { Song } from '@/content';
import { getChordById } from '@/content';
import type { PracticeGrid, StepMark } from '@/music/grid';
import { chordAtBeat, type SongBar } from '@/music/song';
import { parseStrumPattern, type StrumStep } from '@/music/strum';

import { audioNow } from './engine';
import { buildGridFor, PatternPlayer } from './patternPlayer';
import { Strummer } from './strummer';

/**
 * Playing a whole song: the strum pattern applied bar after bar, with the chord
 * changing underneath it.
 *
 * Reuses {@link PatternPlayer} rather than scheduling separately, so a song
 * inherits the same drift-free timing as everything else. The only thing a song
 * adds is that the chord is a function of position rather than a constant.
 */

export type SongPlayerState = {
  isPlaying: boolean;
  /** Bar currently sounding, or null when stopped. */
  currentBar: SongBar | null;
  /** Chord id currently sounding. */
  currentChordId: string | null;
  /** The chord after this one, so the learner can get their hand ready. */
  nextChordId: string | null;
  /** Index within the strum pattern, for the rhythm strip's playhead. */
  activeStep: number | null;
  /**
   * The strums this song expects, and the grid they sit on.
   *
   * Exposed so a take can be analysed against exactly what was played rather
   * than against a second grid rebuilt from the same inputs — two grids that
   * agree today are two grids that can disagree later.
   */
  steps: readonly StrumStep[];
  grid: PracticeGrid | null;
  start: () => void;
  stop: () => void;
  toggle: () => void;
  getStartTime: () => number | null;
};

export type UseSongPlayerOptions = {
  song: Song;
  /** Compact notation of the pattern to apply. */
  patternNotation: string;
  patternSubdivision: 4 | 8 | 16;
  tempoFraction?: number;
  withClick?: boolean;
  countInBars?: number;
};

export function useSongPlayer({
  song,
  patternNotation,
  patternSubdivision,
  tempoFraction = 1,
  withClick = true,
  countInBars = 1,
}: UseSongPlayerOptions): SongPlayerState {
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentBar, setCurrentBar] = useState<SongBar | null>(null);
  const [currentChordId, setCurrentChordId] = useState<string | null>(null);
  const [nextChordId, setNextChordId] = useState<string | null>(null);
  const [activeStep, setActiveStep] = useState<number | null>(null);
  const player = useRef<PatternPlayer | null>(null);
  const strummer = useRef<Strummer | null>(null);
  const timeouts = useRef<ReturnType<typeof setTimeout>[]>([]);

  const clearPending = useCallback(() => {
    for (const timeout of timeouts.current) clearTimeout(timeout);
    timeouts.current = [];
  }, []);

  const at = useCallback((when: number, action: () => void) => {
    const delayMs = Math.max(0, (when - audioNow()) * 1000);
    const timeout = setTimeout(action, delayMs);
    timeouts.current.push(timeout);
    if (timeouts.current.length > 96) timeouts.current = timeouts.current.slice(-96);
  }, []);

  const songId = song.id;
  const { timeline, beatsPerBar, beatUnit, bpm } = song;

  /**
   * The strums this song expects and the grid they sit on, derived rather than
   * captured from the player, so a recorded take is measured against exactly
   * what was scheduled.
   *
   * A song with no bars yields no grid instead of throwing. That case is real:
   * opening the screen with an unknown id — a deep link to a renamed song —
   * used to reach `buildGrid` with zero bars and take the app down, and the
   * screen's own "not found" guard could not prevent it, because effects run
   * regardless of what render returned.
   */
  const { steps, grid } = useMemo(() => {
    if (timeline.totalBars === 0) {
      return { steps: [] as readonly StrumStep[], grid: null };
    }

    const patternSteps = parseStrumPattern(patternNotation);
    const songSteps = Array.from({ length: timeline.totalBars }, () => patternSteps).flat();

    return {
      steps: songSteps as readonly StrumStep[],
      grid: buildGridFor({
        steps: songSteps,
        frets: [0, 0, 0, 0],
        bpm,
        timeSignature: { beatsPerBar, beatUnit },
        subdivision: patternSubdivision,
        countInBars,
        tempoFraction,
      }),
    };
  }, [
    timeline.totalBars,
    patternNotation,
    patternSubdivision,
    bpm,
    beatsPerBar,
    beatUnit,
    countInBars,
    tempoFraction,
  ]);

  useEffect(() => {
    // A song with no bars has nothing to schedule, and building a player for
    // one throws: an empty step list means zero bars, and the grid refuses to
    // be built from zero. That used to happen inside this effect whenever the
    // screen was opened with an unknown song id — a deep link to a renamed
    // song, say — and the screen's own "not found" guard could not prevent it,
    // because effects run regardless of what render returned.
    if (grid === null) return;

    if (!strummer.current) strummer.current = new Strummer();

    const stepsPerBeat = patternSubdivision / beatUnit;
    const songSteps = steps;
    const patternLength = parseStrumPattern(patternNotation).length;

    /** Which beat of the song a grid step falls on. */
    const beatOfStep = (mark: StepMark) => mark.index / stepsPerBeat;

    const fretsForStep = (mark: StepMark): readonly number[] => {
      const slot = chordAtBeat(timeline, beatOfStep(mark));
      const chord = slot ? getChordById(slot.chordId) : undefined;
      return chord?.shapes[0]?.frets ?? [0, 0, 0, 0];
    };

    const instance = new PatternPlayer(
      {
        steps: songSteps,
        frets: [0, 0, 0, 0],
        fretsForStep,
        bpm,
        timeSignature: { beatsPerBar, beatUnit },
        subdivision: patternSubdivision,
        countInBars,
        tempoFraction,
        withClick,
      },
      {
        onStep: (_step, mark, when) => {
          at(when, () => {
            setActiveStep(mark.index % patternLength);

            const beat = beatOfStep(mark);
            const slot = chordAtBeat(timeline, beat);
            setCurrentChordId(slot?.chordId ?? null);

            // Look ahead to the next *different* chord, which is what the
            // learner's fretting hand actually has to prepare for.
            const upcoming = timeline.bars
              .flatMap((bar) => bar.chords)
              .find((entry) => entry.startBeat > beat && entry.chordId !== slot?.chordId);
            setNextChordId(upcoming?.chordId ?? null);

            const barIndex = Math.floor(beat / beatsPerBar);
            setCurrentBar(timeline.bars[barIndex] ?? null);
          });
        },
        onFinish: () => {
          setIsPlaying(false);
          setActiveStep(null);
          setCurrentBar(null);
        },
      },
      { strummer: strummer.current },
    );

    player.current = instance;

    return () => {
      instance.stop();
      player.current = null;
      clearPending();
      setIsPlaying(false);
      setActiveStep(null);
      setCurrentBar(null);
      setCurrentChordId(null);
      setNextChordId(null);
    };
  }, [
    songId,
    timeline,
    steps,
    grid,
    bpm,
    beatsPerBar,
    beatUnit,
    patternNotation,
    patternSubdivision,
    tempoFraction,
    withClick,
    countInBars,
    at,
    clearPending,
  ]);

  useEffect(() => {
    const instance = strummer.current;
    return () => instance?.dispose();
  }, []);

  const start = useCallback(() => {
    const instance = player.current;
    if (!instance || instance.isRunning()) return;
    instance.start({ loop: false });
    setIsPlaying(true);
  }, []);

  const stop = useCallback(() => {
    player.current?.stop();
    clearPending();
    setIsPlaying(false);
    setActiveStep(null);
    setCurrentBar(null);
  }, [clearPending]);

  const toggle = useCallback(() => {
    if (player.current?.isRunning()) stop();
    else start();
  }, [start, stop]);

  const getStartTime = useCallback(() => {
    const startTime = player.current?.getStartTime() ?? 0;
    return startTime > 0 ? startTime : null;
  }, []);

  return {
    isPlaying,
    currentBar,
    currentChordId,
    nextChordId,
    activeStep,
    steps,
    grid,
    start,
    stop,
    toggle,
    getStartTime,
  };
}
