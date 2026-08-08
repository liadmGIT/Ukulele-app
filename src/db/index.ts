import { Platform } from 'react-native';

import { MemoryDriver } from './memoryDriver';
import type { StorageDriver } from './types';

let driver: StorageDriver | null = null;

/**
 * The app's storage. SQLite on device; an in-memory stand-in in the browser,
 * where the app runs as a UI preview only (see `memoryDriver.ts`).
 */
export function getStorage(): StorageDriver {
  if (driver) return driver;

  if (Platform.OS === 'web') {
    driver = new MemoryDriver();
  } else {
    // Required lazily so the web bundle never evaluates expo-sqlite.
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { SqliteDriver } = require('./sqliteDriver') as typeof import('./sqliteDriver');
    driver = new SqliteDriver();
  }

  return driver;
}

/** Test seam: drops the cached driver so the next call builds a fresh one. */
export function resetStorage(): void {
  driver = null;
}

export const SETTING_KEYS = {
  language: 'language',
  contentVersion: 'content_version',
  micLatencyMs: 'mic_latency_ms',
  noiseFloorDb: 'noise_floor_db',
} as const;

export function getSetting(key: string): string | null {
  return getStorage().getSetting(key);
}

export function setSetting(key: string, value: string): void {
  getStorage().setSetting(key, value);
}

export type { ChordMastery, StorageDriver } from './types';
