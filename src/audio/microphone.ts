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
  /**
   * *Preferred* capture rate. The hardware decides the real one — see
   * `Recording.sampleRate`, which is the only rate anything downstream may use.
   */
  sampleRate?: number;
  /** Keep every frame so the whole take can be analysed after the fact. */
  capture?: boolean;
  /**
   * Size of the rolling analysis window in samples. Guarantees a minimum amount
   * of audio per callback regardless of the hardware's chunk size.
   */
  windowSize?: number;
  /**
   * Hard ceiling on a captured take. Nothing in the app asks the learner to
   * play for this long, so hitting it means something went wrong — and an
   * uncapped buffer would grow until iOS kills the app and takes the take with
   * it. Ten minutes at 48 kHz is ~115 MB, which is already past reasonable.
   */
  maxCaptureSeconds?: number;
};

export type MicrophoneStatus = 'idle' | 'starting' | 'running' | 'denied' | 'error';

/**
 * A finished take: the samples *and* the rate they were captured at.
 *
 * These travel together deliberately. The hardware picks the rate — 48 kHz on
 * every current iPhone, whatever we asked for — and analysing 48 kHz samples as
 * though they were 44.1 kHz stretches every measured time by 8.8%, which reads
 * as a performance that drags further behind with every strum. A take that
 * cannot say what rate it was recorded at is a take that cannot be trusted.
 */
export type Recording = {
  samples: Float32Array;
  sampleRate: number;
  /** True when the take hit `maxCaptureSeconds` and was cut short. */
  truncated: boolean;
};

export class Microphone {
  private recorder: AudioRecorder | null = null;
  private window: RollingWindow | null = null;
  private captured: Float32Array[] = [];
  private capturedLength = 0;
  private maxCaptureSeconds = Infinity;
  private truncated = false;
  private capturing = false;
  private status: MicrophoneStatus = 'idle';
  private listeners = new Set<(frame: MicFrame) => void>();
  private startedAt: number | null = null;
  /** Bumped by every `stop()`, so a `start()` still in flight knows to abandon. */
  private generation = 0;
  /** The rate the hardware actually gave us, learned from the first frame. */
  private captureRate = 0;

  getStatus(): MicrophoneStatus {
    return this.status;
  }

  /** Audio-clock time capture began, for aligning a take against a grid. */
  getStartTime(): number {
    return this.startedAt ?? 0;
  }

  onFrame(listener: (frame: MicFrame) => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  async start(options: MicrophoneOptions = {}): Promise<MicrophoneStatus> {
    if (this.status === 'running' || this.status === 'starting') return this.status;

    const generation = ++this.generation;
    this.status = 'starting';

    const permission = await requestMicrophonePermission();
    if (generation !== this.generation) return this.status;
    if (permission !== 'granted') {
      this.status = 'denied';
      return this.status;
    }

    const {
      bufferLength = 1024,
      sampleRate = getSampleRate(),
      capture = false,
      windowSize = 2048,
      maxCaptureSeconds = 600,
    } = options;

    configureAudioSession('record');
    await activateAudioSession();
    if (generation !== this.generation) return this.status;

    this.window = new RollingWindow(windowSize);
    this.captured = [];
    this.capturedLength = 0;
    this.truncated = false;
    this.capturing = capture;
    this.captureRate = 0;
    this.startedAt = null;
    this.maxCaptureSeconds = maxCaptureSeconds;

    let recorder: AudioRecorder;
    try {
      recorder = new AudioRecorder();
      recorder.onAudioReady({ sampleRate, bufferLength, channelCount: 1 }, (event) => {
        this.handleFrame(event.buffer.getChannelData(0), event.buffer.sampleRate, event.when);
      });
      recorder.onError(() => {
        this.status = 'error';
      });
    } catch {
      this.status = 'error';
      return this.status;
    }

    // `start` resolves with a Result rather than throwing, so a try/catch here
    // would never fire and every failure — the mic held by another app, a
    // session that would not activate — would look like success and leave the
    // screen waiting for frames that never come.
    const result = await recorder.start();

    if (generation !== this.generation) {
      // Stopped while we were starting. Tear down rather than leaving a live
      // recorder nothing holds a reference to; on iOS that keeps the orange
      // microphone indicator lit until the app is killed.
      recorder.clearOnAudioReady();
      recorder.clearOnError();
      await recorder.stop().catch(() => undefined);
      return this.status;
    }

    if (result.status === 'error') {
      recorder.clearOnAudioReady();
      recorder.clearOnError();
      this.status = 'error';
      return this.status;
    }

    this.recorder = recorder;
    this.status = 'running';

    return this.status;
  }

  private handleFrame(samples: Float32Array, sampleRate: number, when: number): void {
    if (this.startedAt === null) this.startedAt = when;

    if (this.captureRate === 0 && sampleRate > 0) this.captureRate = sampleRate;

    if (this.capturing) {
      // Derived from the rate the hardware actually chose, not the one we asked
      // for, so the ceiling really is the number of seconds it claims to be.
      const limit = this.maxCaptureSeconds * (this.captureRate || sampleRate);
      if (this.capturedLength + samples.length > limit) {
        this.truncated = true;
        this.capturing = false;
      } else {
        // The event's buffer is reused by the native side, so a take has to own
        // its own copy rather than hold a reference.
        this.captured.push(Float32Array.from(samples));
        this.capturedLength += samples.length;
      }
    }

    const window = this.window;
    if (!window) return;

    window.push(samples);
    if (!window.isFull) return;

    const frame: MicFrame = { samples: window.read(), sampleRate, when };
    for (const listener of this.listeners) listener(frame);
  }

  async stop(): Promise<void> {
    this.generation += 1;

    const recorder = this.recorder;
    this.recorder = null;
    this.status = 'idle';

    if (recorder) {
      recorder.clearOnAudioReady();
      recorder.clearOnError();
      await recorder.stop().catch(() => undefined);

      // Hand the session back to playback. `record` puts iOS into
      // `playAndRecord` with `measurement` mode — which is right while
      // listening, because it disables the automatic gain control that would
      // flatten the very dynamics we measure, but it also attenuates output.
      // Leaving it set meant that using the tuner once made the metronome
      // quieter for the rest of the app's life.
      configureAudioSession('playback');
    }

    this.window?.clear();
  }

  /** The whole take. Empty unless started with `capture: true`. */
  takeRecording(): Recording {
    const samples = concatFrames(this.captured);
    const truncated = this.truncated;

    this.captured = [];
    this.capturedLength = 0;
    this.truncated = false;

    return {
      samples,
      // Falling back to the context rate keeps this defined for an empty take;
      // with no frames there is nothing to be wrong about.
      sampleRate: this.captureRate || getSampleRate(),
      truncated,
    };
  }
}
