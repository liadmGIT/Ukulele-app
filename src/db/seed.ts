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
  const bundledVersion = String(library.version);

  if (getSetting(SETTING_KEYS.contentVersion) === bundledVersion) return;

  const storage = getStorage();
  storage.replaceChords(library.chords);
  storage.replaceStrumPatterns(
    getStrumPatterns().map((pattern) => ({
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
  );

  // Songs must exist before any song progress can reference them: song_progress
  // has a foreign key onto this table and foreign keys are enforced.
  storage.replaceSongs(
    getSongs().map((song) => ({ ...song, chordIds: song.timeline.chordIds })),
  );

  setSetting(SETTING_KEYS.contentVersion, bundledVersion);
}
