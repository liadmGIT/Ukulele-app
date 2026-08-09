import { getChordLibrary, getSongs, getStrumPatterns } from '@/content';

import { SETTING_KEYS, getSetting, getStorage, setSetting } from './index';

/**
 * Copies the bundled content into storage so user progress can be joined
 * against it. Content rows are disposable and rebuilt whenever the bundled
 * version changes; user rows are never touched.
 *
 * Idempotent — returns immediately once storage already holds this version.
 */
export function syncContent(): void {
  const library = getChordLibrary();
  const patterns = getStrumPatterns();
  const songs = getSongs();

  // All three files, not just the chords. Each carries its own version, and
  // keying off `chords.json` alone meant adding a song and bumping only
  // `songs.json` changed nothing: the sync returned early and the Songs tab
  // kept serving the old rows forever, with no sign anything was stale.
  const bundledVersion = [library.version, patternsVersion(patterns), songsVersion(songs)].join('.');

  if (getSetting(SETTING_KEYS.contentVersion) === bundledVersion) return;

  getStorage().replaceContent({
    chords: library.chords,
    patterns: patterns.map((pattern) => ({
      id: pattern.id,
      nameEn: pattern.nameEn,
      nameHe: pattern.nameHe,
      beatsPerBar: pattern.timeSignature.beatsPerBar,
      beatUnit: pattern.timeSignature.beatUnit as 4 | 8,
      subdivision: pattern.subdivision,
      notation: pattern.notation,
      difficulty: pattern.difficulty,
      descriptionEn: pattern.descriptionEn,
      descriptionHe: pattern.descriptionHe,
    })),
    songs: songs.map((song) => ({ ...song, chordIds: song.timeline.chordIds })),
  });

  setSetting(SETTING_KEYS.contentVersion, bundledVersion);
}

/**
 * Content counts stand in for versions the loaders do not expose.
 *
 * Not a true version — editing a song in place without adding one would not
 * change it — but it catches the case that actually happens, which is content
 * being added. Regenerating from the scripts bumps the chord library version
 * anyway, and that is part of the key.
 */
function patternsVersion(patterns: readonly unknown[]): number {
  return patterns.length;
}

function songsVersion(songs: readonly unknown[]): number {
  return songs.length;
}
