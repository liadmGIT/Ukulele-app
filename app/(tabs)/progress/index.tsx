import { useRouter } from 'expo-router';
import React, { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, StyleSheet, View } from 'react-native';

import { effectiveLevel, isRusty, nextRequirement, MAX_LEVEL } from '@/analysis/mastery';
import { reviewHeadlineKey } from '@/analysis/review';
import { practiceStreak } from '@/analysis/session';
import { getChordById } from '@/content';
import { getAllChordMastery, MASTERED_LEVEL } from '@/db/mastery';
import { getPracticeDays, getPracticeMinutes, listDrillResults } from '@/db/progress';
import { listTakes } from '@/db/recordings';
import { Card } from '@/ui/components/Card';
import { Screen } from '@/ui/components/Screen';
import { Text } from '@/ui/components/Text';
import { musicalRow } from '@/ui/direction';
import { radius, spacing } from '@/ui/theme';
import { useTheme } from '@/ui/ThemeProvider';

export default function ProgressScreen() {
  const { t } = useTranslation();
  const theme = useTheme();
  const router = useRouter();

  // One timestamp for the life of the screen, so every level shown was
  // decayed against the same moment.
  const [now] = useState(() => Date.now());

  const data = useMemo(() => {
    const mastery = [...getAllChordMastery().values()];

    const withLevels = mastery
      .map((entry) => {
        const state = {
          level: entry.level,
          sessionsPractised: entry.sessionsPractised,
          lastPractisedAt: entry.lastPractisedAt,
        };
        return {
          chordId: entry.chordId,
          state,
          effective: effectiveLevel(state, now),
          rusty: isRusty(state, now),
        };
      })
      .filter((entry) => entry.state.level > 0)
      .sort((a, b) => b.effective - a.effective || a.chordId.localeCompare(b.chordId));

    return {
      started: withLevels,
      mastered: withLevels.filter((entry) => entry.effective >= MASTERED_LEVEL).length,
      learning: withLevels.filter((entry) => entry.effective < MASTERED_LEVEL).length,
      minutes: getPracticeMinutes(7),
      streak: practiceStreak(getPracticeDays(), now),
      drills: listDrillResults(5),
      takes: listTakes(5),
    };
  }, [now]);

  const weekMinutes = data.minutes.reduce((sum, entry) => sum + entry.minutes, 0);
  const peak = Math.max(1, ...data.minutes.map((entry) => entry.minutes));

  return (
    <Screen>
      <Text variant="body" tone="muted">
        {t('progress.subtitle')}
      </Text>

      <View style={styles.stats}>
        <Stat label={t('progress.chordsMastered')} value={data.mastered} />
        <Stat label={t('progress.chordsLearning')} value={data.learning} />
        <Stat label={t('progress.minutesThisWeek')} value={weekMinutes} />
      </View>

      {data.streak > 0 && (
        <Text variant="label" tone="primary">
          {t('progress.streak', { count: data.streak })}
        </Text>
      )}

      <Card>
        <Text variant="label" tone="muted">
          {t('progress.minutesThisWeek')}
        </Text>
        <View style={[styles.chart, musicalRow]}>
          {data.minutes.map((entry) => (
            <View key={entry.day} style={styles.barColumn}>
              <View
                style={[
                  styles.bar,
                  {
                    // A zero day still shows a sliver, so the week reads as
                    // seven days rather than a gap.
                    height: Math.max(3, (entry.minutes / peak) * 90),
                    backgroundColor:
                      entry.minutes > 0 ? theme.colors.primary : theme.colors.border,
                  },
                ]}
              />
              <Text variant="caption" tone="muted">
                {new Date(entry.day).toLocaleDateString(undefined, { weekday: 'narrow' })}
              </Text>
            </View>
          ))}
        </View>
      </Card>

      <Card>
        <Text variant="label" tone="muted">
          {t('progress.masteryLevel')}
        </Text>

        {data.started.length === 0 ? (
          <Text variant="body" tone="muted">
            {t('progress.noPracticeYet')}
          </Text>
        ) : (
          data.started.map((entry) => {
            const chord = getChordById(entry.chordId);
            const target = nextRequirement(entry.state);

            return (
              <Pressable
                key={entry.chordId}
                onPress={() => router.push(`/chords/${entry.chordId}`)}
                style={styles.masteryRow}
              >
                <Text variant="mono" style={styles.chordName}>
                  {chord?.nameEn ?? entry.chordId}
                </Text>

                <View style={[styles.levelBar, musicalRow]}>
                  {Array.from({ length: MAX_LEVEL }, (_, index) => (
                    <View
                      key={index}
                      style={[
                        styles.levelPip,
                        {
                          backgroundColor:
                            index < entry.effective
                              ? theme.colors.mastery[entry.effective] ?? theme.colors.primary
                              : theme.colors.border,
                        },
                      ]}
                    />
                  ))}
                </View>

                {/*
                  This printed "85 · 90%" — the two raw numbers with a dot
                  between them. The translated sentence naming what they mean
                  was already in both locale files, unused.
                */}
                <Text variant="caption" tone={entry.rusty ? 'danger' : 'muted'} style={styles.target}>
                  {entry.rusty
                    ? t('progress.rusty')
                    : target
                      ? t('progress.nextTarget', {
                          score: target.score,
                          tempo: Math.round(target.tempoFraction * 100),
                        })
                      : '★'}
                </Text>
              </Pressable>
            );
          })
        )}
      </Card>

      {data.drills.length > 0 && (
        <Card>
          <Text variant="label" tone="muted">
            {t('practice.chordChangeDrill')}
          </Text>
          {data.drills.map((drill) => (
            <View key={drill.id} style={styles.listRow}>
              <Text variant="body">
                {getChordById(drill.chordA)?.nameEn} ↔ {getChordById(drill.chordB)?.nameEn}
              </Text>
              <Text variant="label" tone="primary">
                {drill.changesPerMinute}
              </Text>
            </View>
          ))}
        </Card>
      )}

      <Card>
        <Text variant="label" tone="muted">
          {t('progress.recentTakes')}
        </Text>
        {data.takes.length === 0 ? (
          <Text variant="body" tone="muted">
            {t('progress.noTakes')}
          </Text>
        ) : (
          data.takes.map((take) => (
            <View key={take.id} style={styles.listRow}>
              <View style={styles.takeText}>
                <Text variant="body">{t(reviewHeadlineKey(take.review))}</Text>
                <Text variant="caption" tone="muted">
                  {new Date(take.createdAt).toLocaleDateString()}
                </Text>
              </View>
              <Text variant="label" tone="primary">
                {take.review.score}
              </Text>
            </View>
          ))
        )}
      </Card>
    </Screen>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  const theme = useTheme();

  return (
    <View style={[styles.stat, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border }]}>
      <Text variant="title">{value}</Text>
      <Text variant="caption" tone="muted" numberOfLines={2}>
        {label}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  stats: { flexDirection: 'row', gap: spacing.sm },
  stat: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: spacing.md,
    borderRadius: radius.md,
    borderWidth: StyleSheet.hairlineWidth,
    gap: 2,
  },
  // Days run left to right through the week regardless of interface direction.
  chart: { alignItems: 'flex-end', gap: spacing.sm, height: 116, marginTop: spacing.sm },
  barColumn: { flex: 1, alignItems: 'center', gap: spacing.xs },
  bar: { width: '70%', borderRadius: 4 },
  masteryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: spacing.sm,
    gap: spacing.sm,
  },
  chordName: { minWidth: 56 },
  target: { flexShrink: 1, textAlign: 'right', maxWidth: 132 },
  levelBar: { gap: 3, flex: 1, justifyContent: 'center' },
  levelPip: { width: 18, height: 6, borderRadius: 3 },
  listRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: spacing.xs,
    gap: spacing.sm,
  },
  takeText: { flex: 1, gap: 2 },
});
