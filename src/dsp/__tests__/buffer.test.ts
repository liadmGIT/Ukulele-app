import { RollingWindow, concatFrames } from '../buffer';

describe('concatFrames', () => {
  it('joins chunks in order', () => {
    const joined = concatFrames([
      Float32Array.from([1, 2]),
      Float32Array.from([3]),
      Float32Array.from([4, 5, 6]),
    ]);
    expect([...joined]).toEqual([1, 2, 3, 4, 5, 6]);
  });

  it('handles an empty take', () => {
    expect(concatFrames([]).length).toBe(0);
  });
});

describe('RollingWindow', () => {
  it('rejects a nonsensical capacity', () => {
    expect(() => new RollingWindow(0)).toThrow();
  });

  it('is not full until enough audio has arrived', () => {
    const window = new RollingWindow(4);
    expect(window.isFull).toBe(false);

    window.push(Float32Array.from([1, 2]));
    expect(window.isFull).toBe(false);

    window.push(Float32Array.from([3, 4]));
    expect(window.isFull).toBe(true);
  });

  it('keeps the most recent samples, oldest first', () => {
    const window = new RollingWindow(4);
    window.push(Float32Array.from([1, 2, 3, 4]));
    window.push(Float32Array.from([5, 6]));

    expect([...window.read()]).toEqual([3, 4, 5, 6]);
  });

  it('keeps only the tail when one frame overflows the window', () => {
    const window = new RollingWindow(3);
    window.push(Float32Array.from([1, 2, 3, 4, 5]));

    expect([...window.read()]).toEqual([3, 4, 5]);
    expect(window.isFull).toBe(true);
  });

  it('assembles a full analysis window from undersized hardware frames', () => {
    // The real case this exists for: the OS hands back 256-sample chunks but
    // the pitch detector needs 2048 to resolve the ukulele's lowest note.
    const window = new RollingWindow(2048);
    let value = 0;

    for (let i = 0; i < 8; i += 1) {
      const chunk = new Float32Array(256);
      for (let j = 0; j < chunk.length; j += 1) chunk[j] = value++;
      window.push(chunk);
    }

    expect(window.isFull).toBe(true);
    const data = window.read();
    expect(data[0]).toBe(0);
    expect(data[2047]).toBe(2047);
  });

  it('clears back to an empty state', () => {
    const window = new RollingWindow(3);
    window.push(Float32Array.from([1, 2, 3]));
    window.clear();

    expect(window.isFull).toBe(false);
    expect([...window.read()]).toEqual([0, 0, 0]);
  });
});
