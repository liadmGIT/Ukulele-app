/**
 * Lookahead scheduling against the audio clock.
 *
 * The naive approach — a JS timer firing each event as it comes due — drifts
 * audibly within a minute, because timers are best-effort and every delay
 * accumulates. Here that would be worse than annoying: the analysis assumes
 * events happened where the grid says they did, so a drifting scheduler would
 * silently corrupt every timing score the app reports.
 *
 * So a timer wakes up frequently and only *books* events, each pinned to an
 * exact audio-clock time. The timer can be tens of milliseconds late without
 * moving a single event, because the audio thread renders them at the times
 * they were booked for.
 *
 * Extracted from the metronome so the pattern player books its strums the same
 * way. Both feed off one grid, so clicks and strums cannot drift apart.
 */

/** How often the scheduler wakes up. */
export const LOOKAHEAD_INTERVAL_MS = 25;
/** How far ahead it books. Must comfortably exceed the wake interval. */
export const SCHEDULE_AHEAD_SECONDS = 0.2;

export type ScheduledEvent<T> = {
  /** Offset in seconds from the start of the sequence. */
  time: number;
  payload: T;
};

export type SchedulerOptions<T> = {
  events: readonly ScheduledEvent<T>[];
  /**
   * Called once per event, ahead of time. `when` is the exact audio-clock time
   * the event should sound — never "now".
   */
  onEvent: (payload: T, when: number, index: number) => void;
  /** Reads the audio clock. Injectable so tests can control time. */
  now: () => number;
  /** Length of one pass. Required for looping; also marks the end of a run. */
  totalSeconds: number;
  onFinish?: () => void;
};

export class LookaheadScheduler<T> {
  private readonly options: SchedulerOptions<T>;

  private timer: ReturnType<typeof setInterval> | null = null;
  private nextIndex = 0;
  private startTime = 0;
  private running = false;
  private looping = false;

  constructor(options: SchedulerOptions<T>) {
    this.options = options;
  }

  isRunning(): boolean {
    return this.running;
  }

  /**
   * Audio-clock time the sequence began. Every expected event time is this plus
   * its offset, which is how a recording is later aligned against the grid.
   */
  getStartTime(): number {
    return this.startTime;
  }

  /**
   * @param startTime audio-clock time to begin at. Defaults to slightly ahead
   * of now so the first event is scheduled rather than already overdue.
   */
  start({ loop = false, startTime }: { loop?: boolean; startTime?: number } = {}): number {
    if (this.running) return this.startTime;

    this.looping = loop;
    this.nextIndex = 0;
    this.startTime = startTime ?? this.options.now() + 0.1;
    this.running = true;

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
   * Books every event inside the lookahead window.
   *
   * Public so tests can drive it from a controlled clock instead of waiting on
   * a real timer.
   */
  pump(): void {
    if (!this.running) return;

    const { events, onEvent, now, totalSeconds, onFinish } = this.options;
    const horizon = now() + SCHEDULE_AHEAD_SECONDS;

    while (this.nextIndex < events.length) {
      const event = events[this.nextIndex]!;
      const when = this.startTime + event.time;
      if (when > horizon) return;

      onEvent(event.payload, when, this.nextIndex);
      this.nextIndex += 1;
    }

    if (this.looping) {
      // Re-anchor to the end of the pattern, never to "now". Anchoring to the
      // current time would fold the scheduler's own lateness into the next
      // repeat, reintroducing exactly the drift this class exists to prevent.
      this.startTime += totalSeconds;
      this.nextIndex = 0;
      return;
    }

    // Let the final event actually sound before reporting completion.
    if (now() >= this.startTime + totalSeconds) {
      this.stop();
      onFinish?.();
    }
  }
}
