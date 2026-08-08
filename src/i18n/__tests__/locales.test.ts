import en from '../locales/en.json';
import he from '../locales/he.json';

/**
 * Guards against the failure modes that are invisible in normal use: a string
 * translated in one language but not the other, a mismatched placeholder, or a
 * missing plural form.
 *
 * The plural check earns its keep. Hebrew has a dual category — `select(2)` is
 * `'two'`, not `'other'` — so a phrase with only `_one` and `_other` renders
 * the raw key when the count happens to be exactly two, and nothing catches it
 * until a user has a two-day streak.
 */

const PLURAL_SUFFIXES = ['zero', 'one', 'two', 'few', 'many', 'other'] as const;

type Json = { [key: string]: string | Json };

function flatten(value: Json, prefix = ''): Map<string, string> {
  const result = new Map<string, string>();

  for (const [key, child] of Object.entries(value)) {
    const path = prefix ? `${prefix}.${key}` : key;
    if (typeof child === 'string') result.set(path, child);
    else for (const [nested, text] of flatten(child, path)) result.set(nested, text);
  }

  return result;
}

/** Splits `today.streakDays_one` into its base path and plural category. */
function splitPlural(path: string): { base: string; category: string } | null {
  const match = /^(.*)_([a-z]+)$/.exec(path);
  if (!match) return null;

  const [, base, category] = match;
  if (!base || !category) return null;
  if (!(PLURAL_SUFFIXES as readonly string[]).includes(category)) return null;

  return { base, category };
}

function placeholders(text: string): string[] {
  return [...text.matchAll(/\{\{(\w+)\}\}/g)].map((match) => match[1]!).sort();
}

const locales = {
  en: flatten(en as Json),
  he: flatten(he as Json),
};

/** Base paths and the categories each locale provides for them. */
function pluralGroups(entries: Map<string, string>): Map<string, Set<string>> {
  const groups = new Map<string, Set<string>>();

  for (const path of entries.keys()) {
    const split = splitPlural(path);
    if (!split) continue;

    const existing = groups.get(split.base) ?? new Set<string>();
    existing.add(split.category);
    groups.set(split.base, existing);
  }

  return groups;
}

describe('translations', () => {
  it.each(Object.entries(locales))('%s has no empty strings', (_language, entries) => {
    for (const [path, text] of entries) {
      expect(text.trim().length).toBeGreaterThan(0);
      expect(path).not.toMatch(/\s/);
    }
  });

  it('covers the same keys in both languages', () => {
    // Plural keys are deliberately excluded: English has no dual form, so
    // `streakDays_two` exists only in Hebrew and comparing literal keys would
    // be wrong. Plural coverage is checked per-language by category below.
    const singular = (entries: Map<string, string>) =>
      [...entries.keys()].filter((key) => splitPlural(key) === null);

    const englishKeys = singular(locales.en);
    const hebrewKeys = singular(locales.he);

    const missingFromHebrew = englishKeys.filter((key) => !locales.he.has(key));
    const missingFromEnglish = hebrewKeys.filter((key) => !locales.en.has(key));

    expect({ missingFromHebrew, missingFromEnglish }).toEqual({
      missingFromHebrew: [],
      missingFromEnglish: [],
    });
  });

  it('uses the same interpolation placeholders in both languages', () => {
    const mismatched: string[] = [];

    for (const [path, english] of locales.en) {
      const hebrew = locales.he.get(path);
      if (hebrew === undefined) continue;

      const a = placeholders(english);
      const b = placeholders(hebrew);
      if (a.join(',') !== b.join(',')) {
        mismatched.push(`${path}: en[${a.join(',')}] vs he[${b.join(',')}]`);
      }
    }

    expect(mismatched).toEqual([]);
  });

  it.each(Object.entries(locales))(
    '%s provides every plural form its language requires',
    (language, entries) => {
      const required = new Intl.PluralRules(language).resolvedOptions().pluralCategories;
      const missing: string[] = [];

      for (const [base, provided] of pluralGroups(entries)) {
        for (const category of required) {
          if (!provided.has(category)) missing.push(`${base}_${category}`);
        }
      }

      expect(missing).toEqual([]);
    },
  );

  it('declares plurals in both languages or neither', () => {
    const english = [...pluralGroups(locales.en).keys()].sort();
    const hebrew = [...pluralGroups(locales.he).keys()].sort();
    expect(english).toEqual(hebrew);
  });

  it('actually renders the Hebrew dual form', () => {
    // The concrete regression: a two-day streak used to print the raw key.
    expect(new Intl.PluralRules('he').select(2)).toBe('two');
    expect(locales.he.get('today.streakDays_two')).toBeDefined();
    expect(locales.he.get('metronome.countInBars_two')).toBeDefined();
  });
});
