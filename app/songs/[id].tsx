import { Stack, useLocalSearchParams } from 'expo-router';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { useSongPlayer } from '@/audio/useSongPlayer';
import { useTakeRecorder } from '@/audio/useTakeRecorder';
import { getChordById, getSongById, getStrumPatternById } from '@/content';
import { getPlayableChordIds } from '@/db/mastery';
import { getSongMasteryState, recordPractice, recordSongAttempt } from '@/db/progress';
import { getMicLatencySeconds, saveTake } from '@/db/recordings';
import { missingChords } from '@/music/playable';
import { ChordDiagram } from '@/ui/ChordDiagram';
import { Button } from '@/ui/components/Button';
import { Card } from '@/ui/components/Card';
import { MicNotice } from '@/ui/components/MicNotice';
import { Screen } from '@/ui/components/Screen';
import { Text } from '@/ui/components/Text';
import { musicalRow } from '@/ui/direction';
import { ReviewCard } from '@/ui/ReviewCard';
import { RhythmStrip } from '@/ui/RhythmStrip';
import { SongChart } from '@/ui/SongChart';
import { radius, spacing } from '@/ui/theme';
import { useTheme } from '@/ui/ThemeProvider';

const TEMPO_STEPS = [0.5, 0.6, 0.7, 0.8, 0.9, 1] as const;

export default function SongPlayerScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { t, i18n } = useTranslation();
  const theme = useTheme();

  const [tempoFraction, setTempoFraction] = useState(1);

  const song = useMemo(() => (id ? getSongById(id) : undefined), [id]);
  const known = useMemo(() => getPlayableChordIds(), []);

  const pattern = song ? getStrumPatternById(song.defaultPatternId) : undefined;

  const player = useSongPlayer({
    // The hook needs a song; the guard below keeps this from ever rendering
    // without one, and a stable fallback keeps the hook order fixed. The
    // fallback's empty timeline makes the player inert rather than throwing.
    song: song ?? FALLBACK_SONG,
    patternNotation: pattern?.notation ?? 'D D D D',
    patternSubdivision: pattern?.subdivision ?? 4,
    tempoFraction,
  });

  const level = useMemo(() => (song ? getSongMasteryState(song.id).level : 0), [song]);
  const latencySeconds = useMemo(() => getMicLatencySeconds(), []);

  const recorder = useTakeRecorder({
    steps: player.steps,
    grid: player.grid,
    latencySeconds,
    level,
  });

  const savedTakeId = useRef<string | null>(null);

  // A played-along take is the only honest source of song mastery. Until this
  // existed `recordSongAttempt` had no callers at all, so no song could ever
  // rise above level 0 no matter how well or how often it was played.
  useEffect(() => {
    if (!song || !recorder.review || !recorder.analysis || recorder.completedAt === null) return;

    const takeKey = `${recorder.completedAt}`;
    if (savedTakeId.current === takeKey) return;
    savedTakeId.current = takeKey;

    saveTake({
      fileUri: '',
      durationMs: Math.round(recorder.analysis.grid.totalSeconds * 1000),
      patternId: song.defaultPatternId,
      songId: song.id,
      bpm: song.bpm,
      tempoPct: Math.round(tempoFraction * 100),
      metrics: recorder.analysis.metrics,
      review: recorder.review,
    });

    recordSongAttempt(song.id, {
      score: recorder.analysis.metrics.overallScore,
      // The tempo it was actually played at. A level earned at 60% is a level
      // earned at 60%, and the mastery rules refuse to award the higher ones
      // until the speed comes up.
      tempoFraction,
      at: recorder.completedAt,
    });
    recordPractice(
      Math.max(1, Math.round(recorder.analysis.grid.totalSeconds / 60)),
      recorder.completedAt,
    );
  }, [song, recorder.review, recorder.analysis, recorder.completedAt, tempoFraction]);

  if (!song || !pattern) {
    return (
      <Screen>
        <Card>
          <Text variant="heading">{t('common.notFound')}</Text>
          <Text variant="body" tone="muted">
            {t('common.notFoundBody')}
          </Text>
        </Card>
      </Screen>
    );
  }

  const isHebrew = i18n.language === 'he';
  const missing = missingChords({ songId: song.id, chordIds: song.timeline.chordIds }, known);

  const beginTake = async () => {
    const status = await recorder.start();
    // Only play if the microphone is genuinely live, so a refused permission
    // cannot leave the song running with nothing listening to it.
    if (status !== 'running') return;
    player.start();
  };

  const finishTake = async () => {
    // The player's anchor has to be read before stopping it, so the take is
    // measured against the beats that actually sounded.
    const startedAt = player.getStartTime() ?? undefined;
    player.stop();
    await recorder.stop(startedAt);
  };

  // Before playback starts, show the song's opening chord rather than an empty
  // space — it is the shape the learner needs their hand on to begin.
  const displayChord =
    (player.currentChordId ? getChordById(player.currentChordId) : undefined) ??
    getChordById(song.timeline.chordIds[0] ?? '');
  const nextChord = player.nextChordId ? getChordById(player.nextChordId) : undefined;

  return (
    <>
      <Stack.Screen options={{ title: isHebrew ? song.titleHe : song.titleEn }} />
      <Screen scroll={false} contentStyle={styles.screen}>
        <Card>
          <View style={styles.header}>
            <View style={styles.headerText}>
              <Text variant="caption" tone="muted">
                {isHebrew ? song.artistHe : song.artistEn} · {song.songKey} ·{' '}
                {Math.round(song.bpm * tempoFraction)} BPM
              </Text>
              <Text variant="display" tone={player.isPlaying ? 'primary' : 'default'}>
                {displayChord?.nameEn ?? '—'}
              </Text>
              {nextChord && (
                <Text variant="caption" tone="muted">
                  → {nextChord.nameEn}
                </Text>
              )}
            </View>

            {displayChord?.shapes[0] && (
              <ChordDiagram shape={displayChord.shapes[0]} size={104} />
            )}
          </View>

          <View style={[styles.stripRow, musicalRow]}>
            <RhythmStrip
              steps={pattern.steps}
              timeSignature={pattern.timeSignature}
              subdivision={pattern.subdivision}
              activeStep={player.activeStep}
              width={280}
              showCounting={false}
            />
          </View>
        </Card>

        {missing.length > 0 && (
          <Card>
            <Text variant="caption" tone="muted">
              {t('songs.missingChordsHint', {
                chords: missing.map((chordId) => getChordById(chordId)?.nameEn ?? chordId).join(', '),
              })}
            </Text>
          </Card>
        )}

        <View style={styles.chart}>
          {recorder.review && recorder.analysis ? (
            <ScrollView>
              <ReviewCard review={recorder.review} metrics={recorder.analysis.metrics} />
              <Button
                title={t('record.tryAgain')}
                variant="secondary"
                onPress={() => {
                  savedTakeId.current = null;
                  recorder.clear();
                }}
              />
            </ScrollView>
          ) : (
            <SongChart
              timeline={song.timeline}
              currentBarIndex={player.currentBar?.index ?? null}
              height={260}
            />
          )}
        </View>

        <View style={styles.controls}>
          <Text variant="caption" tone="muted">
            {t('songs.practiceSpeed')}
          </Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            <View style={[styles.chips, musicalRow]}>
              {TEMPO_STEPS.map((fraction) => {
                const active = fraction === tempoFraction;
                return (
                  <Pressable
                    key={fraction}
                    onPress={() => setTempoFraction(fraction)}
                    style={[
                      styles.chip,
                      {
                        backgroundColor: active ? theme.colors.primary : 'transparent',
                        borderColor: active ? theme.colors.primary : theme.colors.border,
                      },
                    ]}
                  >
                    <Text variant="caption" tone={active ? 'inverse' : 'muted'}>
                      {Math.round(fraction * 100)}%
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          </ScrollView>

          <MicNotice status={recorder.status} />

          <View style={styles.buttonRow}>
            <Button
              title={player.isPlaying && !recorder.isRecording ? t('songs.stop') : t('songs.playAlong')}
              onPress={player.toggle}
              disabled={recorder.isRecording}
              style={styles.grow}
            />
            <Button
              title={recorder.isRecording ? t('record.stopRecording') : t('songs.recordTake')}
              variant="secondary"
              onPress={recorder.isRecording ? finishTake : beginTake}
              disabled={player.isPlaying && !recorder.isRecording}
              style={styles.grow}
            />
          </View>
        </View>
      </Screen>
    </>
  );
}

/**
 * Placeholder so the player hook always receives a song and the hook order
 * cannot change between renders. Never audible: the screen returns early
 * whenever the real song is missing.
 */
const FALLBACK_SONG = {
  id: '',
  titleHe: '',
  titleEn: '',
  artistHe: '',
  artistEn: '',
  language: 'en',
  songKey: 'C',
  bpm: 100,
  beatsPerBar: 4,
  beatUnit: 4,
  difficulty: 1,
  defaultPatternId: 'all-downs',
  source: '',
  publicDomain: true,
  sections: [],
  timeline: {
    bars: [],
    totalBeats: 0,
    totalBars: 0,
    timeSignature: { beatsPerBar: 4, beatUnit: 4 },
    chordIds: [],
  },
} as unknown as NonNullable<ReturnType<typeof getSongById>>;

const styles = StyleSheet.create({
  screen: { padding: spacing.lg, gap: spacing.md },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.md },
  headerText: { flexShrink: 1, gap: 2 },
  stripRow: { justifyContent: 'center', marginTop: spacing.sm },
  chart: { flex: 1 },
  controls: { gap: spacing.sm },
  buttonRow: { flexDirection: 'row', gap: spacing.sm },
  grow: { flex: 1 },
  chips: { gap: spacing.xs },
  chip: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs + 2,
    borderRadius: radius.pill,
    borderWidth: StyleSheet.hairlineWidth,
  },
});
