import {
  COMMON_TIME,
  beatDurationSeconds,
  buildGrid,
  nearestStep,
  stepDurationSeconds,
  stepsPerBar,
} from '../grid';

describe('durations', () => {
  it('derives beat length from tempo', () => {
    expect(beatDurationSeconds(120)).toBeCloseTo(0.5, 10);
    expect(beatDurationSeconds(60)).toBeCloseTo(1, 10);
    expect(beatDurationSeconds(90)).toBeCloseTo(0.6666667, 6);
  });

  it('rejects a nonsensical tempo', () => {
    expect(() => beatDurationSeconds(0)).toThrow();
    expect(() => beatDurationSeconds(-120)).toThrow();
  });

  it('derives step length from the note value, not from the beat count', () => {
    // 4/4 at 120: quarter 0.5s, eighth 0.25s, sixteenth 0.125s.
    expect(stepDurationSeconds(120, 4, 4)).toBeCloseTo(0.5, 10);
    expect(stepDurationSeconds(120, 4, 8)).toBeCloseTo(0.25, 10);
    expect(stepDurationSeconds(120, 4, 16)).toBeCloseTo(0.125, 10);
    // 6/8 at 120: the beat *is* an eighth, so an eighth step equals a beat.
    expect(stepDurationSeconds(120, 8, 8)).toBeCloseTo(0.5, 10);
  });
});

describe('stepsPerBar', () => {
  it('handles the common time signatures', () => {
    expect(stepsPerBar({ beatsPerBar: 4, beatUnit: 4 }, 8)).toBe(8);
    expect(stepsPerBar({ beatsPerBar: 4, beatUnit: 4 }, 4)).toBe(4);
    expect(stepsPerBar({ beatsPerBar: 4, beatUnit: 4 }, 16)).toBe(16);
    expect(stepsPerBar({ beatsPerBar: 3, beatUnit: 4 }, 8)).toBe(6);
    expect(stepsPerBar({ beatsPerBar: 6, beatUnit: 8 }, 8)).toBe(6);
  });

  it('refuses a subdivision that does not divide the bar evenly', () => {
    expect(() => stepsPerBar({ beatsPerBar: 3, beatUnit: 8 }, 4)).toThrow();
  });
});

describe('buildGrid', () => {
  it('places every click exactly on the beat', () => {
    const grid = buildGrid({ bpm: 120, bars: 2, countInBars: 0 });

    expect(grid.beats).toHaveLength(8);
    grid.beats.forEach((beat, index) => {
      expect(beat.time).toBeCloseTo(index * 0.5, 10);
    });
  });

  it('accents the first beat of each bar and nothing else', () => {
    const grid = buildGrid({ bpm: 100, bars: 3, countInBars: 0 });
    const downbeats = grid.beats.filter((beat) => beat.isDownbeat).map((beat) => beat.time);
    expect(downbeats).toHaveLength(3);
    expect(grid.beats[0]!.isDownbeat).toBe(true);
    expect(grid.beats[1]!.isDownbeat).toBe(false);
  });

  it('offsets the performance by the count-in', () => {
    const grid = buildGrid({ bpm: 120, bars: 1, countInBars: 1 });

    // One bar of 4/4 at 120 BPM is two seconds of clicks before playing starts.
    expect(grid.leadInSeconds).toBeCloseTo(2, 10);
    expect(grid.steps[0]!.time).toBeCloseTo(2, 10);
    expect(grid.beats.filter((beat) => beat.isCountIn)).toHaveLength(4);
  });

  it('numbers count-in bars negatively so bar 0 is where playing begins', () => {
    const grid = buildGrid({ bpm: 120, bars: 2, countInBars: 1 });
    expect(grid.beats[0]!.bar).toBe(-1);
    expect(grid.beats[4]!.bar).toBe(0);
    expect(grid.steps[0]!.bar).toBe(0);
  });

  it('spaces strum steps evenly across the performance', () => {
    const grid = buildGrid({ bpm: 120, bars: 2, countInBars: 0, subdivision: 8 });

    expect(grid.steps).toHaveLength(16);
    grid.steps.forEach((step, index) => {
      expect(step.time).toBeCloseTo(index * 0.25, 10);
    });
  });

  it('lines strum steps up with the beats they fall on', () => {
    const grid = buildGrid({ bpm: 90, bars: 2, countInBars: 1, subdivision: 8 });
    const performedBeats = grid.beats.filter((beat) => !beat.isCountIn);

    // With eighth-note steps, every other step must land exactly on a beat.
    performedBeats.forEach((beat, index) => {
      expect(grid.steps[index * 2]!.time).toBeCloseTo(beat.time, 10);
    });
  });

  it('slows the whole grid down for practice tempo without changing the pattern', () => {
    const full = buildGrid({ bpm: 120, bars: 2, countInBars: 1 });
    const slow = buildGrid({ bpm: 120, bars: 2, countInBars: 1, tempoFraction: 0.5 });

    expect(slow.effectiveBpm).toBe(60);
    expect(slow.steps).toHaveLength(full.steps.length);
    expect(slow.totalSeconds).toBeCloseTo(full.totalSeconds * 2, 10);
  });

  it('handles 3/4 and 6/8', () => {
    const waltz = buildGrid({
      bpm: 120,
      bars: 2,
      countInBars: 0,
      timeSignature: { beatsPerBar: 3, beatUnit: 4 },
    });
    expect(waltz.stepsPerBar).toBe(6);
    expect(waltz.beats).toHaveLength(6);

    const jig = buildGrid({
      bpm: 120,
      bars: 2,
      countInBars: 0,
      timeSignature: { beatsPerBar: 6, beatUnit: 8 },
    });
    expect(jig.stepsPerBar).toBe(6);
    expect(jig.steps).toHaveLength(12);
  });

  it('does not drift over a long session', () => {
    // Three minutes at 120 BPM. Accumulated error here would silently corrupt
    // every timing score the app ever reports.
    const grid = buildGrid({ bpm: 120, bars: 90, countInBars: 0 });
    const last = grid.beats[grid.beats.length - 1]!;
    expect(last.time).toBeCloseTo((grid.beats.length - 1) * 0.5, 9);
    expect(grid.totalSeconds).toBeCloseTo(180, 9);
  });

  it('rejects an empty performance', () => {
    expect(() => buildGrid({ bpm: 120, bars: 0 })).toThrow();
  });
});

describe('nearestStep', () => {
  const grid = buildGrid({ bpm: 120, bars: 2, countInBars: 1, subdivision: 8 });

  it('reports a negative deviation when the player is early', () => {
    const target = grid.steps[4]!;
    const match = nearestStep(grid, target.time - 0.04);

    expect(match!.step.index).toBe(4);
    expect(match!.deviationSeconds).toBeCloseTo(-0.04, 10);
  });

  it('reports a positive deviation when the player is late', () => {
    const target = grid.steps[7]!;
    const match = nearestStep(grid, target.time + 0.03);

    expect(match!.step.index).toBe(7);
    expect(match!.deviationSeconds).toBeCloseTo(0.03, 10);
  });

  it('snaps to the closer of two neighbouring steps', () => {
    const midpoint = (grid.steps[2]!.time + grid.steps[3]!.time) / 2;
    expect(nearestStep(grid, midpoint - 0.01)!.step.index).toBe(2);
    expect(nearestStep(grid, midpoint + 0.01)!.step.index).toBe(3);
  });

  it('clamps to the grid rather than inventing steps outside it', () => {
    expect(nearestStep(grid, -5)!.step.index).toBe(0);
    expect(nearestStep(grid, 9999)!.step.index).toBe(grid.steps.length - 1);
  });

  it('is exact on the step itself', () => {
    for (const step of grid.steps) {
      const match = nearestStep(grid, step.time)!;
      expect(match.step.index).toBe(step.index);
      expect(match.deviationSeconds).toBeCloseTo(0, 10);
    }
  });

  it('agrees with the time signature it was built from', () => {
    expect(grid.timeSignature).toEqual(COMMON_TIME);
  });
});
