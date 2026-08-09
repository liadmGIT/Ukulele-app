import React, { useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { ScrollView, StyleSheet, View } from 'react-native';

import { getChordById } from '@/content';
import type { SongBar, SongTimeline } from '@/music/song';

import { Text } from './components/Text';
import { musicalRow } from './direction';
import { radius, spacing } from './theme';
import { useTheme } from './ThemeProvider';

/**
 * The chord chart, scrolling itself to keep the current bar in view.
 *
 * Bars are laid out in rows of four, the way chord charts are written, and the
 * chart always runs left to right — it is a picture of the song's progress
 * through time, so it does not mirror in Hebrew any more than the rhythm strip
 * does. The cue word sits under its bar for public-domain songs, which is what
 * lets a learner follow along without the app shipping a lyric sheet.
 */

const BARS_PER_ROW = 4;
/** Row height plus gap; used to scroll the current bar into view. */
const ROW_HEIGHT = 72;

const SECTION_KEYS: Record<SongBar['sectionKind'], string> = {
  intro: 'songs.sectionIntro',
  verse: 'songs.sectionVerse',
  prechorus: 'songs.sectionPrechorus',
  chorus: 'songs.sectionChorus',
  bridge: 'songs.sectionBridge',
  instrumental: 'songs.sectionInstrumental',
  outro: 'songs.sectionOutro',
};

type SongChartProps = {
  timeline: SongTimeline;
  currentBarIndex: number | null;
  height?: number;
};

export function SongChart({ timeline, currentBarIndex, height = 300 }: SongChartProps) {
  const { t } = useTranslation();
  const theme = useTheme();
  const scroller = useRef<ScrollView>(null);

  // Keep the playing bar a row from the top, so what comes next is visible —
  // a learner needs to read ahead, not watch where they already are.
  useEffect(() => {
    if (currentBarIndex === null) return;

    const row = Math.floor(currentBarIndex / BARS_PER_ROW);
    scroller.current?.scrollTo({
      y: Math.max(0, (row - 1) * ROW_HEIGHT),
      animated: true,
    });
  }, [currentBarIndex]);

  const rows: SongBar[][] = [];
  for (const bar of timeline.bars) {
    const isNewSection = bar.startsSection;
    const lastRow = rows[rows.length - 1];

    if (isNewSection || !lastRow || lastRow.length === BARS_PER_ROW) {
      rows.push([bar]);
    } else {
      lastRow.push(bar);
    }
  }

  return (
    <ScrollView ref={scroller} style={{ height }} showsVerticalScrollIndicator={false}>
      {rows.map((row, rowIndex) => {
        const first = row[0]!;
        return (
          <View key={rowIndex}>
            {first.startsSection && (
              <Text variant="caption" tone="primary" style={styles.sectionLabel}>
                {first.sectionLabel ?? t(SECTION_KEYS[first.sectionKind])}
              </Text>
            )}

            <View style={[styles.row, musicalRow]}>
              {row.map((bar) => {
                const active = bar.index === currentBarIndex;
                return (
                  <View
                    key={bar.index}
                    style={[
                      styles.bar,
                      {
                        borderColor: active ? theme.colors.primary : theme.colors.border,
                        backgroundColor: active ? theme.colors.surfaceAlt : 'transparent',
                        borderWidth: active ? 2 : StyleSheet.hairlineWidth,
                      },
                    ]}
                  >
                    <View style={[styles.barChords, musicalRow]}>
                      {bar.chords.map((slot, index) => (
                        <Text
                          key={index}
                          variant={bar.chords.length > 1 ? 'label' : 'heading'}
                          tone={active ? 'primary' : 'default'}
                        >
                          {getChordById(slot.chordId)?.nameEn ?? '?'}
                        </Text>
                      ))}
                    </View>

                    {bar.chords[0]?.cueWord ? (
                      <Text variant="caption" tone="muted" numberOfLines={1}>
                        {bar.chords[0].cueWord}
                      </Text>
                    ) : (
                      <Text variant="caption" tone="muted">
                        {' '}
                      </Text>
                    )}
                  </View>
                );
              })}

              {/* Pad short rows so bars keep a constant width. */}
              {Array.from({ length: BARS_PER_ROW - row.length }, (_, index) => (
                <View key={`pad-${index}`} style={styles.pad} />
              ))}
            </View>
          </View>
        );
      })}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  sectionLabel: { marginTop: spacing.md, marginBottom: spacing.xs },
  // Bars run left to right through time, regardless of the interface direction.
  row: { gap: spacing.sm, marginBottom: spacing.sm },
  bar: {
    flex: 1,
    minHeight: 56,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.xs,
    gap: 2,
  },
  barChords: { gap: spacing.xs, alignItems: 'baseline' },
  pad: { flex: 1 },
});
