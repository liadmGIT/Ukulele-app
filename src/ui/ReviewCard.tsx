import { MaterialCommunityIcons } from '@expo/vector-icons';
import React from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';

import type { PerformanceMetrics } from '@/analysis/metrics';
import { reviewHeadlineKey, reviewNoteKey, type Review } from '@/analysis/review';

import { Card } from './components/Card';
import { Text } from './components/Text';
import { radius, spacing } from './theme';
import { useTheme } from './ThemeProvider';

/**
 * The written feedback on a take.
 *
 * The good news comes first and is always present, then at most three things to
 * work on. Reversing that order — problems first — turns a practice tool into a
 * report card, and the point is to get the learner to pick the instrument up
 * again tomorrow.
 */

type ReviewCardProps = {
  review: Review;
  metrics: PerformanceMetrics;
};

export function ReviewCard({ review, metrics }: ReviewCardProps) {
  const { t } = useTranslation();
  const theme = useTheme();

  const scoreColour =
    review.score >= 85
      ? theme.colors.success
      : review.score >= 60
        ? theme.colors.accent
        : theme.colors.danger;

  return (
    <View style={styles.container}>
      <Card>
        <View style={styles.headline}>
          <View style={styles.headlineText}>
            <Text variant="title">{t(reviewHeadlineKey(review))}</Text>
            <Text variant="caption" tone="muted">
              {t('review.playedOf', {
                played: metrics.playedCount,
                expected: metrics.expectedCount,
              })}
            </Text>
          </View>
          <View style={[styles.score, { borderColor: scoreColour }]}>
            <Text variant="title" style={{ color: scoreColour }}>
              {review.score}
            </Text>
          </View>
        </View>

        <View style={styles.scores}>
          <ScorePill label={t('review.timingScore')} value={metrics.timing.score} />
          {/*
            A pattern with no accents, or a take too short to compare, cannot be
            scored for dynamics. Showing the 0 that stands in for "not measured"
            would read as a bad mark for something the learner never got wrong.
          */}
          <ScorePill
            label={t('review.dynamicsScore')}
            value={metrics.dynamics.applicable ? metrics.dynamics.score : null}
            muted={!metrics.dynamics.applicable}
          />
        </View>
      </Card>

      <Card>
        <View style={styles.noteHeader}>
          <MaterialCommunityIcons
            name="check-circle-outline"
            size={18}
            color={theme.colors.success}
          />
          <Text variant="label" tone="muted">
            {t('review.whatWorked')}
          </Text>
        </View>
        <Text variant="body">{t(reviewNoteKey(review.positive), review.positive.params)}</Text>
      </Card>

      {review.notes.length > 0 && (
        <Card>
          <View style={styles.noteHeader}>
            <MaterialCommunityIcons
              name="lightbulb-on-outline"
              size={18}
              color={theme.colors.accent}
            />
            <Text variant="label" tone="muted">
              {t('review.whatToImprove')}
            </Text>
          </View>
          {review.notes.map((note) => (
            <View key={note.id} style={styles.note}>
              <View style={[styles.bullet, { backgroundColor: theme.colors.accent }]} />
              <Text variant="body" style={styles.noteText}>
                {t(reviewNoteKey(note), note.params)}
              </Text>
            </View>
          ))}
        </Card>
      )}
    </View>
  );
}

function ScorePill({
  label,
  value,
  muted = false,
}: {
  label: string;
  /** Null when the dimension could not be measured. */
  value: number | null;
  muted?: boolean;
}) {
  const theme = useTheme();

  return (
    <View
      style={[
        styles.pill,
        { backgroundColor: theme.colors.surfaceAlt, opacity: muted ? 0.5 : 1 },
      ]}
    >
      <Text variant="caption" tone="muted">
        {label}
      </Text>
      <Text variant="heading">{value ?? '—'}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { gap: spacing.lg },
  headline: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  headlineText: { gap: 2, flexShrink: 1 },
  score: {
    width: 62,
    height: 62,
    borderRadius: 31,
    borderWidth: 3,
    alignItems: 'center',
    justifyContent: 'center',
  },
  scores: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.sm },
  pill: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: spacing.sm,
    borderRadius: radius.md,
    gap: 2,
  },
  noteHeader: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  note: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.sm, marginTop: spacing.xs },
  bullet: { width: 6, height: 6, borderRadius: 3, marginTop: 9 },
  noteText: { flex: 1 },
});
