import { AudioRecorder } from 'react-native-audio-api';

import { RollingWindow, concatFrames } from '@/dsp/buffer';

import {
  activateAudioSession,
  configureAudioSession,
  getSampleRate,
  requestMicrophonePermission,
} from './engine';

/**
 * Microphone capture.
 *
 * Delivers raw PCM frames as they arrive, which is what separates this app from
 * one built on `expo-audio`: a finished recording file cannot drive live
 * feedback while the learner is still playing.
 */

export type MicFrame = {
  /** Mono samples in -1..1. Valid only for the duration of the callback. */
  samples: Float32Array;
  sampleRate: number;
  /** Seconds since capture started. */
  when: number;
};

export type MicrophoneOptions = {
  /**
   * Preferred frame size. 1024 at 44.1 kHz is ~23 ms — short enough to feel
   * live, long enough that the JS bridge is not the bottleneck. The OS may
   * hand back a different size, so nothing downstream may assume this value.
   */
  bufferLength?: number;
  sampleRate?: number;
  /** Keep every frame so the whole take can be analysed after the fact. */
  capture?: boolean;
  /**
   * Size of the rolling analysis window in samples. Guarantees a minimum amount
   * of audio per callback regardless of the hardware's chunk size.
   */
  windowSize?: number;
};

export type MicrophoneStatus = 'idle' | 'starting' | 'running' | 'denied' | 'error';

export class Microphone {
  private recorder: AudioRecorder | null = null;
  private window: RollingWindow | null = null;
  private captured: Float32Array[] = [];
  private capturing = false;
  private status: MicrophoneStatus = 'idle';
  private listeners = new Set<(frame: MicFrame) => void>();
  private startedAt = 0;

  getStatus(): MicrophoneStatus {
    return this.status;
  }

  /** Audio-clock time capture began, for aligning a take against a grid. */
  getStartTime(): number {
    return this.startedAt;
  }

  onFrame(listener: (frame: MicFrame) => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  async start(options: MicrophoneOptions = {}): Promise<MicrophoneStatus> {
    if (this.status === 'running' || this.status === 'starting') return this.status;

    this.status = 'starting';

    const permission = await requestMicrophonePermission();
    if (permission !== 'granted') {
      this.status = 'denied';
      return this.status;
    }

    const {
      bufferLength = 1024,
      sampleRate = getSampleRate(),
      capture = false,
      windowSize = 2048,
    } = options;

    configureAudioSession('record');
    await activateAudioSession();

    this.window = new RollingWindow(windowSize);
    this.captured = [];
    this.capturing = capture;

    try {
      const recorder = new AudioRecorder();
      recorder.onAudioReady({ sampleRate, bufferLength, channelCount: 1 }, (event) => {
        this.handleFrame(event.buffer.getChannelData(0), event.buffer.sampleRate, event.when);
      });
      recorder.onError(() => {
        this.status = 'error';
      });

      await recorder.start();
      this.recorder = recorder;
      this.startedAt = 0;
      this.status = 'running';
    } catch {
      this.status = 'error';
    }

    return this.status;
  }

  private handleFrame(samples: Float32Array, sampleRate: number, when: number): void {
    if (this.startedAt === 0) this.startedAt = when;

    if (this.capturing) {
      // The event's buffer is reused by the native side, so a take has to own
      // its own copy rather than hold a reference.
      this.captured.push(Float32Array.from(samples));
    }

    const window = this.window;
    if (!window) return;

    window.push(samples);
    if (!window.isFull) return;

    const frame: MicFrame = { samples: window.read(), sampleRate, when };
    for (const listener of this.listeners) listener(frame);
  }

  async stop(): Promise<void> {
    const recorder = this.recorder;
    this.recorder = null;
    this.status = 'idle';

    if (recorder) {
      recorder.clearOnAudioReady();
      recorder.clearOnError();
      await recorder.stop();
    }

    this.window?.clear();
  }

  /** The whole take as one buffer. Empty unless started with `capture: true`. */
  takeRecording(): Float32Array {
    const joined = concatFrames(this.captured);
    this.captured = [];
    return joined;
  }
}
