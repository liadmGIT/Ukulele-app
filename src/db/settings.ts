import { SETTING_KEYS, getSetting, setSetting } from './index';

/**
 * Preferences the learner can change.
 *
 * Haptics default to on: a tap on the downbeat is a genuine help when your eyes
 * are on your hands rather than the screen. It is a reinforcement cue and never
 * a timing reference — haptic latency on iOS is not tight enough to be trusted
 * as a beat, which is why nothing measures against it.
 */
export function getHapticsEnabled(): boolean {
  return getSetting(SETTING_KEYS.haptics) !== 'off';
}

export function setHapticsEnabled(enabled: boolean): void {
  setSetting(SETTING_KEYS.haptics, enabled ? 'on' : 'off');
}
