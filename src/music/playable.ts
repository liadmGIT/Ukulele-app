/**
 * Which songs a learner can play right now, and what to learn next.
 *
 * This turns the song list from a wall of things you cannot play into the
 * app's motivation engine. "Learn one more chord — G — and eleven more songs
 * open up" is a far better reason to practise than a progress bar, because it
 * names a concrete reward for a specific piece of work.
 *
 * Pure functions over ids, so the ranking can be tested without a database.
 */

export type SongChordRequirement = {
  songId: string;
  chordIds: readonly string[];
};

export type UnlockSuggestion = {
  chordId: string;
  /** Songs that need only this chord on top of what is already known. */
  unlockedSongIds: string[];
  count: number;
};

export function isPlayable(
  requirement: SongChordRequirement,
  knownChordIds: ReadonlySet<string>,
): boolean {
  return requirement.chordIds.every((chordId) => knownChordIds.has(chordId));
}

export function playableSongIds(
  requirements: readonly SongChordRequirement[],
  knownChordIds: ReadonlySet<string>,
): string[] {
  return requirements
    .filter((requirement) => isPlayable(requirement, knownChordIds))
    .map((requirement) => requirement.songId);
}

/** Chords a song still needs. */
export function missingChords(
  requirement: SongChordRequirement,
  knownChordIds: ReadonlySet<string>,
): string[] {
  return requirement.chordIds.filter((chordId) => !knownChordIds.has(chordId));
}

/**
 * Which single chord would unlock the most songs, best first.
 *
 * Only counts songs that are *one* chord away. A chord that appears in fifty
 * songs the learner is still three chords short of is not the right thing to
 * practise next, and ranking by raw frequency would recommend exactly that.
 */
export function suggestNextChords(
  requirements: readonly SongChordRequirement[],
  knownChordIds: ReadonlySet<string>,
  limit = 3,
): UnlockSuggestion[] {
  const unlocks = new Map<string, string[]>();

  for (const requirement of requirements) {
    const missing = missingChords(requirement, knownChordIds);
    if (missing.length !== 1) continue;

    const chordId = missing[0]!;
    const songs = unlocks.get(chordId) ?? [];
    songs.push(requirement.songId);
    unlocks.set(chordId, songs);
  }

  return [...unlocks.entries()]
    .map(([chordId, unlockedSongIds]) => ({
      chordId,
      unlockedSongIds,
      count: unlockedSongIds.length,
    }))
    .sort((a, b) => b.count - a.count || a.chordId.localeCompare(b.chordId))
    .slice(0, limit);
}

/**
 * Orders songs so the most useful ones surface first: playable songs before
 * locked ones, then by how few chords are missing, then by difficulty.
 *
 * A learner scrolling the library should meet things they can play today before
 * anything else, without having to filter.
 */
export function rankSongs<T extends SongChordRequirement & { difficulty: number }>(
  songs: readonly T[],
  knownChordIds: ReadonlySet<string>,
): T[] {
  return [...songs].sort((a, b) => {
    const missingA = missingChords(a, knownChordIds).length;
    const missingB = missingChords(b, knownChordIds).length;
    if (missingA !== missingB) return missingA - missingB;
    if (a.difficulty !== b.difficulty) return a.difficulty - b.difficulty;
    return a.songId.localeCompare(b.songId);
  });
}
