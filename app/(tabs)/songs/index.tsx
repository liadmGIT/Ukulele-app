import { useRouter } from 'expo-router';
import React, { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { FlatList, Pressable, StyleSheet, View } from 'react-native';

import { getChordById, getSongs, type Song } from '@/content';
import { getPlayableChordIds } from '@/db/mastery';
import { missingChords, rankSongs, suggestNextChords } from '@/music/playable';
import { Card } from '@/ui/components/Card';
import { Text } from '@/ui/components/Text';
import { radius, spacing } from '@/ui/theme';
import { useTheme } from '@/ui/ThemeProvider';

type Filter = 'playable' | 'all' | 'he' | 'en';

const FILTERS: readonly Filter[] = ['playable', 'all', 'he', 'en'];

const FILTER_LABELS: Record<Filter, string> = {
  playable: 'songs.playableNow',
  all: 'songs.all',
  he: 'songs.hebrew',
  en: 'songs.english',
};

export default function SongsScreen() {
  const { t, i18n } = useTranslation();
  const theme = useTheme();
  const router = useRouter();

  // Matches the first chip, and the point of the screen: a beginner opening a
  // list of 33 songs they cannot play is the third of the three things that
  // make people quit.
  const [filter, setFilter] = useState<Filter>('playable');
  const isHebrew = i18n.language === 'he';

  const known = useMemo(() => getPlayableChordIds(), []);

  const requirements = useMemo(
    () =>
      getSongs().map((song) => ({
        song,
        songId: song.id,
        chordIds: song.timeline.chordIds,
        difficulty: song.difficulty,
      })),
    [],
  );

  // Ranked before filtering, so "all" still leads with what can be played today
  // rather than making the learner hunt for it.
  const ranked = useMemo(() => rankSongs(requirements, known), [requirements, known]);

  const visible = useMemo(() => {
    if (filter === 'playable') {
      return ranked.filter((entry) => missingChords(entry, known).length === 0);
    }
    if (filter === 'he' || filter === 'en') {
      return ranked.filter((entry) => entry.song.language === filter);
    }
    return ranked;
  }, [ranked, filter, known]);

  const suggestion = useMemo(() => suggestNextChords(requirements, known, 1)[0], [
    requirements,
    known,
  ]);
  const suggestedChord = suggestion ? getChordById(suggestion.chordId) : undefined;

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
      <View style={styles.filters}>
        {FILTERS.map((option) => {
          const active = option === filter;
          return (
            <Pressable
              key={option}
              onPress={() => setFilter(option)}
              style={[
                styles.chip,
                {
                  backgroundColor: active ? theme.colors.primary : theme.colors.surface,
                  borderColor: active ? theme.colors.primary : theme.colors.border,
                },
              ]}
            >
              <Text variant="caption" tone={active ? 'inverse' : 'muted'}>
                {t(FILTER_LABELS[option])}
              </Text>
            </Pressable>
          );
        })}
      </View>

      <FlatList
        data={visible}
        keyExtractor={(entry) => entry.songId}
        contentContainerStyle={styles.list}
        ListHeaderComponent={
          suggestedChord && suggestion ? (
            <Card onPress={() => router.push(`/chords/${suggestedChord.id}`)}>
              <Text variant="body" tone="primary">
                {t('songs.unlockChord', {
                  chord: suggestedChord.nameEn,
                  count: suggestion.count,
                })}
              </Text>
            </Card>
          ) : null
        }
        ListEmptyComponent={
          <Card>
            <Text variant="body" tone="muted">
              {filter === 'playable' ? t('songs.nothingPlayableYet') : t('songs.empty')}
            </Text>
          </Card>
        }
        renderItem={({ item }) => (
          <SongRow
            song={item.song}
            missing={missingChords(item, known)}
            isHebrew={isHebrew}
            onPress={() => router.push(`/songs/${item.songId}`)}
          />
        )}
      />
    </View>
  );
}

function SongRow({
  song,
  missing,
  isHebrew,
  onPress,
}: {
  song: Song;
  missing: string[];
  isHebrew: boolean;
  onPress: () => void;
}) {
  const { t } = useTranslation();
  const theme = useTheme();

  const playable = missing.length === 0;
  const chordCount = song.timeline.chordIds.length;

  return (
    <Card onPress={onPress}>
      <View style={styles.row}>
        <View style={styles.rowText}>
          <Text variant="heading">{isHebrew ? song.titleHe : song.titleEn}</Text>
          <Text variant="caption" tone="muted">
            {isHebrew ? song.artistHe : song.artistEn} · {song.songKey} · {song.bpm} BPM
          </Text>
        </View>

        <View
          style={[
            styles.badge,
            {
              backgroundColor: playable ? theme.colors.success : theme.colors.surfaceAlt,
            },
          ]}
        >
          <Text variant="caption" tone={playable ? 'inverse' : 'muted'}>
            {playable
              ? t('songs.canPlay')
              : t('songs.chordsAway', { count: missing.length })}
          </Text>
        </View>
      </View>

      <View style={styles.chords}>
        <Text variant="caption" tone="muted">
          {t('songs.chordCount', { count: chordCount })}
        </Text>
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, paddingHorizontal: spacing.lg, paddingTop: spacing.md },
  filters: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  chip: {
    paddingHorizontal: spacing.md,
    // 44pt is Apple's minimum, and these are the controls a learner reaches for
    // with an instrument in their hands — tempo, pattern, filter. At the old
    // ~28pt they were a coin toss.
    minHeight: 44,
    justifyContent: 'center',
    paddingVertical: spacing.xs + 2,
    borderRadius: radius.pill,
    borderWidth: StyleSheet.hairlineWidth,
  },
  list: { paddingVertical: spacing.lg, gap: spacing.md, paddingBottom: spacing.xxxl },
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.sm },
  rowText: { flex: 1, gap: 2 },
  badge: {
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: radius.pill,
  },
  chords: { flexDirection: 'row', gap: spacing.xs, alignItems: 'center' },
});
