import type { ChordMastery } from './types';

import { getStorage } from './index';

export const MAX_MASTERY_LEVEL = 5;

/** The level at which a chord counts as usable in a real song. */
export const PLAYABLE_MASTERY_LEVEL = 3;

/** The level at which the library calls a chord "mastered". */
export const MASTERED_LEVEL = 4;

export function getAllChordMastery(): Map<string, ChordMastery> {
  return new Map(getStorage().getAllChordMastery().map((entry) => [entry.chordId, entry]));
}

export function getChordMastery(chordId: string): ChordMastery | null {
  return getStorage().getChordMastery(chordId);
}

/** Chord ids the learner can already play well enough to use in a song. */
export function getPlayableChordIds(): Set<string> {
  return new Set(getStorage().getChordIdsAtOrAboveLevel(PLAYABLE_MASTERY_LEVEL));
}

export type { ChordMastery };
