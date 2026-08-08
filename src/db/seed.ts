import { getChordLibrary } from '@/content';

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

  getStorage().replaceChords(library.chords);
  setSetting(SETTING_KEYS.contentVersion, bundledVersion);
}
