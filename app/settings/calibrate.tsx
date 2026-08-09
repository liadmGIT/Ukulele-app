import { Stack } from 'expo-router';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';

import { estimateConstantOffset } from '@/analysis/alignment';
import { audioNow } from '@/audio/engine';
import { Metronome } from '@/audio/metronome';
import { Microphone } from '@/audio/microphone';
import { getMicLatencySeconds, setMicLatencyMs } from '@/db/recordings';
import { detectOnsets } from '@/dsp/onset';
import { COMMON_TIME } from '@/music/grid';
import { Button } from '@/ui/components/Button';
import { Card } from '@/ui/components/Card';
import { MicNotice } from '@/ui/components/MicNotice';
import { Screen } from '@/ui/components/Screen';
import { Text } from '@/ui/components/Text';
import { spacing } from '@/ui/theme';

/**
 * Measuring the round trip between the speaker and the microphone.
 *
 * The app plays its own metronome and records it. Any offset between where the
 * clicks were scheduled and where they turn up in the recording is latency by
 * definition — there is no performer involved to be early or late — which is
 * what makes this the one place a constant offset can honestly be subtracted.
 */

const BPM = 100;
const BARS = 2;

/**
 * How many clicks must be individually heard before the result is believed.
 *
 * Every future take subtracts this number, so a measurement resting on one or
 * two detections is worse than no measurement at all: it converts a hardware
 * delay the app could have ignored into a confident, permanent bias that gets
 * blamed on the learner's timing.
 */
const MINIMUM_CLICKS_HEARD = 4;

type Phase = 'idle' | 'measuring' | 'done' | 'failed' | 'denied';

export default function CalibrateScreen() {
  const { t } = useTranslation();

  const [phase, setPhase] = useState<Phase>('idle');
  const [measuredMs, setMeasuredMs] = useState<number | null>(null);
  const stored = useMemo(() => getMicLatencySeconds() * 1000, []);

  // Everything the run owns, so leaving the screen can tear it down. Without
  // this, walking away mid-calibration left the metronome clicking over
  // whatever screen came next and still wrote a latency at the end — from a
  // measurement nobody was present for.
  const microphone = useRef<Microphone | null>(null);
  const metronome = useRef<Metronome | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const cancelled = useRef(false);

  const teardown = useCallback(() => {
    if (timer.current !== null) {
      clearTimeout(timer.current);
      timer.current = null;
    }
    metronome.current?.stop();
    metronome.current = null;
    void microphone.current?.stop();
    microphone.current = null;
  }, []);

  useEffect(() => {
    cancelled.current = false;
    return () => {
      cancelled.current = true;
      teardown();
    };
  }, [teardown]);

  const run = useCallback(async () => {
    if (microphone.current) return;

    setPhase('measuring');
    setMeasuredMs(null);

    const mic = new Microphone();
    microphone.current = mic;

    const status = await mic.start({ capture: true, bufferLength: 1024, maxCaptureSeconds: 30 });

    if (cancelled.current) return;
    if (status !== 'running') {
      microphone.current = null;
      setPhase(status === 'denied' ? 'denied' : 'failed');
      return;
    }

    const recordingStart = audioNow();
    const clicks = new Metronome({
      bpm: BPM,
      timeSignature: COMMON_TIME,
      bars: BARS,
      countInBars: 0,
      subdivision: 4,
    });
    metronome.current = clicks;

    const clickStart = clicks.start({ loop: false });
    const grid = clicks.getGrid();

    await new Promise<void>((resolve) => {
      timer.current = setTimeout(resolve, (grid.totalSeconds + 0.6) * 1000);
    });

    if (cancelled.current) return;

    clicks.stop();
    metronome.current = null;
    await mic.stop();

    if (cancelled.current) return;

    const recording = mic.takeRecording();
    microphone.current = null;

    if (recording.samples.length === 0) {
      setPhase('failed');
      return;
    }

    const { onsets } = detectOnsets(recording.samples, { sampleRate: recording.sampleRate });
    // Click times as offsets into the recording.
    const expected = grid.beats.map((beat) => clickStart - recordingStart + beat.time);
    const estimate = estimateConstantOffset(onsets, expected);

    // A negative or implausibly large result means the clicks were not heard
    // and something else was; saving it would be worse than not calibrating.
    if (
      estimate === null ||
      estimate.matchedCount < MINIMUM_CLICKS_HEARD ||
      estimate.offsetSeconds < 0 ||
      estimate.offsetSeconds > 0.5
    ) {
      setPhase('failed');
      return;
    }

    const milliseconds = estimate.offsetSeconds * 1000;
    setMicLatencyMs(milliseconds);
    setMeasuredMs(milliseconds);
    setPhase('done');
  }, []);

  return (
    <>
      <Stack.Screen options={{ title: t('calibration.title') }} />
      <Screen>
        <Card>
          <Text variant="body">{t('calibration.explanation')}</Text>
        </Card>

        <Card>
          <Text variant="body" tone="muted">
            {t('calibration.instructions')}
          </Text>
        </Card>

        <View style={styles.status}>
          {phase === 'measuring' && <Text variant="heading">{t('calibration.measuring')}</Text>}

          {phase === 'done' && measuredMs !== null && (
            <>
              <Text variant="heading" tone="primary">
                {t('calibration.result', { ms: Math.round(measuredMs) })}
              </Text>
              <Text variant="caption" tone="muted">
                {t('calibration.saved')}
              </Text>
            </>
          )}

          {phase === 'failed' && (
            <Text variant="body" tone="danger">
              {t('calibration.failed')}
            </Text>
          )}

          {phase === 'denied' && <MicNotice status="denied" />}

          {phase === 'idle' && (
            <Text variant="caption" tone="muted">
              {stored > 0
                ? t('calibration.current', { ms: Math.round(stored) })
                : t('calibration.notCalibrated')}
            </Text>
          )}
        </View>

        <Button
          title={phase === 'measuring' ? t('calibration.measuring') : t('calibration.start')}
          onPress={run}
          disabled={phase === 'measuring'}
        />
      </Screen>
    </>
  );
}

const styles = StyleSheet.create({
  status: { alignItems: 'center', gap: spacing.xs, paddingVertical: spacing.lg },
});
