import { Stack } from 'expo-router';
import React, { useCallback, useMemo, useState } from 'react';
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
const SAMPLE_RATE = 44100;

type Phase = 'idle' | 'measuring' | 'done' | 'failed';

export default function CalibrateScreen() {
  const { t } = useTranslation();

  const [phase, setPhase] = useState<Phase>('idle');
  const [measuredMs, setMeasuredMs] = useState<number | null>(null);
  const stored = useMemo(() => getMicLatencySeconds() * 1000, []);

  const run = useCallback(async () => {
    setPhase('measuring');
    setMeasuredMs(null);

    const microphone = new Microphone();
    const status = await microphone.start({ capture: true, bufferLength: 1024 });

    if (status !== 'running') {
      setPhase('failed');
      return;
    }

    const recordingStart = audioNow();
    const metronome = new Metronome({
      bpm: BPM,
      timeSignature: COMMON_TIME,
      bars: BARS,
      countInBars: 0,
      subdivision: 4,
    });

    const clickStart = metronome.start({ loop: false });
    const grid = metronome.getGrid();

    await new Promise((resolve) =>
      setTimeout(resolve, (grid.totalSeconds + 0.6) * 1000),
    );

    metronome.stop();
    await microphone.stop();

    const samples = microphone.takeRecording();
    if (samples.length === 0) {
      setPhase('failed');
      return;
    }

    const { onsets } = detectOnsets(samples, { sampleRate: SAMPLE_RATE });
    // Click times as offsets into the recording.
    const expected = grid.beats.map((beat) => clickStart - recordingStart + beat.time);
    const offset = estimateConstantOffset(onsets, expected);

    // A negative or implausibly large result means the clicks were not heard
    // and something else was; saving it would be worse than not calibrating.
    if (offset === null || offset < 0 || offset > 0.5) {
      setPhase('failed');
      return;
    }

    const milliseconds = offset * 1000;
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
