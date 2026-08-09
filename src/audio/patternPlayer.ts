import {
  buildGrid,
  type BeatMark,
  type PracticeGrid,
  type StepMark,
  type Subdivision,
  type TimeSignature,
} from '@/music/grid';
import { patternBars, type StrumStep } from '@/music/strum';

import { audioNow } from './engine';
import { LookaheadScheduler } from './scheduler';
import { Strummer } from './strummer';

/**
 * Plays a strum pattern over a chord, with the metronome running underneath.
 *
 * Clicks and strums are booked from a **single** scheduler over one merged
 * event list. They could have been two schedulers reading the same grid, but a
 * single one makes it structurally impossible for the click and the strum on
 * the same beat to end up even a millisecond apart.
 */

export type PatternEvent =
  | { kind: 'click'; beat: BeatMark }
  | { kind: 'strum'; step: StrumStep; mark: StepMark };

export type PatternPlayerOptions = {
  steps: readonly StrumStep[];
  bpm: number;
  timeSignature: TimeSignature;
  subdivision: Subdivision;
  /** Chord shape to strum, in diagram order (G C E A). */
  frets: readonly number[];
  /**
   * Chord to strum at a given step, overriding `frets`.
   *
   * A song changes chord every bar or two, so the shape is a function of
   * position rather than a constant. Patterns leave this unset and strum one
   * chord throughout.
   */
  fretsForStep?: (mark: StepMark) => readonly number[];
  countInBars?: number;
  /** 0.5 = practise at half speed. */
  tempoFraction?: number;
  /** Play the metronome click alongside the strums. */
  withClick?: boolean;
};

export type PatternPlayerCallbacks = {
  onBeat?: (beat: BeatMark, when: number) => void;
  onStep?: (step: StrumStep, mark: StepMark, when: number) => void;
  onStart?: (startTime: number) => void;
  onFinish?: () => void;
};

export type PatternPlayerDeps = {
  now: () => number;
  playClick: (when: number, accented: boolean) => void;
  strummer: Pick<Strummer, 'prepare' | 'strum'>;
};

export class PatternPlayer {
  private grid: PracticeGrid;
  private scheduler: LookaheadScheduler<PatternEvent>;
  private options: PatternPlayerOptions;
  private readonly callbacks: PatternPlayerCallbacks;
  private readonly deps: PatternPlayerDeps;

  constructor(
    options: PatternPlayerOptions,
    callbacks: PatternPlayerCallbacks = {},
    deps: Partial<PatternPlayerDeps> = {},
  ) {
    this.options = options;
    this.callbacks = callbacks;
    this.deps = {
      now: deps.now ?? audioNow,
      playClick: deps.playClick ?? (() => {}),
      strummer: deps.strummer ?? new Strummer(),
    };

    this.grid = buildGridFor(options);
    this.scheduler = this.buildScheduler();
  }

  private buildScheduler(): LookaheadScheduler<PatternEvent> {
    return new LookaheadScheduler<PatternEvent>({
      events: this.buildEvents(),
      totalSeconds: this.grid.totalSeconds,
      now: this.deps.now,
      onFinish: () => this.callbacks.onFinish?.(),
      onEvent: (event, when) => {
        if (event.kind === 'click') {
          if (this.options.withClick !== false) {
            this.deps.playClick(when, event.beat.isDownbeat);
          }
          this.callbacks.onBeat?.(event.beat, when);
          return;
        }

        this.deps.strummer.strum(when, event.step, this.fretsAt(event.mark));
        this.callbacks.onStep?.(event.step, event.mark, when);
      },
    });
  }

  /**
   * Merges clicks and strums into one time-ordered list.
   *
   * Clicks sort before strums at the same instant so the beat is established
   * before the chord lands on it — the click is a reference, not part of the
   * music.
   */
  private buildEvents() {
    const events: { time: number; payload: PatternEvent }[] = [];

    for (const beat of this.grid.beats) {
      events.push({ time: beat.time, payload: { kind: 'click', beat } });
    }

    const { steps } = this.options;
    this.grid.steps.forEach((mark, index) => {
      const step = steps[index % steps.length];
      if (!step || step.dir === 'rest') return; // nothing to schedule for a rest
      events.push({ time: mark.time, payload: { kind: 'strum', step, mark } });
    });

    return events.sort((a, b) => {
      if (a.time !== b.time) return a.time - b.time;
      return a.payload.kind === 'click' ? -1 : 1;
    });
  }

  /** The chord sounding at a step. */
  private fretsAt(mark: StepMark): readonly number[] {
    return this.options.fretsForStep?.(mark) ?? this.options.frets;
  }

  getGrid(): PracticeGrid {
    return this.grid;
  }

  isRunning(): boolean {
    return this.scheduler.isRunning();
  }

  getStartTime(): number {
    return this.scheduler.getStartTime();
  }

  setOptions(options: PatternPlayerOptions): void {
    const wasRunning = this.isRunning();
    this.scheduler.stop();
    this.options = options;
    this.grid = buildGridFor(options);
    this.scheduler = this.buildScheduler();
    if (wasRunning) this.start({ loop: true });
  }

  start({ loop = true }: { loop?: boolean } = {}): number {
    if (this.scheduler.isRunning()) return this.scheduler.getStartTime();

    // Render every chord the run will need before the first click, so a chord
    // change mid-song never lands on a buffer that is still being synthesised.
    for (const frets of this.shapesUsed()) this.deps.strummer.prepare(frets);

    const startTime = this.scheduler.start({ loop });
    this.callbacks.onStart?.(startTime);
    return startTime;
  }

  /** Every distinct chord shape this run will strum. */
  private shapesUsed(): readonly (readonly number[])[] {
    if (!this.options.fretsForStep) return [this.options.frets];

    const seen = new Map<string, readonly number[]>();
    for (const mark of this.grid.steps) {
      const frets = this.options.fretsForStep(mark);
      seen.set(frets.join(','), frets);
    }
    return [...seen.values()];
  }

  stop(): void {
    this.scheduler.stop();
  }

  /** Drives the scheduler. Exposed so tests can run it from a controlled clock. */
  pump(): void {
    this.scheduler.pump();
  }
}

/**
 * The grid a set of player options implies.
 *
 * Exported so a caller can obtain exactly the grid the player will use without
 * constructing one — a take has to be measured against the beats that actually
 * sounded, and two grids built separately from the same inputs are two things
 * that can drift apart.
 */
export function buildGridFor(options: PatternPlayerOptions): PracticeGrid {
  const { steps, timeSignature, subdivision, bpm, countInBars = 1, tempoFraction = 1 } = options;

  return buildGrid({
    bpm,
    timeSignature,
    subdivision,
    countInBars,
    tempoFraction,
    bars: patternBars(steps, timeSignature, subdivision),
  });
}
