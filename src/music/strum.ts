import { stepsPerBar, type Subdivision, type TimeSignature } from './grid';

/**
 * Strum patterns: the notation, the parser, and the model behind the rhythm
 * guide.
 *
 * A step says four things, which together are the whole of what a strumming
 * guide has to convey: which way the hand moves, whether it strikes at all,
 * whether the strings ring or are damped, and how hard.
 *
 * ## Notation
 *
 * ```
 * token   := '-'                    rest — the hand may keep moving, but does not strike
 *          | dir accent? mute?
 * dir     := 'D' | 'U'              down / up, normal force
 *          | 'd' | 'u'              down / up, soft
 * accent  := '!'                    strong
 * mute    := 'x'                    damped percussive "chnk" instead of ringing
 * ```
 *
 * `'X'` is shorthand for `'Dx'` and `'X!'` for `'D!x'`: the muted down-stroke
 * is common enough in strumming to have earned its own glyph, and `X` reads far
 * better in a pattern than `Dx`.
 *
 * So the island strum is `D - D u - u D u`, and a chnk on beats 2 and 4 is
 * `D u X u D u X u`.
 *
 * `'d!'` is rejected rather than quietly resolved: lowercase means soft and `!`
 * means strong, so the token contradicts itself and almost certainly means the
 * author made a mistake.
 */

export type StrumDirection = 'D' | 'U' | 'rest';
export type StrumAccent = 'strong' | 'normal' | 'soft';

export type StrumStep = {
  dir: StrumDirection;
  /** Damped percussive stroke rather than a ringing one. */
  muted: boolean;
  accent: StrumAccent;
};

export const REST: StrumStep = { dir: 'rest', muted: false, accent: 'normal' };

export class StrumNotationError extends Error {
  constructor(
    message: string,
    readonly token: string,
    readonly index: number,
  ) {
    super(message);
    this.name = 'StrumNotationError';
  }
}

const TOKEN_PATTERN = /^([DUdu])(!?)(x?)$/;

/**
 * Parses one token.
 *
 * Exported so the content validator can report which token in which pattern is
 * wrong, rather than just that a pattern failed.
 */
export function parseStrumToken(token: string, index = 0): StrumStep {
  if (token === '-') return { ...REST };

  // Shorthand for the muted down-stroke.
  if (token === 'X') return { dir: 'D', muted: true, accent: 'normal' };
  if (token === 'X!') return { dir: 'D', muted: true, accent: 'strong' };
  if (token === 'x') return { dir: 'D', muted: true, accent: 'soft' };

  const match = TOKEN_PATTERN.exec(token);
  if (!match) {
    throw new StrumNotationError(
      `Token ${index + 1} "${token}" is not a valid strum step. Expected one of ` +
        `- D U d u X x, optionally with ! (strong) or x (muted).`,
      token,
      index,
    );
  }

  const [, direction, strong, muted] = match as unknown as [string, string, string, string];
  const isSoft = direction === direction.toLowerCase();

  if (isSoft && strong === '!') {
    throw new StrumNotationError(
      `Token ${index + 1} "${token}" is contradictory: lowercase means soft, "!" means strong.`,
      token,
      index,
    );
  }

  return {
    dir: direction.toUpperCase() === 'D' ? 'D' : 'U',
    muted: muted === 'x',
    accent: strong === '!' ? 'strong' : isSoft ? 'soft' : 'normal',
  };
}

/** Parses a whole pattern. Whitespace between tokens is free-form. */
export function parseStrumPattern(notation: string): StrumStep[] {
  const tokens = notation.trim().split(/\s+/).filter(Boolean);

  if (tokens.length === 0) {
    throw new StrumNotationError('A strum pattern cannot be empty.', notation, 0);
  }

  return tokens.map((token, index) => parseStrumToken(token, index));
}

export function formatStrumStep(step: StrumStep): string {
  if (step.dir === 'rest') return '-';

  if (step.muted && step.dir === 'D') {
    // Round-trip through the shorthand, which is what content files use.
    if (step.accent === 'strong') return 'X!';
    if (step.accent === 'soft') return 'x';
    return 'X';
  }

  const letter = step.accent === 'soft' ? step.dir.toLowerCase() : step.dir;
  const accent = step.accent === 'strong' ? '!' : '';
  const mute = step.muted ? 'x' : '';

  return `${letter}${accent}${mute}`;
}

export function formatStrumPattern(steps: readonly StrumStep[]): string {
  return steps.map(formatStrumStep).join(' ');
}

/**
 * How many bars a pattern spans.
 *
 * Throws when the step count is not a whole number of bars — a pattern that
 * stops halfway through a bar would silently desynchronise from the song.
 */
export function patternBars(
  steps: readonly StrumStep[],
  timeSignature: TimeSignature,
  subdivision: Subdivision,
): number {
  const perBar = stepsPerBar(timeSignature, subdivision);
  const bars = steps.length / perBar;

  if (!Number.isInteger(bars)) {
    throw new Error(
      `A pattern of ${steps.length} steps is not a whole number of bars ` +
        `(${timeSignature.beatsPerBar}/${timeSignature.beatUnit} at ${subdivision}ths is ` +
        `${perBar} steps per bar).`,
    );
  }

  return bars;
}

/** True when the step makes a sound — used to decide what to schedule. */
export function isAudible(step: StrumStep): boolean {
  return step.dir !== 'rest';
}

/** Relative loudness of a step, 0..1. Shared by the synth and the strip. */
export function accentGain(accent: StrumAccent): number {
  switch (accent) {
    case 'strong':
      return 1;
    case 'soft':
      return 0.35;
    default:
      return 0.65;
  }
}

/**
 * i18n keys describing a step, for the rhythm strip's accessibility label.
 *
 * Returns keys rather than text so the caller translates them — a screen reader
 * in Hebrew must say "מטה, חזק", not "down, strong".
 */
export function describeStep(step: StrumStep): string[] {
  if (step.dir === 'rest') return ['rhythm.rest'];

  const keys = [step.dir === 'D' ? 'rhythm.down' : 'rhythm.up'];
  if (step.muted) keys.push('rhythm.muted');
  if (step.accent === 'strong') keys.push('rhythm.strong');
  if (step.accent === 'soft') keys.push('rhythm.soft');

  return keys;
}

/**
 * Counting syllables under each step: `1 & 2 & …` for eighths, `1 e & a …` for
 * sixteenths. Beginners are told to count out loud, and the strip should show
 * them exactly what to say.
 */
export function countingSyllables(
  timeSignature: TimeSignature,
  subdivision: Subdivision,
): string[] {
  const perBar = stepsPerBar(timeSignature, subdivision);
  const perBeat = perBar / timeSignature.beatsPerBar;

  const offbeats: Record<number, readonly string[]> = {
    1: [],
    2: ['&'],
    3: ['trip', 'let'],
    4: ['e', '&', 'a'],
  };

  const syllables = offbeats[perBeat];
  if (!syllables) {
    // Unusual subdivision: fall back to numbering every step.
    return Array.from({ length: perBar }, (_, i) => String(i + 1));
  }

  return Array.from({ length: perBar }, (_, index) => {
    const withinBeat = index % perBeat;
    if (withinBeat === 0) return String(Math.floor(index / perBeat) + 1);
    return syllables[withinBeat - 1] ?? '';
  });
}
