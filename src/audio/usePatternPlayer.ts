import * as Haptics from 'expo-haptics';
import { useCallback, useEffect, useRef, useState } from 'react';

import { getHapticsEnabled } from '@/db/settings';
import type { StepMark } from '@/music/grid';


import { audioNow } from './engine';
import { PatternPlayer, type PatternPlayerOptions } from './patternPlayer';
import { Strummer } from './strummer';

/**
 * Drives a {@link PatternPlayer} from React.
 *
 * The audio clock decides when everything happens; React only mirrors it. Both
 * the highlighted step and the haptic tap are scheduled for the moment the
 * strum actually sounds, rather than fired when the callback arrives — the
 * scheduler books up to 200 ms ahead, so reacting to the callback would light
 * the step before it is audible.
 */

export type PatternPlayerState = {
  isPlaying: boolean;
  /** Index of the step currently sounding, or null when stopped. */
  activeStep: number | null;
  start: () => void;
  stop: () => void;
  toggle: () => void;
  /**
   * Audio-clock time the count-in began, or null when stopped.
   *
   * A function rather than state so a caller can read it at the moment it stops
   * recording, without waiting for a re-render. This is the anchor that lets a
   * take be aligned against the exact beats that were heard.
   */
  getStartTime: () => number | null;
};

export type UsePatternPlayerOptions = Omit<PatternPlayerOptions, 'steps' | 'frets'> & {
  steps: PatternPlayerOptions['steps'];
  frets: PatternPlayerOptions['frets'];
  /** A light tap on downbeats and accented strums. */
  haptics?: boolean;
};

export function usePatternPlayer(options: UsePatternPlayerOptions): PatternPlayerState {
  const [isPlaying, setIsPlaying] = useState(false);
  const [activeStep, setActiveStep] = useState<number | null>(null);

  const player = useRef<PatternPlayer | null>(null);
  const strummer = useRef<Strummer | null>(null);
  const timeouts = useRef<ReturnType<typeof setTimeout>[]>([]);

  const {
    steps,
    frets,
    bpm,
    timeSignature,
    subdivision,
    countInBars = 1,
    tempoFraction = 1,
    withClick = true,
    haptics = getHapticsEnabled(),
  } = options;

  const clearPending = useCallback(() => {
    for (const timeout of timeouts.current) clearTimeout(timeout);
    timeouts.current = [];
  }, []);

  const at = useCallback((when: number, action: () => void) => {
    const delayMs = Math.max(0, (when - audioNow()) * 1000);
    const timeout = setTimeout(action, delayMs);
    timeouts.current.push(timeout);
    if (timeouts.current.length > 64) timeouts.current = timeouts.current.slice(-64);
  }, []);

  const fretsKey = frets.join(',');
  const stepsKey = steps.map((step) => `${step.dir}${step.accent}${step.muted ? 'x' : ''}`).join('');

  /**
   * Tempo, held outside the effect that builds the player.
   *
   * Moving the tempo used to be in that effect's dependencies, so every change
   * tore the player down and the cleanup stopped it — reaching for the tempo
   * chips mid-practice silenced the thing you were practising to. `setOptions`
   * existed for exactly this and had no callers.
   */
  const tempo = useRef({ bpm, tempoFraction });

  useEffect(() => {
    if (!strummer.current) strummer.current = new Strummer();

    const instance = new PatternPlayer(
      {
        steps,
        frets,
        bpm: tempo.current.bpm,
        timeSignature,
        subdivision,
        countInBars,
        tempoFraction: tempo.current.tempoFraction,
        withClick,
      },
      {
        onStep: (step, mark: StepMark, when) => {
          at(when, () => {
            setActiveStep(mark.index);
            if (haptics && step.accent === 'strong') {
              void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            }
          });
        },
        onBeat: (beat, when) => {
          if (!haptics || !beat.isDownbeat) return;
          at(when, () => {
            void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
          });
        },
        onFinish: () => {
          setIsPlaying(false);
          setActiveStep(null);
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
    };
    // `steps` and `frets` are arrays rebuilt on every render, so they are
    // compared by content rather than identity.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    stepsKey,
    fretsKey,
    timeSignature.beatsPerBar,
    timeSignature.beatUnit,
    subdivision,
    countInBars,
    withClick,
    haptics,
    at,
    clearPending,
  ]);

  // Tempo changes adjust the running player rather than replacing it, so the
  // pattern carries on at the new speed instead of stopping.
  useEffect(() => {
    tempo.current = { bpm, tempoFraction };

    player.current?.setOptions({
      steps,
      frets,
      bpm,
      timeSignature,
      subdivision,
      countInBars,
      tempoFraction,
      withClick,
    });
    // Same content-not-identity comparison as above.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bpm, tempoFraction, stepsKey, fretsKey, subdivision, countInBars, withClick]);

  useEffect(() => {
    const instance = strummer.current;
    return () => instance?.dispose();
  }, []);

  const start = useCallback(() => {
    const instance = player.current;
    if (!instance || instance.isRunning()) return;
    instance.start({ loop: true });
    setIsPlaying(true);
  }, []);

  const stop = useCallback(() => {
    player.current?.stop();
    clearPending();
    setIsPlaying(false);
    setActiveStep(null);
  }, [clearPending]);

  const toggle = useCallback(() => {
    if (player.current?.isRunning()) stop();
    else start();
  }, [start, stop]);

  const getStartTime = useCallback(() => {
    const instance = player.current;
    if (!instance) return null;
    const startTime = instance.getStartTime();
    return startTime > 0 ? startTime : null;
  }, []);

  return { isPlaying, activeStep, start, stop, toggle, getStartTime };
}
