/**
 * Frame accumulation for a recorded take.
 *
 * The microphone delivers audio in small chunks; analysis wants one contiguous
 * signal. Pure functions so the joining logic is testable without a device.
 */

/** Joins captured chunks into one buffer. */
export function concatFrames(frames: readonly Float32Array[]): Float32Array {
  let total = 0;
  for (const frame of frames) total += frame.length;

  const joined = new Float32Array(total);
  let offset = 0;
  for (const frame of frames) {
    joined.set(frame, offset);
    offset += frame.length;
  }
  return joined;
}

/**
 * A fixed-size window of the most recent audio.
 *
 * The tuner needs the last ~50 ms at any moment, but the microphone's chunk
 * size is chosen by the OS and may be smaller than the pitch detector's minimum
 * window. This keeps a rolling window so analysis is never starved by a small
 * hardware buffer.
 */
export class RollingWindow {
  private readonly data: Float32Array;
  private written = 0;

  constructor(readonly capacity: number) {
    if (capacity <= 0) throw new Error(`capacity must be positive, got ${capacity}`);
    this.data = new Float32Array(capacity);
  }

  /** True once enough audio has arrived to fill the window. */
  get isFull(): boolean {
    return this.written >= this.capacity;
  }

  push(frame: Float32Array): void {
    if (frame.length >= this.capacity) {
      // The incoming frame alone covers the window; keep only its tail.
      this.data.set(frame.subarray(frame.length - this.capacity));
      this.written = this.capacity;
      return;
    }

    this.data.copyWithin(0, frame.length);
    this.data.set(frame, this.capacity - frame.length);
    this.written = Math.min(this.capacity, this.written + frame.length);
  }

  /**
   * The window's contents, oldest first.
   *
   * Returns the live backing array rather than a copy — callers read it
   * immediately and a copy per frame would defeat the point of preallocating.
   */
  read(): Float32Array {
    return this.data;
  }

  clear(): void {
    this.data.fill(0);
    this.written = 0;
  }
}
