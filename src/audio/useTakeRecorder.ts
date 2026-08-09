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
  /**
   * Wall-clock time the take finished, or null before one has.
   *
   * A property of the take rather than of whoever reads it: mastery and the
   * practice log both need to agree on when this happened, and reading the
   * clock at render time would give each caller a slightly different answer.
   */
  completedAt: number | null;
  /** Seconds recorded so far. */
  elapsed: number;
  /**
   * @returns the status reached, so a caller can avoid starting playback into a
   * recording that never began.
   */
  start: () => Promise<MicrophoneStatus>;
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
  /**
   * Null while the thing being played has no grid yet — a song screen opened
   * with an unknown id, say. Recording is simply inert until there is something
   * to measure against.
   */
  grid: PracticeGrid | null;
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
  const [completedAt, setCompletedAt] = useState<number | null>(null);

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
    // `isRecording` is only set after the await below, so an impatient double
    // tap would otherwise build a second Microphone and orphan the first —
    // leaving a recorder nothing can stop and the mic indicator lit.
    if (isRecording || microphone.current) return 'running';

    setAnalysis(null);
    setReview(null);
    setCompletedAt(null);
    setElapsed(0);

    const mic = new Microphone();
    microphone.current = mic;

    const result = await mic.start({ capture: true, bufferLength: 1024, windowSize: 2048 });
    setStatus(result);
    if (result !== 'running') {
      microphone.current = null;
      return result;
    }

    recordingStartedAt.current = audioNow();
    setIsRecording(true);

    ticker.current = setInterval(() => {
      setElapsed(audioNow() - recordingStartedAt.current);
    }, 200);

    return result;
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

    const recording = mic.takeRecording();
    microphone.current = null;

    if (recording.samples.length === 0 || !grid) return;

    // Where the grid sits inside the recording. The two clocks are the same
    // clock, so this is a subtraction rather than an estimate.
    const gridOffset = (gridStartTime ?? recordingStartedAt.current) - recordingStartedAt.current;

    const shifted = shiftGrid(grid, gridOffset);
    const result = analyseTake({
      samples: recording.samples,
      // The rate the hardware actually used. Assuming 44.1 kHz here while the
      // phone records at 48 kHz stretches every onset time by 8.8%, which turns
      // a metronome-perfect take into one that appears to drag further behind
      // with every strum.
      sampleRate: recording.sampleRate,
      steps,
      grid: shifted,
      latencySeconds,
      level,
    });

    setAnalysis(result);
    setReview(generateReview(result.metrics, result.toleranceMs));
    setCompletedAt(Date.now());
  }, [grid, steps, latencySeconds, level, stopTicker]);

  const clear = useCallback(() => {
    setAnalysis(null);
    setReview(null);
    setCompletedAt(null);
    setElapsed(0);
  }, []);

  useEffect(() => {
    return () => {
      stopTicker();
      void microphone.current?.stop();
      microphone.current = null;
    };
  }, [stopTicker]);

  return { status, isRecording, analysis, review, completedAt, elapsed, start, stop, clear };
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
