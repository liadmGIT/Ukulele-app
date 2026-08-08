import { I18nManager, type ViewStyle } from 'react-native';

/**
 * Rows that must not follow the interface's reading direction.
 *
 * React Native flips `flexDirection: 'row'` when the layout is RTL, which is
 * right for text and wrong for anything that depicts the instrument or the
 * passage of time. Strings run G-C-E-A across the fretboard and music runs
 * left to right through a bar in every language — a Hebrew learner reading
 * "A E C G" or a rhythm strip that plays backwards would be learning something
 * false about the instrument.
 *
 * Use this for: string rows, fretboards, beat indicators, rhythm strips,
 * timelines and progress bars. Do *not* use it for ordinary content rows,
 * which should mirror like the rest of the interface.
 */
export const musicalRow: ViewStyle = {
  flexDirection: I18nManager.isRTL ? 'row-reverse' : 'row',
};

/** True when the interface is laid out right to left. */
export function isRtlLayout(): boolean {
  return I18nManager.isRTL;
}
