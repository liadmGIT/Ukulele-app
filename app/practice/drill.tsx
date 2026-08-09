import { Stack, useLocalSearchParams } from 'expo-router';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { audioNow } from '@/audio/engine';
import { Microphone } from '@/audio/microphone';
import { getChordById } from '@/content';
import { getBestChangesPerMinute, recordPractice, saveDrillResult } from '@/db/progress';
import { changesPerMinute, countChordChanges } from '@/dsp/changes';
import { ChordDiagram } from '@/ui/ChordDiagram';
import { Button } from '@/ui/components/Button';
import { Card } from '@/ui/components/Card';
import { MicNotice } from '@/ui/components/MicNotice';
import { Screen } from '@/ui/components/Screen';
import { Text } from '@/ui/components/Text';
import { musicalRow } from '@/ui/direction';
import { radius, spacing } from '@/ui/theme';
import { useTheme } from '@/ui/ThemeProvider';

const DRILL_SECONDS = 60;
const CHOICES = ['C-maj', 'A-min', 'F-maj', 'G-maj', 'D-min', 'E-dom7'];

type Phase = 'idle' | 'running' | 'analysing' | 'done' | 'denied';

export default function DrillScreen() {
  const { a, b } = useLocalSearchParams<{ a?: string; b?: string }>();
  const { t } = useTranslation();
  const theme = useTheme();

  const [chordA, setChordA] = useState(a ?? CHOICES[0]!);
  const [chordB, setChordB] = useState(b ?? CHOICES[1]!);
  const [phase, setPhase] = useState<Phase>('idle');
  const [remaining, setRemaining] = useState(DRILL_SECONDS);
  const [result, setResult] = useState<{ changes: number; rate: number; best: number } | null>(null);

  const microphone = useRef<Microphone | null>(null);
  const ticker = useRef<ReturnType<typeof setInterval> | null>(null);
  const startedAt = useRef(0);

  const previousBest = useMemo(
    () => getBestChangesPerMinute(chordA, chordB),
    [chordA, chordB],
  );

  const stopTicker = useCallback(() => {
    if (ticker.current !== null) {
      clearInterval(ticker.current);
      ticker.current = null;
    }
  }, []);

  const finish = useCallback(async () => {
    stopTicker();
    const mic = microphone.current;
    microphone.current = null;

    if (!mic) {
      setPhase('idle');
      return;
    }

    setPhase('analysing');
    await mic.stop();

    const recording = mic.takeRecording();
    const elapsed = Math.min(DRILL_SECONDS, audioNow() - startedAt.current);

    // The rate the hardware chose, not one we assumed: counting 48 kHz audio as
    // 44.1 kHz would report a changes-per-minute figure 8.8% too low, and the
    // personal best it is compared against would drift with it.
    const { changes } = countChordChanges(recording.samples, {
      sampleRate: recording.sampleRate,
    });
    const rate = changesPerMinute(changes, elapsed);

    saveDrillResult({ chordA, chordB, changes, durationSeconds: elapsed });
    recordPractice(Math.max(1, Math.round(elapsed / 60)));

    setResult({ changes, rate, best: previousBest });
    setPhase('done');
  }, [chordA, chordB, previousBest, stopTicker]);

  const begin = useCallback(async () => {
    if (chordA === chordB) return;
    // The mic is acquired asynchronously, so without this a second tap starts a
    // second recorder and orphans the first.
    if (microphone.current) return;

    setResult(null);
    setRemaining(DRILL_SECONDS);

    const mic = new Microphone();
    microphone.current = mic;

    const status = await mic.start({
      capture: true,
      bufferLength: 1024,
      maxCaptureSeconds: DRILL_SECONDS + 30,
    });
    if (status !== 'running') {
      // Saying nothing here made the Start button look broken: it is the mic
      // that was refused, and only the learner can undo that.
      microphone.current = null;
      setPhase(status === 'denied' ? 'denied' : 'idle');
      return;
    }

    startedAt.current = audioNow();
    setPhase('running');

    ticker.current = setInterval(() => {
      const left = DRILL_SECONDS - (audioNow() - startedAt.current);
      setRemaining(Math.max(0, Math.ceil(left)));
      if (left <= 0) void finish();
    }, 250);
  }, [chordA, chordB, finish]);

  useEffect(() => {
    return () => {
      stopTicker();
      void microphone.current?.stop();
      microphone.current = null;
    };
  }, [stopTicker]);

  const busy = phase === 'running' || phase === 'analysing';
  const isNewBest = result !== null && result.rate > result.best;

  return (
    <>
      <Stack.Screen options={{ title: t('drill.title') }} />
      <Screen>
        <Card>
          <Text variant="body" tone="muted">
            {t('drill.explanation')}
          </Text>
        </Card>

        <Card>
          <Text variant="label" tone="muted">
            {t('drill.chooseChords')}
          </Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            <View style={styles.chordRow}>
              {CHOICES.map((id) => {
                const chord = getChordById(id);
                const shape = chord?.shapes[0];
                if (!chord || !shape) return null;

                const selected = id === chordA || id === chordB;
                return (
                  <Pressable
                    key={id}
                    disabled={busy}
                    onPress={() => {
                      // Tapping a third chord replaces the older selection, so
                      // there are always exactly two.
                      if (id === chordA || id === chordB) return;
                      setChordA(chordB);
                      setChordB(id);
                    }}
                    style={[
                      styles.chordTile,
                      {
                        borderColor: selected ? theme.colors.primary : theme.colors.border,
                        backgroundColor: selected ? theme.colors.surfaceAlt : 'transparent',
                      },
                    ]}
                  >
                    <Text variant="label">{chord.nameEn}</Text>
                    <ChordDiagram shape={shape} size={58} showFingers={false} />
                  </Pressable>
                );
              })}
            </View>
          </ScrollView>
        </Card>

        <Card style={styles.stage}>
          <View style={[styles.pair, musicalRow]}>
            {[chordA, chordB].map((id, index) => {
              const chord = getChordById(id);
              const shape = chord?.shapes[0];
              return (
                <View key={`${id}-${index}`} style={styles.pairItem}>
                  <Text variant="heading">{chord?.nameEn ?? '?'}</Text>
                  {shape && <ChordDiagram shape={shape} size={92} />}
                </View>
              );
            })}
          </View>

          {phase === 'running' && (
            <Text variant="display" tone="primary">
              {t('drill.counting', { count: remaining })}
            </Text>
          )}
          {phase === 'analysing' && <Text variant="heading">{t('record.analysing')}</Text>}
          {phase === 'denied' && <MicNotice status="denied" />}

          {phase === 'done' && result && (
            <View style={styles.result}>
              <Text variant="display" tone="primary">
                {result.rate}
              </Text>
              <Text variant="caption" tone="muted">
                {t('drill.perMinute')} · {result.changes} {t('drill.changes')}
              </Text>
              {isNewBest ? (
                <Text variant="heading" tone="primary">
                  {t('drill.newBest')}
                </Text>
              ) : (
                <Text variant="caption" tone="muted">
                  {t('drill.personalBest', { value: Math.max(result.best, result.rate) })}
                </Text>
              )}
            </View>
          )}

          {phase === 'idle' && previousBest > 0 && (
            <Text variant="caption" tone="muted">
              {t('drill.personalBest', { value: previousBest })}
            </Text>
          )}
        </Card>

        {chordA === chordB ? (
          <Text variant="caption" tone="danger">
            {t('drill.needTwo')}
          </Text>
        ) : (
          <Button
            title={
              phase === 'running'
                ? t('drill.stop')
                : phase === 'done'
                  ? t('drill.again')
                  : t('drill.start')
            }
            onPress={phase === 'running' ? finish : begin}
            disabled={phase === 'analysing'}
          />
        )}
      </Screen>
    </>
  );
}

const styles = StyleSheet.create({
  chordRow: { flexDirection: 'row', gap: spacing.sm, paddingVertical: spacing.xs },
  chordTile: {
    alignItems: 'center',
    gap: spacing.xs,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radius.md,
    borderWidth: StyleSheet.hairlineWidth,
  },
  stage: { alignItems: 'center', gap: spacing.md, paddingVertical: spacing.xl },
  pair: { gap: spacing.xl, alignItems: 'center' },
  pairItem: { alignItems: 'center', gap: spacing.xs },
  result: { alignItems: 'center', gap: spacing.xs },
});
