import { AudioContext, AudioManager } from 'react-native-audio-api';

/**
 * Ownership of the single `AudioContext` the app uses.
 *
 * One context, shared by the metronome, the tuner and the chord preview synth,
 * because `AudioContext.currentTime` is the clock everything is measured
 * against — a second context would run on a second clock and the two would
 * disagree about when a beat happened.
 */

let context: AudioContext | null = null;

export function getAudioContext(): AudioContext {
  if (!context) {
    context = new AudioContext();
  }
  return context;
}

/** The audio clock, in seconds. Monotonic; unrelated to wall-clock time. */
export function audioNow(): number {
  return getAudioContext().currentTime;
}

export function getSampleRate(): number {
  return getAudioContext().sampleRate;
}

export type AudioSessionMode = 'playback' | 'record';

/**
 * Configures the OS audio session.
 *
 * Two details matter more than they look:
 *
 * - `playAndRecord` must be set *before* recording starts, and on iOS it routes
 *   playback to the earpiece unless `defaultToSpeaker` is given — which would
 *   make the metronome nearly inaudible while the learner plays along.
 * - `measurement` mode disables the system's automatic gain control and noise
 *   suppression. Those are tuned for speech and would actively fight us: AGC
 *   flattens exactly the loud/soft contrast the dynamics score measures, and
 *   noise suppression eats the quiet tail of a strum.
 */
export function configureAudioSession(mode: AudioSessionMode): void {
  AudioManager.setAudioSessionOptions({
    iosCategory: mode === 'record' ? 'playAndRecord' : 'playback',
    iosMode: mode === 'record' ? 'measurement' : 'default',
    iosOptions: ['defaultToSpeaker', 'allowBluetoothA2DP'],
  });
}

export async function activateAudioSession(): Promise<void> {
  await AudioManager.setAudioSessionActivity(true);
  await getAudioContext().resume();
}

export async function deactivateAudioSession(): Promise<void> {
  await AudioManager.setAudioSessionActivity(false);
}

export type MicrophonePermission = 'granted' | 'denied' | 'undetermined';

export async function checkMicrophonePermission(): Promise<MicrophonePermission> {
  return normalisePermission(await AudioManager.checkRecordingPermissions());
}

export async function requestMicrophonePermission(): Promise<MicrophonePermission> {
  return normalisePermission(await AudioManager.requestRecordingPermissions());
}

function normalisePermission(status: string): MicrophonePermission {
  if (status === 'Granted' || status === 'granted') return 'granted';
  if (status === 'Denied' || status === 'denied') return 'denied';
  return 'undetermined';
}

/** Releases the context. Call when leaving audio screens for a long time. */
export async function closeAudioContext(): Promise<void> {
  if (!context) return;
  const current = context;
  context = null;
  await current.close();
}
