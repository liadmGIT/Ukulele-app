/**
 * Design tokens for the app. Warm, wooden, instrument-adjacent palette rather
 * than the default blue — the app should feel like an instrument, not a form.
 */

export const palette = {
  koa900: '#2A1B12',
  koa800: '#3D2A1C',
  koa700: '#5A3E29',
  koa500: '#8A6240',
  koa300: '#C9A47B',
  koa100: '#EFE1CE',
  koa50: '#FAF3E9',

  sea600: '#146E63',
  sea500: '#1B8C7E',
  sea300: '#6FC3B6',

  coral600: '#C4462F',
  coral500: '#E4593F',

  sun500: '#E8A33D',
  /**
   * The amber above, dark enough to be read as text on a light background.
   * `sun500` on white is 2.16:1, which fails even the large-text threshold —
   * and the take score, the number a learner most wants to read, was drawn in
   * it. This is 5.4:1 on white and 4.9:1 on the app background.
   */
  sun700: '#965E12',

  white: '#FFFFFF',
  black: '#000000',
} as const;

export type ThemeName = 'light' | 'dark';

export type Theme = {
  name: ThemeName;
  colors: {
    background: string;
    surface: string;
    surfaceAlt: string;
    border: string;
    text: string;
    textMuted: string;
    textInverse: string;
    primary: string;
    onPrimary: string;
    accent: string;
    /**
     * `accent` when it is being *read* rather than filled. Separate because a
     * colour bright enough to work as a filled pip is too bright to be text.
     */
    accentText: string;
    success: string;
    warning: string;
    danger: string;
    /** Mastery levels 0-5, index = level. */
    mastery: readonly [string, string, string, string, string, string];
  };
};

export const lightTheme: Theme = {
  name: 'light',
  colors: {
    background: palette.koa50,
    surface: palette.white,
    surfaceAlt: palette.koa100,
    border: '#E2D4C0',
    text: palette.koa900,
    textMuted: '#7A6653',
    textInverse: palette.white,
    primary: palette.sea600,
    onPrimary: palette.white,
    accent: palette.sun500,
    accentText: palette.sun700,
    // sea500 under white text is 4.12:1, just under the readable threshold for
    // the captions that sit on it — the "you can play this" badge and the
    // settled-string tile. sea600 is 6.1:1.
    success: palette.sea600,
    warning: palette.sun500,
    danger: palette.coral600,
    mastery: ['#E2D4C0', '#D8C6AC', '#C9A47B', '#8AB9A8', '#3E9E8C', '#146E63'],
  },
};

export const darkTheme: Theme = {
  name: 'dark',
  colors: {
    background: '#17100B',
    surface: palette.koa900,
    surfaceAlt: palette.koa800,
    border: '#4A3627',
    text: palette.koa50,
    textMuted: '#B49B80',
    textInverse: palette.koa900,
    primary: palette.sea300,
    onPrimary: palette.koa900,
    accent: palette.sun500,
    // On the dark background the bright amber is already 7.7:1.
    accentText: palette.sun500,
    success: palette.sea300,
    warning: palette.sun500,
    danger: palette.coral500,
    mastery: ['#3A2B1E', '#4E3A28', '#6E5133', '#3E7A6E', '#2F9E8B', '#6FC3B6'],
  },
};

/** 4pt spacing scale. */
export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  xxl: 32,
  xxxl: 48,
} as const;

export const radius = {
  sm: 6,
  md: 10,
  lg: 16,
  pill: 999,
} as const;

export const typography = {
  display: { fontSize: 32, lineHeight: 40, fontWeight: '700' },
  title: { fontSize: 24, lineHeight: 32, fontWeight: '700' },
  heading: { fontSize: 19, lineHeight: 26, fontWeight: '600' },
  body: { fontSize: 16, lineHeight: 24, fontWeight: '400' },
  label: { fontSize: 14, lineHeight: 20, fontWeight: '600' },
  caption: { fontSize: 12, lineHeight: 16, fontWeight: '500' },
  /** Chord names and note letters read better in a fixed width face. */
  mono: { fontSize: 16, lineHeight: 22, fontWeight: '600' },
} as const;
