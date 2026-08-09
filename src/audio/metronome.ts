import type { BeatMark, GridOptions, PracticeGrid } from '@/music/grid';
import { buildGrid } from '@/music/grid';

import { audioNow, getAudioContext } from './engine';
import { LookaheadScheduler } from './scheduler';

/**
 * The metronome.
 *
 * All of the timing care lives in {@link LookaheadScheduler}; this class is the
 * musical part — building the grid and making the click sound.
 */

const CLICK_DURATION_SECONDS = 0.035;
const ACCENT_FREQUENCY_HZ = 1600;
const BEAT_FREQUENCY_HZ = 1000;

export type MetronomeBeatEvent = {
  /** Index into `grid.beats`. */
  index: number;
  bar: number;
  beat: number;
  isDownbeat: boolean;
  isCountIn: boolean;
  /** Audio-clock time this click sounds at. */
  when: number;
};

export type MetronomeCallbacks = {
  /**
   * Fired when a click is *scheduled*, slightly before it sounds. `when` is the
   * exact time it will sound, so a UI can schedule its own animation to match
   * rather than flashing on the callback.
   */
  onBeat?: (event: MetronomeBeatEvent) => void;
  onStart?: (startTime: number) => void;
  onFinish?: () => void;
};

export type MetronomeDeps = {
  now: () => number;
  scheduleClick: (when: number, accented: boolean) => void;
};

const defaultDeps: MetronomeDeps = {
  now: audioNow,
  scheduleClick: playClick,
};

export class Metronome {
  private grid: PracticeGrid;
  private readonly callbacks: MetronomeCallbacks;
  private readonly deps: MetronomeDeps;
  private scheduler: LookaheadScheduler<BeatMark>;

  constructor(
    options: GridOptions,
    callbacks: MetronomeCallbacks = {},
    deps: Partial<MetronomeDeps> = {},
  ) {
    this.grid = buildGrid(options);
    this.callbacks = callbacks;
    this.deps = { ...defaultDeps, ...deps };
    this.scheduler = this.buildScheduler();
  }

  private buildScheduler(): LookaheadScheduler<BeatMark> {
    return new LookaheadScheduler<BeatMark>({
      events: this.grid.beats.map((beat) => ({ time: beat.time, payload: beat })),
      totalSeconds: this.grid.totalSeconds,
      now: this.deps.now,
      onFinish: () => this.callbacks.onFinish?.(),
      onEvent: (beat, when, index) => {
        this.deps.scheduleClick(when, beat.isDownbeat);
        this.callbacks.onBeat?.({
          index,
          bar: beat.bar,
          beat: beat.beat,
          isDownbeat: beat.isDownbeat,
          isCountIn: beat.isCountIn,
          when,
        });
      },
    });
  }

  /** The grid this metronome is playing — the same one the analysis aligns to. */
  getGrid(): PracticeGrid {
    return this.grid;
  }

  isRunning(): boolean {
    return this.scheduler.isRunning();
  }

  getStartTime(): number {
    return this.scheduler.getStartTime();
  }

  /** Rebuilds the grid, e.g. after the learner moves the tempo. */
  setOptions(options: GridOptions): void {
    const wasRunning = this.isRunning();
    this.scheduler.stop();
    this.grid = buildGrid(options);
    this.scheduler = this.buildScheduler();
    if (wasRunning) this.start();
  }

  start({ loop = false }: { loop?: boolean } = {}): number {
    if (this.scheduler.isRunning()) return this.scheduler.getStartTime();

    const startTime = this.scheduler.start({ loop });
    this.callbacks.onStart?.(startTime);
    return startTime;
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
 * One click: a short sine burst with a fast exponential decay.
 *
 * Shaped rather than a raw gated oscillator because an abrupt cut produces a
 * click-on-the-click — a broadband transient that the onset detector would
 * later have to tell apart from the learner's strum.
 */
function playClick(when: number, accented: boolean): void {
  const context = getAudioContext();

  const oscillator = context.createOscillator();
  oscillator.type = 'sine';
  oscillator.frequency.value = accented ? ACCENT_FREQUENCY_HZ : BEAT_FREQUENCY_HZ;

  const gain = context.createGain();
  const peak = accented ? 0.9 : 0.55;
  gain.gain.setValueAtTime(0.0001, when);
  gain.gain.exponentialRampToValueAtTime(peak, when + 0.002);
  gain.gain.exponentialRampToValueAtTime(0.0001, when + CLICK_DURATION_SECONDS);

  oscillator.connect(gain);
  gain.connect(context.destination);

  oscillator.start(when);
  oscillator.stop(when + CLICK_DURATION_SECONDS + 0.01);
}
