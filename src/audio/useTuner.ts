import { useCallback, useEffect, useRef, useState } from 'react';

import { PitchDetector } from '@/dsp/pitch';
import { ExponentialSmoother, MedianFilter } from '@/dsp/smoothing';
import { analyseTuning, type TuningReading } from '@/music/tuner';

import { Microphone, type MicrophoneStatus } from './microphone';

/**
 * The tuner: microphone → pitch detection → a steady reading.
 *
 * Two stages of stabilisation, because they solve different problems. The
 * median throws away outliers — a fret buzz or a neighbouring string ringing
 * that lands an octave off. The exponential smoother then makes what survives
 * *move* smoothly, so the needle glides instead of stepping.
 */

/** How often the reading is handed to React. Faster than this just drops frames. */
const UI_UPDATE_INTERVAL_MS = 60;

/** Readings below this are too unreliable to show; better a blank than a lie. */
const MIN_CLARITY = 0.8;

/** Blank the display after this long without a confident reading. */
const HOLD_MS = 900;

const MEDIAN_WINDOW = 5;
const SMOOTHING_ALPHA = 0.35;

export type TunerState = {
  reading: TuningReading | null;
  status: MicrophoneStatus;
  /** Input level 0..1, for a "play louder" hint and a level meter. */
  level: number;
};

export function useTuner(active: boolean): TunerState {
  const [reading, setReading] = useState<TuningReading | null>(null);
  const [status, setStatus] = useState<MicrophoneStatus>('idle');
  const [level, setLevel] = useState(0);

  const microphone = useRef<Microphone | null>(null);
  const detector = useRef<PitchDetector | null>(null);
  const median = useRef(new MedianFilter(MEDIAN_WINDOW));
  const smoother = useRef(new ExponentialSmoother(SMOOTHING_ALPHA));
  const lastPublished = useRef(0);
  const lastConfident = useRef(0);

  const handleFrame = useCallback((samples: Float32Array, sampleRate: number) => {
    if (!detector.current) {
      // Built on the first frame: the hardware decides the real sample rate,
      // and a detector built on a guessed rate would be off by that ratio.
      detector.current = new PitchDetector({ sampleRate });
    }

    const result = detector.current.detect(samples);
    const now = Date.now();

    if (result.frequency !== null && result.clarity >= MIN_CLARITY) {
      const stable = median.current.push(result.frequency);
      const smoothed = smoother.current.push(stable);
      lastConfident.current = now;

      if (now - lastPublished.current >= UI_UPDATE_INTERVAL_MS) {
        lastPublished.current = now;
        setReading(analyseTuning(smoothed));
        setLevel(result.level);
      }
      return;
    }

    if (now - lastConfident.current > HOLD_MS) {
      median.current.clear();
      smoother.current.clear();
      if (now - lastPublished.current >= UI_UPDATE_INTERVAL_MS) {
        lastPublished.current = now;
        setReading(null);
        setLevel(result.level);
      }
    }
  }, []);

  useEffect(() => {
    if (!active) return;

    let cancelled = false;
    const mic = new Microphone();
    // Captured for the cleanup: these instances live for the whole hook, but
    // reading them off the ref at teardown time is the pattern the lint rule
    // (rightly, in general) insists on.
    const medianFilter = median.current;
    const smootherFilter = smoother.current;

    microphone.current = mic;

    const unsubscribe = mic.onFrame((frame) => {
      if (!cancelled) handleFrame(frame.samples, frame.sampleRate);
    });

    void mic.start({ windowSize: 2048, bufferLength: 1024 }).then((result) => {
      if (!cancelled) setStatus(result);
    });

    return () => {
      cancelled = true;
      unsubscribe();
      void mic.stop();
      microphone.current = null;
      detector.current = null;
      medianFilter.clear();
      smootherFilter.clear();
      setReading(null);
      setStatus('idle');
    };
  }, [active, handleFrame]);

  return { reading, status, level };
}
