import type { GridOptions, PracticeGrid } from '@/music/grid';
import { buildGrid } from '@/music/grid';

import { audioNow, getAudioContext } from './engine';

/**
 * A metronome that does not drift.
 *
 * The naive approach — `setInterval` firing a click every beat — drifts audibly
 * within a minute, because JS timers are best-effort and every scheduling delay
 * accumulates. That would be bad enough on its own, but here it would also
 * corrupt every timing score the app reports, since the analysis assumes the
 * clicks were where the grid says they were.
 *
 * So: a JS timer wakes up frequently and only *schedules* clicks, each one
 * pinned to an exact `AudioContext` time computed from the grid. The timer can
 * be late by tens of milliseconds without moving a single click, because the
 * audio thread renders them at the times they were booked for.
 */

/** How often the scheduler wakes up. */
const LOOKAHEAD_INTERVAL_MS = 25;
/** How far ahead it books clicks. Must comfortably exceed the wake interval. */
const SCHEDULE_AHEAD_SECONDS = 0.2;

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

/**
 * Seams for testing. The real implementations read the audio clock and build
 * oscillators; a test supplies a clock it controls and records the bookings,
 * which is how the no-drift guarantee is actually proved rather than asserted.
 */
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

  private timer: ReturnType<typeof setInterval> | null = null;
  private nextBeatIndex = 0;
  private startTime = 0;
  private running = false;
  /** Set when the metronome repeats forever rather than for a fixed length. */
  private looping = false;

  constructor(
    options: GridOptions,
    callbacks: MetronomeCallbacks = {},
    deps: Partial<MetronomeDeps> = {},
  ) {
    this.grid = buildGrid(options);
    this.callbacks = callbacks;
    this.deps = { ...defaultDeps, ...deps };
  }

  /** The grid this metronome is playing — the same one the analysis aligns to. */
  getGrid(): PracticeGrid {
    return this.grid;
  }

  isRunning(): boolean {
    return this.running;
  }

  /**
   * Audio-clock time the count-in began. Every expected beat and step time is
   * this plus its offset in the grid, which is how a recording made during
   * playback is aligned afterwards.
   */
  getStartTime(): number {
    return this.startTime;
  }

  /** Rebuilds the grid, e.g. after the learner moves the tempo slider. */
  setOptions(options: GridOptions): void {
    const wasRunning = this.running;
    const wasLooping = this.looping;
    if (wasRunning) this.stop();
    this.grid = buildGrid(options);
    if (wasRunning) this.start({ loop: wasLooping });
  }

  start({ loop = false }: { loop?: boolean } = {}): number {
    if (this.running) return this.startTime;

    this.looping = loop;
    this.nextBeatIndex = 0;
    // A small offset so the first click is scheduled rather than already due.
    this.startTime = this.deps.now() + 0.1;
    this.running = true;

    this.callbacks.onStart?.(this.startTime);
    this.pump();
    this.timer = setInterval(() => this.pump(), LOOKAHEAD_INTERVAL_MS);

    return this.startTime;
  }

  stop(): void {
    if (this.timer !== null) {
      clearInterval(this.timer);
      this.timer = null;
    }
    this.running = false;
  }

  /**
   * Books every click that falls inside the lookahead window.
   *
   * Public only so tests can drive it from a controlled clock instead of
   * waiting on a real timer.
   */
  pump(): void {
    if (!this.running) return;

    const horizon = this.deps.now() + SCHEDULE_AHEAD_SECONDS;
    const beats = this.grid.beats;

    while (this.nextBeatIndex < beats.length) {
      const beat = beats[this.nextBeatIndex]!;
      const when = this.startTime + beat.time;
      if (when > horizon) return;

      this.deps.scheduleClick(when, beat.isDownbeat);
      this.callbacks.onBeat?.({
        index: this.nextBeatIndex,
        bar: beat.bar,
        beat: beat.beat,
        isDownbeat: beat.isDownbeat,
        isCountIn: beat.isCountIn,
        when,
      });

      this.nextBeatIndex += 1;
    }

    if (this.looping) {
      // Re-anchor to the end of the pattern rather than to "now". Anchoring to
      // the current time would fold the scheduler's own lateness into the next
      // repeat, reintroducing exactly the drift this class exists to avoid.
      this.startTime += this.grid.totalSeconds;
      this.nextBeatIndex = 0;
      return;
    }

    // Let the last click actually sound before reporting completion.
    if (this.deps.now() >= this.startTime + this.grid.totalSeconds) {
      this.stop();
      this.callbacks.onFinish?.();
    }
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
