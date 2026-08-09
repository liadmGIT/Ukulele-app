import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React, { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';

import { buildSession, practiceStreak, type SessionItem } from '@/analysis/session';
import { getChordById, getSongById, getSongs } from '@/content';
import { getAllChordMastery } from '@/db/mastery';
import { getPracticeDays, getSongMasteryState, recordPractice } from '@/db/progress';
import { hasCalibratedMicLatency } from '@/db/recordings';
import { playableSongIds } from '@/music/playable';
import { Button } from '@/ui/components/Button';
import { Card } from '@/ui/components/Card';
import { Screen } from '@/ui/components/Screen';
import { Text } from '@/ui/components/Text';
import { spacing } from '@/ui/theme';
import { useTheme } from '@/ui/ThemeProvider';

const ITEM_ICONS: Record<SessionItem['kind'], React.ComponentProps<typeof MaterialCommunityIcons>['name']> = {
  tune: 'tune-vertical',
  chord: 'music-circle-outline',
  drill: 'swap-horizontal',
  song: 'playlist-music-outline',
  pattern: 'gesture-swipe-vertical',
};

export default function TodayScreen() {
  const { t, i18n } = useTranslation();
  const theme = useTheme();
  const router = useRouter();

  const [completed, setCompleted] = useState<Set<number>>(new Set());
  const isHebrew = i18n.language === 'he';

  // One timestamp for the life of the screen: mastery decay and the streak
  // should agree with each other, and neither should shift mid-render.
  const [now] = useState(() => Date.now());

  const { plan, streak } = useMemo(() => {
    const mastery = getAllChordMastery();
    const songs = getSongs();

    // How many songs each chord appears in. This is what stops the first
    // session recommending C, C7 and Cmaj7 — none of which combine into
    // anything — instead of C, Am and F, which do.
    const usefulness = new Map<string, number>();
    for (const song of songs) {
      for (const chordId of song.timeline.chordIds) {
        usefulness.set(chordId, (usefulness.get(chordId) ?? 0) + 1);
      }
    }

    const chords = [...mastery.values()].map((entry) => ({
      id: entry.chordId,
      difficulty: getChordById(entry.chordId)?.difficulty ?? 3,
      usefulness: usefulness.get(entry.chordId) ?? 0,
      mastery: {
        level: entry.level,
        sessionsPractised: entry.sessionsPractised,
        lastPractisedAt: entry.lastPractisedAt,
      },
    }));

    const known = new Set(
      chords.filter((entry) => entry.mastery.level >= 3).map((entry) => entry.id),
    );

    const playable = playableSongIds(
      songs.map((song) => ({ songId: song.id, chordIds: song.timeline.chordIds })),
      known,
    ).map((songId) => ({ id: songId, mastery: getSongMasteryState(songId) }));

    return {
      plan: buildSession({
        chords,
        playableSongs: playable,
        now,
        needsCalibration: !hasCalibratedMicLatency(),
      }),
      streak: practiceStreak(getPracticeDays(), now),
    };
  }, [now]);

  const allDone = completed.size >= plan.items.length && plan.items.length > 0;

  const labelFor = (item: SessionItem): string => {
    if (item.kind === 'tune') {
      return item.targetId === 'calibrate' ? t('session.itemCalibrate') : t('session.itemTune');
    }
    if (item.kind === 'chord') {
      return t('session.itemChord', { name: getChordById(item.targetId ?? '')?.nameEn ?? '' });
    }
    if (item.kind === 'drill') {
      return t('session.itemDrill', {
        a: getChordById(item.targetId ?? '')?.nameEn ?? '',
        b: getChordById(item.pairId ?? '')?.nameEn ?? '',
      });
    }
    const song = getSongById(item.targetId ?? '');
    return t('session.itemSong', { name: song ? (isHebrew ? song.titleHe : song.titleEn) : '' });
  };

  /**
   * What the button opens, said plainly.
   *
   * Every card used to offer "start practising" regardless of whether it led to
   * the tuner, a chord, a drill or a song — five identical buttons doing five
   * different things.
   */
  const actionFor = (item: SessionItem): string => {
    if (item.kind === 'tune') {
      return item.targetId === 'calibrate' ? t('today.openCalibrate') : t('today.openTune');
    }
    if (item.kind === 'chord') return t('today.openChord');
    if (item.kind === 'drill') return t('today.openDrill');
    return t('today.openSong');
  };

  const routeFor = (item: SessionItem): string | null => {
    if (item.kind === 'tune') {
      return item.targetId === 'calibrate' ? '/settings/calibrate' : '/practice/tuner';
    }
    if (item.kind === 'chord') return `/chords/${item.targetId}`;
    if (item.kind === 'drill') return `/practice/drill?a=${item.targetId}&b=${item.pairId}`;
    if (item.kind === 'song') return `/songs/${item.targetId}`;
    return null;
  };

  const complete = (index: number, item: SessionItem) => {
    setCompleted((current) => new Set(current).add(index));
    recordPractice(item.estimatedMinutes);
  };

  return (
    <Screen>
      <View style={styles.heading}>
        <Text variant="display">{t('today.title')}</Text>
        <Text variant="body" tone="muted">
          {t('today.estimatedMinutes', { count: plan.estimatedMinutes })}
          {streak > 0 ? ` · ${t('progress.streak', { count: streak })}` : ''}
        </Text>
      </View>

      {allDone ? (
        <Card>
          <Text variant="heading" tone="primary">
            {t('session.complete')}
          </Text>
        </Card>
      ) : (
        <Text variant="caption" tone="muted">
          {t('session.progressOf', { done: completed.size, total: plan.items.length })}
        </Text>
      )}

      {plan.items.map((item, index) => {
        const done = completed.has(index);
        const route = routeFor(item);

        return (
          <Card key={`${item.kind}-${index}`}>
            <View style={styles.row}>
              <MaterialCommunityIcons
                name={done ? 'check-circle' : ITEM_ICONS[item.kind]}
                size={26}
                color={done ? theme.colors.success : theme.colors.primary}
              />
              <View style={styles.rowText}>
                <Text variant="heading" style={done ? styles.doneText : undefined}>
                  {labelFor(item)}
                </Text>
                <Text variant="caption" tone="muted">
                  {t(item.reasonKey)} · {t('session.minutes', { count: item.estimatedMinutes })}
                </Text>
              </View>
            </View>

            {!done && (
              <View style={styles.actions}>
                {route && (
                  <Button
                    title={actionFor(item)}
                    onPress={() => router.push(route as never)}
                    style={styles.grow}
                  />
                )}
                <Button
                  title={t('session.done')}
                  variant="secondary"
                  onPress={() => complete(index, item)}
                />
              </View>
            )}
          </Card>
        );
      })}
    </Screen>
  );
}

const styles = StyleSheet.create({
  heading: { gap: spacing.xs },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  rowText: { flex: 1, gap: 2 },
  doneText: { textDecorationLine: 'line-through', opacity: 0.6 },
  actions: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.sm },
  grow: { flex: 1 },
});
