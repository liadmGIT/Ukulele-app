import { useCallback, useEffect, useRef, useState } from 'react';

import { analyseTake, type TakeAnalysis } from '@/analysis/performance';
import { generateReview, type Review } from '@/analysis/review';
import type { PracticeGrid } from '@/music/grid';
import type { StrumStep } from '@/music/strum';

import { audioNow } from './engine';
import { Microphone, type MicrophoneStatus } from './microphone';

/**
 * Recording a take and reviewing it.
 *
 * The recording and the metronome share the audio clock, which is the whole
 * reason the analysis can be exact: `recordingStartedAt` and the grid's start
 * time are two points on one timeline, so an onset's position within the take
 * converts to a position on the grid without any inference.
 */

export type TakeRecorderState = {
  status: MicrophoneStatus;
  isRecording: boolean;
  /** Populated when a take has been analysed. */
  analysis: TakeAnalysis | null;
  review: Review | null;
  /** Seconds recorded so far. */
  elapsed: number;
  start: () => Promise<void>;
  /**
   * @param gridStartTime audio-clock time the metronome's count-in began.
   * Passed at stop time rather than captured at render, so it reflects the run
   * that just happened.
   */
  stop: (gridStartTime?: number) => Promise<void>;
  clear: () => void;
};

export type UseTakeRecorderOptions = {
  steps: readonly StrumStep[];
  grid: PracticeGrid;
  /** Measured microphone latency in seconds; see the calibration screen. */
  latencySeconds?: number;
  level?: number;
};

export function useTakeRecorder({
  steps,
  grid,
  latencySeconds = 0,
  level = 0,
}: UseTakeRecorderOptions): TakeRecorderState {
  const [status, setStatus] = useState<MicrophoneStatus>('idle');
  const [isRecording, setIsRecording] = useState(false);
  const [analysis, setAnalysis] = useState<TakeAnalysis | null>(null);
  const [review, setReview] = useState<Review | null>(null);
  const [elapsed, setElapsed] = useState(0);

  const microphone = useRef<Microphone | null>(null);
  const recordingStartedAt = useRef(0);
  const ticker = useRef<ReturnType<typeof setInterval> | null>(null);

  const stopTicker = useCallback(() => {
    if (ticker.current !== null) {
      clearInterval(ticker.current);
      ticker.current = null;
    }
  }, []);

  const start = useCallback(async () => {
    if (isRecording) return;

    setAnalysis(null);
    setReview(null);
    setElapsed(0);

    const mic = new Microphone();
    microphone.current = mic;

    const result = await mic.start({ capture: true, bufferLength: 1024, windowSize: 2048 });
    setStatus(result);
    if (result !== 'running') return;

    recordingStartedAt.current = audioNow();
    setIsRecording(true);

    ticker.current = setInterval(() => {
      setElapsed(audioNow() - recordingStartedAt.current);
    }, 200);
  }, [isRecording]);

  const stop = useCallback(async (gridStartTime?: number) => {
    stopTicker();

    const mic = microphone.current;
    if (!mic) {
      setIsRecording(false);
      return;
    }

    await mic.stop();
    setIsRecording(false);

    const samples = mic.takeRecording();
    microphone.current = null;

    if (samples.length === 0) return;

    // Where the grid sits inside the recording. The two clocks are the same
    // clock, so this is a subtraction rather than an estimate.
    const gridOffset = (gridStartTime ?? recordingStartedAt.current) - recordingStartedAt.current;

    const shifted = shiftGrid(grid, gridOffset);
    const result = analyseTake({
      samples,
      sampleRate: 44100,
      steps,
      grid: shifted,
      latencySeconds,
      level,
    });

    setAnalysis(result);
    setReview(generateReview(result.metrics, result.toleranceMs));
  }, [grid, steps, latencySeconds, level, stopTicker]);

  const clear = useCallback(() => {
    setAnalysis(null);
    setReview(null);
    setElapsed(0);
  }, []);

  useEffect(() => {
    return () => {
      stopTicker();
      void microphone.current?.stop();
      microphone.current = null;
    };
  }, [stopTicker]);

  return { status, isRecording, analysis, review, elapsed, start, stop, clear };
}

/** Moves every time in a grid by a constant, so it lines up with a recording. */
function shiftGrid(grid: PracticeGrid, offsetSeconds: number): PracticeGrid {
  if (offsetSeconds === 0) return grid;

  return {
    ...grid,
    leadInSeconds: grid.leadInSeconds + offsetSeconds,
    beats: grid.beats.map((beat) => ({ ...beat, time: beat.time + offsetSeconds })),
    steps: grid.steps.map((step) => ({ ...step, time: step.time + offsetSeconds })),
  };
}
