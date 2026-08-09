import { ChromaAnalyser, chromaSimilarity } from './chroma';
import { detectOnsets, type Onset } from './onset';

/**
 * Counting chord *changes* in a recording.
 *
 * The classic beginner exercise is sixty seconds of switching between two
 * chords, counting how many changes you manage. Counting strums would be much
 * easier, and wrong: a learner who freezes on the change and keeps strumming
 * the same chord would score well for doing the one thing the drill exists to
 * fix.
 *
 * So each strum is reduced to a chroma profile and compared with the one
 * before it. Two strums of the same chord look nearly identical; a change looks
 * clearly different. That distinction is what the drill actually measures.
 */

export type ChangeDetectionOptions = {
  sampleRate: number;
  /**
   * Below this similarity, two consecutive strums count as different chords.
   *
   * Set from measurement rather than feel. Across the synthetic drills used in
   * the tests, repeats of one chord sit at 0.89 and above, while a change lands
   * at 0.78 or below — including C to A minor, which share two of their three
   * notes and are the hardest realistic pair to tell apart. 0.82 sits in that
   * gap with room either side.
   */
  changeThreshold?: number;
  /** Analysis window per strum. Long enough to include the chord's sustain. */
  windowSize?: number;
  /**
   * Minimum gap between strums.
   *
   * Longer than the general-purpose default because this drill's tempo is
   * bounded: even a very fast learner changes chords two or three times a
   * second, so 150 ms cannot merge two real changes, and it does fuse the
   * double detection a chord change can produce when the new chord's strings
   * arrive while the old one is still ringing.
   */
  minimumSeparationSeconds?: number;
};

export type ChangeDetectionResult = {
  /** How many times the chord actually changed. */
  changes: number;
  /** Every strum found, whether or not it changed the chord. */
  onsets: Onset[];
  /** Similarity between each strum and the one before it; first entry is 1. */
  similarities: number[];
};

const DEFAULT_THRESHOLD = 0.82;
const DEFAULT_SEPARATION_SECONDS = 0.15;

/** The first strum sets the reference chord; changes are counted after it. */
const FIRST_COUNTED_INDEX = 2;

export function countChordChanges(
  samples: Float32Array,
  options: ChangeDetectionOptions,
): ChangeDetectionResult {
  const {
    sampleRate,
    changeThreshold = DEFAULT_THRESHOLD,
    windowSize = 4096,
    minimumSeparationSeconds = DEFAULT_SEPARATION_SECONDS,
  } = options;

  const { onsets } = detectOnsets(samples, { sampleRate, minimumSeparationSeconds });
  if (onsets.length === 0) return { changes: 0, onsets: [], similarities: [] };

  const analyser = new ChromaAnalyser(sampleRate, windowSize);
  // Measured a little after the attack: the transient itself is broadband and
  // says more about how the string was struck than about which chord it is.
  const offset = Math.round(0.02 * sampleRate);

  const profiles = onsets.map((onset) =>
    analyser.analyse(samples, Math.round(onset.time * sampleRate) + offset),
  );

  const similarities: number[] = [1];
  let changes = 0;

  for (let i = 1; i < profiles.length; i += 1) {
    const similarity = chromaSimilarity(profiles[i - 1]!, profiles[i]!);
    similarities.push(similarity);

    // The first comparison is skipped, and not as a fudge. Every strum's
    // analysis window contains some of what was still ringing before it — but
    // the *first* strum is preceded by silence, so its profile is
    // systematically cleaner than every later one, and comparing it against the
    // second strum comes out looking like a change even when the chord did not
    // move. Counting from the third strum removes that bias entirely, at the
    // cost of possibly missing one change in a sixty-second drill.
    if (i >= FIRST_COUNTED_INDEX && similarity < changeThreshold) changes += 1;
  }

  return { changes, onsets, similarities };
}

/** Changes per minute, the number the drill reports and charts. */
export function changesPerMinute(changes: number, durationSeconds: number): number {
  if (durationSeconds <= 0) return 0;
  return Math.round((changes / durationSeconds) * 60);
}
