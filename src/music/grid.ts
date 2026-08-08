/**
 * The rhythmic grid: exactly when every click and every strum is expected.
 *
 * This module is the hinge the whole listening engine turns on. Because the app
 * drives the metronome, the expected times are *known*, not inferred — so
 * measuring a learner's timing is a matter of comparing onsets against this
 * grid, rather than beat-tracking a shaky performance, which is a genuinely
 * hard research problem.
 *
 * The metronome schedules from this grid and the analysis aligns against the
 * same one, so the two can never disagree about where beat 3 of bar 5 was.
 *
 * Pure functions, no audio graph — every claim here is checkable in CI.
 */

export type TimeSignature = {
  beatsPerBar: number;
  /** Note value that gets the beat: 4 = quarter, 8 = eighth. */
  beatUnit: number;
};

/** Note value each strum step occupies: 8 = eighths, the usual case. */
export type Subdivision = 4 | 8 | 16;

export const COMMON_TIME: TimeSignature = { beatsPerBar: 4, beatUnit: 4 };

export type GridOptions = {
  bpm: number;
  timeSignature?: TimeSignature;
  subdivision?: Subdivision;
  /** Bars of clicks before the performance starts. */
  countInBars?: number;
  /** Bars the learner actually plays. */
  bars: number;
  /**
   * Playback speed as a fraction of the written tempo. 0.7 means "practise at
   * 70%", which slows the grid without changing the pattern.
   */
  tempoFraction?: number;
};

export type BeatMark = {
  /** Seconds from the very start, including the count-in. */
  time: number;
  /** 0-based bar, negative during the count-in. */
  bar: number;
  /** 0-based beat within the bar. */
  beat: number;
  /** True on the first beat of a bar — the accented click. */
  isDownbeat: boolean;
  isCountIn: boolean;
};

export type StepMark = {
  /** Seconds from the very start, including the count-in. */
  time: number;
  /** 0-based index among performed steps. */
  index: number;
  bar: number;
  /** 0-based step within the bar. */
  stepInBar: number;
};

export type PracticeGrid = {
  bpm: number;
  effectiveBpm: number;
  timeSignature: TimeSignature;
  subdivision: Subdivision;
  beatSeconds: number;
  stepSeconds: number;
  stepsPerBar: number;
  /** Seconds of count-in before the first performed step. */
  leadInSeconds: number;
  beats: readonly BeatMark[];
  steps: readonly StepMark[];
  totalSeconds: number;
};

export function beatDurationSeconds(bpm: number): number {
  if (bpm <= 0) throw new Error(`bpm must be positive, got ${bpm}`);
  return 60 / bpm;
}

/**
 * How long one strum step lasts.
 *
 * A beat is one `beatUnit` note, so a whole note lasts `beatUnit` beats, and a
 * subdivision note is a whole note divided by `subdivision`. This is what makes
 * 6/8 come out right rather than being special-cased.
 */
export function stepDurationSeconds(
  bpm: number,
  beatUnit: number,
  subdivision: Subdivision,
): number {
  return (beatDurationSeconds(bpm) * beatUnit) / subdivision;
}

export function stepsPerBar(timeSignature: TimeSignature, subdivision: Subdivision): number {
  const steps = (subdivision * timeSignature.beatsPerBar) / timeSignature.beatUnit;
  if (!Number.isInteger(steps)) {
    throw new Error(
      `${timeSignature.beatsPerBar}/${timeSignature.beatUnit} does not divide evenly into ${subdivision}th notes`,
    );
  }
  return steps;
}

export function buildGrid(options: GridOptions): PracticeGrid {
  const {
    bpm,
    timeSignature = COMMON_TIME,
    subdivision = 8,
    countInBars = 1,
    bars,
    tempoFraction = 1,
  } = options;

  if (bars <= 0) throw new Error(`bars must be positive, got ${bars}`);
  if (tempoFraction <= 0) throw new Error(`tempoFraction must be positive, got ${tempoFraction}`);

  const effectiveBpm = bpm * tempoFraction;
  const beatSeconds = beatDurationSeconds(effectiveBpm);
  const stepSeconds = stepDurationSeconds(effectiveBpm, timeSignature.beatUnit, subdivision);
  const perBar = stepsPerBar(timeSignature, subdivision);

  const countInBeats = countInBars * timeSignature.beatsPerBar;
  const leadInSeconds = countInBeats * beatSeconds;

  const beats: BeatMark[] = [];
  const totalBeats = countInBeats + bars * timeSignature.beatsPerBar;

  for (let i = 0; i < totalBeats; i += 1) {
    const isCountIn = i < countInBeats;
    const beatFromStart = isCountIn ? i : i - countInBeats;
    const bar = isCountIn
      ? Math.floor(i / timeSignature.beatsPerBar) - countInBars
      : Math.floor(beatFromStart / timeSignature.beatsPerBar);

    beats.push({
      time: i * beatSeconds,
      bar,
      beat: beatFromStart % timeSignature.beatsPerBar,
      isDownbeat: beatFromStart % timeSignature.beatsPerBar === 0,
      isCountIn,
    });
  }

  const steps: StepMark[] = [];
  const totalSteps = bars * perBar;

  for (let i = 0; i < totalSteps; i += 1) {
    steps.push({
      time: leadInSeconds + i * stepSeconds,
      index: i,
      bar: Math.floor(i / perBar),
      stepInBar: i % perBar,
    });
  }

  return {
    bpm,
    effectiveBpm,
    timeSignature,
    subdivision,
    beatSeconds,
    stepSeconds,
    stepsPerBar: perBar,
    leadInSeconds,
    beats,
    steps,
    totalSeconds: leadInSeconds + totalSteps * stepSeconds,
  };
}

export type StepMatch = {
  step: StepMark;
  /** Signed seconds: negative means the player was early (rushing). */
  deviationSeconds: number;
};

/**
 * The grid step nearest a given moment.
 *
 * Used to turn a detected onset into "you hit step 12, 40 ms early". Returns
 * null when the grid has no steps at all.
 */
export function nearestStep(grid: PracticeGrid, timeSeconds: number): StepMatch | null {
  if (grid.steps.length === 0) return null;

  // The grid is uniform, so the nearest step is arithmetic rather than a search.
  const raw = Math.round((timeSeconds - grid.leadInSeconds) / grid.stepSeconds);
  const index = Math.min(grid.steps.length - 1, Math.max(0, raw));
  const step = grid.steps[index]!;

  return { step, deviationSeconds: timeSeconds - step.time };
}
