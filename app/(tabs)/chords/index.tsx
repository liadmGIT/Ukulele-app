import { useRouter } from 'expo-router';
import React, { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { FlatList, Pressable, StyleSheet, TextInput, View } from 'react-native';

import { getChords, searchChords, type Chord } from '@/content';
import { MASTERED_LEVEL, getAllChordMastery } from '@/db/mastery';
import { syncContent } from '@/db/seed';
import { ChordDiagram } from '@/ui/ChordDiagram';
import { MasteryDots } from '@/ui/components/MasteryDots';
import { Text } from '@/ui/components/Text';
import { radius, spacing } from '@/ui/theme';
import { useTheme } from '@/ui/ThemeProvider';

type Filter = 'all' | 'mastered' | 'learning' | 'notStarted';

const FILTERS: readonly Filter[] = ['all', 'mastered', 'learning', 'notStarted'];

export default function ChordsScreen() {
  const { t } = useTranslation();
  const theme = useTheme();
  const router = useRouter();

  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<Filter>('all');

  // Seeding is idempotent and returns immediately once the bundled content
  // version already matches what is in the database.
  const mastery = useMemo(() => {
    syncContent();
    return getAllChordMastery();
  }, []);

  const chords = useMemo(() => {
    const matching = query ? searchChords(query) : getChords();
    if (filter === 'all') return matching;

    return matching.filter((chord) => {
      const level = mastery.get(chord.id)?.level ?? 0;
      if (filter === 'mastered') return level >= MASTERED_LEVEL;
      if (filter === 'learning') return level > 0 && level < MASTERED_LEVEL;
      return level === 0;
    });
  }, [query, filter, mastery]);

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
      <TextInput
        value={query}
        onChangeText={setQuery}
        placeholder={t('chords.searchPlaceholder')}
        placeholderTextColor={theme.colors.textMuted}
        autoCapitalize="characters"
        autoCorrect={false}
        style={[
          styles.search,
          {
            backgroundColor: theme.colors.surface,
            borderColor: theme.colors.border,
            color: theme.colors.text,
          },
        ]}
      />

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
                {t(option === 'all' ? 'chords.allChords' : `chords.${option}`)}
              </Text>
            </Pressable>
          );
        })}
      </View>

      <FlatList
        data={chords}
        keyExtractor={(chord) => chord.id}
        numColumns={3}
        columnWrapperStyle={styles.row}
        contentContainerStyle={styles.list}
        renderItem={({ item }) => (
          <ChordTile
            chord={item}
            level={mastery.get(item.id)?.level ?? 0}
            onPress={() => router.push(`/chords/${item.id}`)}
          />
        )}
      />
    </View>
  );
}

function ChordTile({
  chord,
  level,
  onPress,
}: {
  chord: Chord;
  level: number;
  onPress: () => void;
}) {
  const theme = useTheme();
  const shape = chord.shapes[0];
  if (!shape) return null;

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.tile,
        {
          backgroundColor: theme.colors.surface,
          borderColor: theme.colors.border,
          opacity: pressed ? 0.7 : 1,
        },
      ]}
    >
      <Text variant="heading">{chord.nameEn}</Text>
      <ChordDiagram shape={shape} size={84} showFingers={false} />
      <MasteryDots level={level} size={5} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, paddingHorizontal: spacing.lg, paddingTop: spacing.md },
  search: {
    height: 44,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    textAlign: 'auto',
  },
  filters: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
    marginTop: spacing.md,
  },
  chip: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs + 2,
    borderRadius: radius.pill,
    borderWidth: StyleSheet.hairlineWidth,
  },
  list: { paddingVertical: spacing.lg, gap: spacing.md },
  row: { gap: spacing.md },
  tile: {
    flex: 1,
    alignItems: 'center',
    gap: spacing.xs,
    paddingVertical: spacing.md,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: radius.lg,
  },
});
