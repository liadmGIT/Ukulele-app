import { useCallback, useEffect, useRef, useState } from 'react';

import type { GridOptions } from '@/music/grid';

import { audioNow } from './engine';
import { Metronome, type MetronomeBeatEvent } from './metronome';

/**
 * Drives a {@link Metronome} from React.
 *
 * The click times are decided by the audio clock; React only mirrors them. The
 * visual beat is scheduled for the moment the click actually sounds rather than
 * rendered when the callback fires, because the scheduler books clicks up to
 * 200 ms ahead — flashing on the callback would show the beat before it is
 * audible, which is worse than showing nothing.
 */

export type MetronomeState = {
  isRunning: boolean;
  /** The beat currently sounding, or null when stopped. */
  currentBeat: MetronomeBeatEvent | null;
  start: () => void;
  stop: () => void;
  toggle: () => void;
};

export function useMetronome(options: GridOptions, loop = true): MetronomeState {
  const [isRunning, setIsRunning] = useState(false);
  const [currentBeat, setCurrentBeat] = useState<MetronomeBeatEvent | null>(null);

  const metronome = useRef<Metronome | null>(null);
  const timeouts = useRef<ReturnType<typeof setTimeout>[]>([]);

  const clearPendingFlashes = useCallback(() => {
    for (const timeout of timeouts.current) clearTimeout(timeout);
    timeouts.current = [];
  }, []);

  const handleBeat = useCallback((event: MetronomeBeatEvent) => {
    const delayMs = Math.max(0, (event.when - audioNow()) * 1000);
    const timeout = setTimeout(() => setCurrentBeat(event), delayMs);
    timeouts.current.push(timeout);
    if (timeouts.current.length > 32) timeouts.current = timeouts.current.slice(-32);
  }, []);

  /**
   * Tempo, deliberately outside the effect below.
   *
   * It used to be a dependency, so nudging the BPM rebuilt the metronome and
   * the cleanup stopped it — the click died the moment you adjusted it, which
   * is precisely when you are listening. `Metronome.setOptions` was written for
   * this and never called.
   */
  const tempo = useRef({ bpm: options.bpm, tempoFraction: options.tempoFraction });

  // Rebuild when the shape of the grid changes — time signature, count-in.
  useEffect(() => {
    const instance = new Metronome({ ...options, ...tempo.current }, {
      onBeat: handleBeat,
      onFinish: () => {
        setIsRunning(false);
        setCurrentBeat(null);
      },
    });
    metronome.current = instance;

    return () => {
      instance.stop();
      metronome.current = null;
      clearPendingFlashes();
      setIsRunning(false);
      setCurrentBeat(null);
    };
    // `options` is rebuilt each render; the fields below are what actually
    // matter, and tempo is applied separately by the effect after this one.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    options.bars,
    options.countInBars,
    options.subdivision,
    options.timeSignature?.beatsPerBar,
    options.timeSignature?.beatUnit,
    handleBeat,
    clearPendingFlashes,
  ]);

  // A tempo change adjusts the running metronome instead of replacing it.
  useEffect(() => {
    tempo.current = { bpm: options.bpm, tempoFraction: options.tempoFraction };
    metronome.current?.setOptions({ ...options });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [options.bpm, options.tempoFraction]);

  const start = useCallback(() => {
    const instance = metronome.current;
    if (!instance || instance.isRunning()) return;
    instance.start({ loop });
    setIsRunning(true);
  }, [loop]);

  const stop = useCallback(() => {
    metronome.current?.stop();
    clearPendingFlashes();
    setIsRunning(false);
    setCurrentBeat(null);
  }, [clearPendingFlashes]);

  const toggle = useCallback(() => {
    if (metronome.current?.isRunning()) stop();
    else start();
  }, [start, stop]);

  return { isRunning, currentBeat, start, stop, toggle };
}
