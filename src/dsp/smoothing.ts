/**
 * Reading stabilisation.
 *
 * Raw pitch estimates jitter by a few cents frame to frame even on a perfectly
 * steady note. Shown directly, the needle twitches and the learner cannot tell
 * whether they are sharp or just watching noise. A median is the right tool
 * rather than an average: it ignores the occasional wild outlier (a fret buzz,
 * a neighbouring string ringing) instead of being dragged by it.
 */

export class MedianFilter {
  private readonly values: number[] = [];

  constructor(readonly size: number) {
    if (size <= 0) throw new Error(`size must be positive, got ${size}`);
  }

  get count(): number {
    return this.values.length;
  }

  push(value: number): number {
    this.values.push(value);
    if (this.values.length > this.size) this.values.shift();
    return this.value();
  }

  /** Median of the values seen so far; NaN while empty. */
  value(): number {
    if (this.values.length === 0) return Number.NaN;

    const sorted = [...this.values].sort((a, b) => a - b);
    const middle = Math.floor(sorted.length / 2);

    return sorted.length % 2 === 1
      ? sorted[middle]!
      : (sorted[middle - 1]! + sorted[middle]!) / 2;
  }

  clear(): void {
    this.values.length = 0;
  }
}

/**
 * Exponential smoothing, for values that should glide rather than jump — the
 * needle's drawn position once the median has removed the outliers.
 */
export class ExponentialSmoother {
  private current: number | null = null;

  /** @param alpha 0..1 — higher follows the input faster. */
  constructor(readonly alpha: number) {
    if (alpha <= 0 || alpha > 1) throw new Error(`alpha must be in (0, 1], got ${alpha}`);
  }

  push(value: number): number {
    this.current = this.current === null ? value : this.current + this.alpha * (value - this.current);
    return this.current;
  }

  value(): number | null {
    return this.current;
  }

  clear(): void {
    this.current = null;
  }
}
