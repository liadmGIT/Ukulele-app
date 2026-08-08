import { ExponentialSmoother, MedianFilter } from '../smoothing';

describe('MedianFilter', () => {
  it('rejects a nonsensical size', () => {
    expect(() => new MedianFilter(0)).toThrow();
  });

  it('is NaN before it has seen anything', () => {
    expect(Number.isNaN(new MedianFilter(3).value())).toBe(true);
  });

  it('returns the middle value for an odd window', () => {
    const filter = new MedianFilter(3);
    filter.push(10);
    filter.push(30);
    expect(filter.push(20)).toBe(20);
  });

  it('averages the middle pair for an even window', () => {
    const filter = new MedianFilter(4);
    [10, 20, 30, 40].forEach((value) => filter.push(value));
    expect(filter.value()).toBe(25);
  });

  it('ignores a single wild outlier', () => {
    // The case this exists for: one frame catches a fret buzz and reports a
    // frequency an octave off. An average would drag the needle; a median
    // does not move at all.
    const filter = new MedianFilter(5);
    [440, 441, 880, 440, 439].forEach((value) => filter.push(value));
    expect(filter.value()).toBe(440);
  });

  it('drops the oldest value once full', () => {
    const filter = new MedianFilter(3);
    [1, 2, 3, 100, 100].forEach((value) => filter.push(value));
    expect(filter.count).toBe(3);
    expect(filter.value()).toBe(100);
  });

  it('clears back to empty', () => {
    const filter = new MedianFilter(3);
    filter.push(5);
    filter.clear();
    expect(filter.count).toBe(0);
  });
});

describe('ExponentialSmoother', () => {
  it('rejects an alpha outside (0, 1]', () => {
    expect(() => new ExponentialSmoother(0)).toThrow();
    expect(() => new ExponentialSmoother(1.5)).toThrow();
  });

  it('adopts the first value exactly', () => {
    expect(new ExponentialSmoother(0.2).push(42)).toBe(42);
  });

  it('moves towards a new value without jumping to it', () => {
    const smoother = new ExponentialSmoother(0.5);
    smoother.push(0);
    expect(smoother.push(10)).toBeCloseTo(5, 10);
    expect(smoother.push(10)).toBeCloseTo(7.5, 10);
  });

  it('converges on a held value', () => {
    const smoother = new ExponentialSmoother(0.3);
    smoother.push(0);
    for (let i = 0; i < 60; i += 1) smoother.push(100);
    expect(smoother.value()).toBeCloseTo(100, 5);
  });

  it('follows instantly at alpha 1', () => {
    const smoother = new ExponentialSmoother(1);
    smoother.push(0);
    expect(smoother.push(99)).toBe(99);
  });
});
