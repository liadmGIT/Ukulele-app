import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { gridForPattern } from '@/analysis/performance';
import { usePatternPlayer } from '@/audio/usePatternPlayer';
import { useTakeRecorder } from '@/audio/useTakeRecorder';
import { getChordById, getStrumPatternById, getStrumPatterns } from '@/content';
import { getChordMastery } from '@/db/mastery';
import { recordChordAttempt, recordPractice } from '@/db/progress';
import { getMicLatencySeconds, hasCalibratedMicLatency, saveTake } from '@/db/recordings';
import { ChordDiagram } from '@/ui/ChordDiagram';
import { Button } from '@/ui/components/Button';
import { Card } from '@/ui/components/Card';
import { MicNotice } from '@/ui/components/MicNotice';
import { Screen } from '@/ui/components/Screen';
import { Text } from '@/ui/components/Text';
import { musicalRow } from '@/ui/direction';
import { ReviewCard } from '@/ui/ReviewCard';
import { RhythmStrip } from '@/ui/RhythmStrip';
import { radius, spacing } from '@/ui/theme';
import { useTheme } from '@/ui/ThemeProvider';

/** The suggested starting points, not the whole list — any chord can be recorded. */
const SUGGESTED_CHORD_IDS = ['C-maj', 'A-min', 'F-maj', 'G-maj'];
const BPM = 90;
/** Bars of playing per take — long enough to show a drift, short enough to hold. */
const REPEATS = 4;

export default function RecordScreen() {
  const { patternId, chordId: chordParam } = useLocalSearchParams<{
    patternId?: string;
    chordId?: string;
  }>();
  const { t, i18n } = useTranslation();
  const theme = useTheme();
  const router = useRouter();

  const patterns = getStrumPatterns();
  const [selectedPatternId, setSelectedPatternId] = useState(
    patternId ?? patterns[0]?.id ?? 'all-downs',
  );
  const [chordId, setChordId] = useState(
    chordParam && getChordById(chordParam) ? chordParam : SUGGESTED_CHORD_IDS[0]!,
  );

  // Whichever chord the learner arrived to practise belongs in the picker, even
  // when it is not one of the four suggestions — otherwise tapping "practise
  // this" on a chord's own page lands on a screen that offers four other chords.
  const chordChoices = useMemo(() => {
    const ids = [...SUGGESTED_CHORD_IDS];
    if (chordParam && getChordById(chordParam) && !ids.includes(chordParam)) {
      ids.unshift(chordParam);
    }
    return ids;
  }, [chordParam]);

  const pattern = getStrumPatternById(selectedPatternId) ?? patterns[0]!;
  const chord = getChordById(chordId);
  const shape = chord?.shapes[0];

  const calibrated = useMemo(() => hasCalibratedMicLatency(), []);
  const latencySeconds = useMemo(() => getMicLatencySeconds(), []);

  // The pattern repeated across the take, so the grid and the analysis agree
  // about how many strums were expected.
  //
  // Rebuilt each render rather than memoised: both are a few dozen small
  // objects, and the hooks below key off their *contents*, so a fresh identity
  // costs nothing.
  const steps = Array.from({ length: REPEATS }, () => pattern.steps).flat();
  const grid = gridForPattern(steps, {
    bpm: BPM,
    timeSignature: pattern.timeSignature,
    subdivision: pattern.subdivision,
    countInBars: 1,
  });

  const savedTakeId = useRef<string | null>(null);

  const player = usePatternPlayer({
    steps,
    frets: shape?.frets ?? [0, 0, 0, 3],
    bpm: BPM,
    timeSignature: pattern.timeSignature,
    subdivision: pattern.subdivision,
    countInBars: 1,
    withClick: true,
  });

  // The timing tolerance tightens as a chord is mastered — 50 ms at level 0,
  // 25 ms at level 5. Without passing it, every take was judged at beginner
  // tolerance forever and the higher levels could not ask for anything more.
  const level = useMemo(() => getChordMastery(chordId)?.level ?? 0, [chordId]);

  const recorder = useTakeRecorder({ steps, grid, latencySeconds, level });

  // Persist once per take. The audio itself is not written to disk yet — the
  // metrics and review are what the progress screen charts, and keeping a few
  // minutes of PCM per attempt would fill the device long before it earned its
  // keep.
  useEffect(() => {
    if (!recorder.review || !recorder.analysis || recorder.completedAt === null) return;

    const takeKey = `${recorder.analysis.metrics.overallScore}-${recorder.analysis.onsets.length}`;
    if (savedTakeId.current === takeKey) return;
    savedTakeId.current = takeKey;

    saveTake({
      fileUri: '',
      durationMs: Math.round(recorder.analysis.grid.totalSeconds * 1000),
      patternId: pattern.id,
      songId: null,
      bpm: BPM,
      tempoPct: 100,
      metrics: recorder.analysis.metrics,
      review: recorder.review,
    });

    // The take was played over one chord, so it is that chord's mastery that
    // moves. The rules for whether it moves at all live in analysis/mastery.
    recordChordAttempt(chordId, {
      score: recorder.analysis.metrics.overallScore,
      tempoFraction: 1,
      at: recorder.completedAt,
    });
    recordPractice(Math.max(1, Math.round(recorder.analysis.grid.totalSeconds / 60)), recorder.completedAt);
  }, [recorder.review, recorder.analysis, recorder.completedAt, pattern.id, chordId]);

  const begin = async () => {
    const status = await recorder.start();
    // Only once the microphone is actually live. Starting the player regardless
    // meant a refused microphone left the strum pattern looping with no way to
    // stop it: the button's label and action both key off `isRecording`, which
    // never became true, so pressing it started yet another loop.
    if (status !== 'running') return;
    // The player starts after the microphone is live, so nothing is clipped
    // from the count-in.
    player.start();
  };

  const finish = async () => {
    // Read the player's anchor before stopping it, then hand it to the analysis
    // so the recording is measured against the beats that actually sounded.
    const startedAt = player.getStartTime() ?? undefined;
    player.stop();
    await recorder.stop(startedAt);
  };

  const busy = recorder.isRecording;

  return (
    <>
      <Stack.Screen options={{ title: t('record.title') }} />
      <Screen>
        {!recorder.review && (
          <>
            <Text variant="body" tone="muted">
              {t('record.subtitle')}
            </Text>

            {!calibrated && (
              <Card>
                <Text variant="caption" tone="muted">
                  {t('record.notCalibrated')}
                </Text>
                <Button
                  title={t('record.calibrateNow')}
                  variant="secondary"
                  onPress={() => router.push('/settings/calibrate')}
                />
              </Card>
            )}

            <Card>
              <Text variant="label" tone="muted">
                {t('record.choosePattern')}
              </Text>
              <View style={styles.chips}>
                {patterns.slice(0, 6).map((option) => {
                  const active = option.id === pattern.id;
                  return (
                    <Pressable
                      key={option.id}
                      disabled={busy}
                      onPress={() => setSelectedPatternId(option.id)}
                      style={[
                        styles.chip,
                        {
                          backgroundColor: active ? theme.colors.primary : 'transparent',
                          borderColor: active ? theme.colors.primary : theme.colors.border,
                        },
                      ]}
                    >
                      <Text variant="caption" tone={active ? 'inverse' : 'muted'}>
                        {i18n.language === 'he' ? option.nameHe : option.nameEn}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>

              <View style={[styles.stripRow, musicalRow]}>
                <RhythmStrip
                  steps={pattern.steps}
                  timeSignature={pattern.timeSignature}
                  subdivision={pattern.subdivision}
                  activeStep={
                    player.activeStep === null
                      ? null
                      : player.activeStep % pattern.steps.length
                  }
                  width={290}
                />
              </View>
            </Card>

            <Card>
              <Text variant="label" tone="muted">
                {t('record.chooseChord')}
              </Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                <View style={styles.chordRow}>
                  {chordChoices.map((id) => {
                    const option = getChordById(id);
                    const optionShape = option?.shapes[0];
                    if (!option || !optionShape) return null;

                    const active = option.id === chordId;
                    return (
                      <Pressable
                        key={option.id}
                        disabled={busy}
                        onPress={() => setChordId(option.id)}
                        style={[
                          styles.chordTile,
                          {
                            borderColor: active ? theme.colors.primary : theme.colors.border,
                            backgroundColor: active ? theme.colors.surfaceAlt : 'transparent',
                          },
                        ]}
                      >
                        <Text variant="label">{option.nameEn}</Text>
                        <ChordDiagram shape={optionShape} size={60} showFingers={false} />
                      </Pressable>
                    );
                  })}
                </View>
              </ScrollView>
            </Card>

            <MicNotice status={recorder.status} />

            {recorder.isRecording && (
              <Text variant="heading" tone="primary" style={styles.centred}>
                {t('record.recording', { count: Math.floor(recorder.elapsed) })}
              </Text>
            )}

            {/*
              The elapsed count belongs above, not inside the button. Labelling
              the only control "Recording… 12 seconds" left a beginner with
              nothing telling them how to finish — the way to stop was to press
              the thing that described what was already happening.
            */}
            <Button
              title={
                recorder.isRecording ? t('record.stopRecording') : t('record.startRecording')
              }
              onPress={recorder.isRecording ? finish : begin}
            />
          </>
        )}

        {recorder.review && recorder.analysis && (
          <>
            <ReviewCard review={recorder.review} metrics={recorder.analysis.metrics} />
            <Button
              title={t('record.tryAgain')}
              onPress={() => {
                savedTakeId.current = null;
                recorder.clear();
              }}
            />
          </>
        )}
      </Screen>
    </>
  );
}

const styles = StyleSheet.create({
  centred: { textAlign: 'center' },
  chips: { flexDirection: 'row', gap: spacing.xs, flexWrap: 'wrap' },
  chip: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs + 2,
    borderRadius: radius.pill,
    borderWidth: StyleSheet.hairlineWidth,
  },
  stripRow: { justifyContent: 'center', marginTop: spacing.sm },
  chordRow: { flexDirection: 'row', gap: spacing.sm, paddingVertical: spacing.xs },
  chordTile: {
    alignItems: 'center',
    gap: spacing.xs,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radius.md,
    borderWidth: StyleSheet.hairlineWidth,
  },
});
