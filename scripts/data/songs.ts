/**
 * Song arrangements, written compactly and expanded by `scripts/gen-songs.ts`.
 *
 * ## Bar notation
 *
 * Sections are written as bars separated by `|`. A bar holds one or more chord
 * names; with more than one, the bar's beats are split evenly, or given
 * explicitly with `:beats`.
 *
 * ```
 * 'C | Am | F G | C'        four bars, the third splitting between F and G
 * 'C:3 G:1'                 one bar of 4/4, three beats of C and one of G
 * ```
 *
 * ## Cue words
 *
 * `cues` gives the syllable each bar lands on, aligned to the bars in order,
 * and is only permitted on public-domain songs — see `CONTENT.md`. Use `''` to
 * skip a bar. Modern songs are chords and structure only; the player navigates
 * them by section and bar number instead.
 *
 * ## A note on accuracy
 *
 * A wrong progression teaches a wrong song, and unlike a wrong chord diagram
 * the learner may never find out. Every arrangement here is the common,
 * widely-taught simple version, and `source` records that. Arrangements vary
 * legitimately; these are starting points for a beginner, not definitive
 * transcriptions.
 */

export type SectionSource = {
  kind: 'intro' | 'verse' | 'prechorus' | 'chorus' | 'bridge' | 'instrumental' | 'outro';
  label?: string;
  patternId?: string;
  /** Bars separated by `|`. */
  bars: string;
  /** One entry per bar; public-domain songs only. */
  cues?: string[];
};

export type SongSource = {
  id: string;
  titleHe: string;
  titleEn: string;
  artistHe: string;
  artistEn: string;
  language: 'he' | 'en';
  songKey: string;
  bpm: number;
  beatsPerBar?: number;
  beatUnit?: 4 | 8;
  difficulty: 1 | 2 | 3 | 4 | 5;
  defaultPatternId: string;
  source: string;
  publicDomain: boolean;
  sections: SectionSource[];
};

const TRADITIONAL_HE = 'מסורתי';
const TRADITIONAL_EN = 'Traditional';

export const SONGS: readonly SongSource[] = [
  // ------------------------------------------------ one and two chord songs --
  {
    id: 'frere-jacques',
    titleHe: 'אחינו יעקב',
    titleEn: 'Frère Jacques',
    artistHe: TRADITIONAL_HE,
    artistEn: TRADITIONAL_EN,
    language: 'en',
    songKey: 'C',
    bpm: 100,
    difficulty: 1,
    defaultPatternId: 'all-downs',
    source: 'Traditional round, single-chord arrangement',
    publicDomain: true,
    sections: [
      {
        kind: 'verse',
        bars: 'C | C | C | C | C | C | C | C',
        cues: ['Frère', 'Jacques', 'Dormez', 'vous', 'Sonnez', 'matines', 'Ding dang', 'dong'],
      },
    ],
  },
  {
    id: 'row-your-boat',
    titleHe: 'שיר המשוטים',
    titleEn: 'Row, Row, Row Your Boat',
    artistHe: TRADITIONAL_HE,
    artistEn: TRADITIONAL_EN,
    language: 'en',
    songKey: 'C',
    bpm: 96,
    difficulty: 1,
    defaultPatternId: 'all-downs',
    source: 'Traditional round, two-chord arrangement',
    publicDomain: true,
    sections: [
      {
        kind: 'verse',
        bars: 'C | C | C | C | C | C | C G7 | C',
        cues: ['Row', 'boat', 'Gently', 'stream', 'Merrily', 'merrily', 'Life is', 'dream'],
      },
    ],
  },
  {
    id: 'david-melech',
    titleHe: 'דוד מלך ישראל',
    titleEn: 'David Melech Yisrael',
    artistHe: TRADITIONAL_HE,
    artistEn: TRADITIONAL_EN,
    language: 'he',
    songKey: 'Am',
    bpm: 120,
    difficulty: 1,
    defaultPatternId: 'down-up',
    source: 'Traditional, two-chord arrangement',
    publicDomain: true,
    sections: [
      {
        kind: 'verse',
        bars: 'Am | Am | E7 | E7 | E7 | E7 | Am | Am',
        cues: ['דוד', 'מלך', 'ישראל', 'חי', 'חי', 'וקיים', 'דוד', 'מלך'],
      },
    ],
  },
  {
    id: 'shalom-chaverim',
    titleHe: 'שלום חברים',
    titleEn: 'Shalom Chaverim',
    artistHe: TRADITIONAL_HE,
    artistEn: TRADITIONAL_EN,
    language: 'he',
    songKey: 'Am',
    bpm: 84,
    difficulty: 2,
    defaultPatternId: 'ballad',
    source: 'Traditional round',
    publicDomain: true,
    sections: [
      {
        kind: 'verse',
        bars: 'Am | Am | Dm | E7 | Am | Am | E7 | Am',
        cues: ['שלום', 'חברים', 'שלום', 'חברים', 'שלום', 'שלום', 'להתראות', 'שלום'],
      },
    ],
  },

  // ------------------------------------------------ three chord traditionals --
  {
    id: 'twinkle-twinkle',
    titleHe: 'כוכב קטן',
    titleEn: 'Twinkle, Twinkle, Little Star',
    artistHe: TRADITIONAL_HE,
    artistEn: TRADITIONAL_EN,
    language: 'en',
    songKey: 'C',
    bpm: 92,
    difficulty: 1,
    defaultPatternId: 'all-downs',
    source: 'Traditional, standard three-chord arrangement',
    publicDomain: true,
    sections: [
      {
        kind: 'verse',
        bars: 'C | F C | G7 C | G7 C | C | F C | G7 C | C',
        cues: ['Twinkle', 'star', 'what you', 'are', 'Up a-', 'high', 'diamond', 'sky'],
      },
    ],
  },
  {
    id: 'when-the-saints',
    titleHe: 'כשהקדושים צועדים',
    titleEn: 'When the Saints Go Marching In',
    artistHe: TRADITIONAL_HE,
    artistEn: TRADITIONAL_EN,
    language: 'en',
    songKey: 'C',
    bpm: 116,
    difficulty: 2,
    defaultPatternId: 'boom-chnk',
    source: 'Traditional spiritual, standard three-chord arrangement',
    publicDomain: true,
    sections: [
      {
        kind: 'verse',
        bars: 'C | C | C | C | F | F | C | C | C | G7 | G7 | G7 | C F | C G7 | C | C',
      },
    ],
  },
  {
    id: 'he-got-the-whole-world',
    titleHe: 'כל העולם בידיו',
    titleEn: "He's Got the Whole World",
    artistHe: TRADITIONAL_HE,
    artistEn: TRADITIONAL_EN,
    language: 'en',
    songKey: 'C',
    bpm: 104,
    difficulty: 1,
    defaultPatternId: 'down-up',
    source: 'Traditional spiritual',
    publicDomain: true,
    sections: [
      {
        kind: 'verse',
        bars: 'C | C | G7 | G7 | G7 | G7 | C | C | C | C | G7 | G7 | G7 | G7 | C | C',
      },
    ],
  },
  {
    id: 'michael-row',
    titleHe: 'מיכאל חתור לחוף',
    titleEn: 'Michael, Row the Boat Ashore',
    artistHe: TRADITIONAL_HE,
    artistEn: TRADITIONAL_EN,
    language: 'en',
    songKey: 'C',
    bpm: 96,
    difficulty: 2,
    defaultPatternId: 'island',
    source: 'Traditional spiritual',
    publicDomain: true,
    sections: [
      {
        kind: 'verse',
        bars: 'C | F | C | Am | C | F | C G7 | C',
        cues: ['Michael', 'row the', 'boat a-', 'shore', 'Halle-', 'lu', 'jah', ''],
      },
    ],
  },
  {
    id: 'swing-low',
    titleHe: 'מרכבה מתוקה',
    titleEn: 'Swing Low, Sweet Chariot',
    artistHe: TRADITIONAL_HE,
    artistEn: TRADITIONAL_EN,
    language: 'en',
    songKey: 'C',
    bpm: 72,
    difficulty: 2,
    defaultPatternId: 'ballad',
    source: 'Traditional spiritual',
    publicDomain: true,
    sections: [
      {
        kind: 'chorus',
        bars: 'C | F | C | C | C | Am | C G7 | C',
        cues: ['Swing', 'low', 'chariot', '', 'Coming', 'carry', 'me', 'home'],
      },
    ],
  },
  {
    id: 'kumbaya',
    titleHe: 'קום ביה',
    titleEn: 'Kum Ba Yah',
    artistHe: TRADITIONAL_HE,
    artistEn: TRADITIONAL_EN,
    language: 'en',
    songKey: 'C',
    bpm: 76,
    difficulty: 2,
    defaultPatternId: 'ballad',
    source: 'Traditional spiritual',
    publicDomain: true,
    sections: [
      {
        kind: 'verse',
        bars: 'C | F | C | C | C | F | C G7 | C',
        cues: ['Kum ba', 'yah', 'Lord', '', 'Kum ba', 'yah', 'Oh', 'Lord'],
      },
    ],
  },
  {
    id: 'oh-susanna',
    titleHe: 'הו סוזנה',
    titleEn: 'Oh! Susanna',
    artistHe: 'סטיבן פוסטר',
    artistEn: 'Stephen Foster',
    language: 'en',
    songKey: 'C',
    bpm: 120,
    difficulty: 2,
    defaultPatternId: 'boom-chnk',
    source: 'Public domain (1848)',
    publicDomain: true,
    sections: [
      {
        kind: 'verse',
        bars: 'C | C | G7 | G7 | C | C | G7 | C',
      },
      {
        kind: 'chorus',
        bars: 'F | F | C | C | C | G7 | G7 | C',
      },
    ],
  },
  {
    id: 'jingle-bells',
    titleHe: 'פעמוני חג',
    titleEn: 'Jingle Bells',
    artistHe: "ג'יימס פירפונט",
    artistEn: 'James Pierpont',
    language: 'en',
    songKey: 'C',
    bpm: 132,
    difficulty: 2,
    defaultPatternId: 'down-up',
    source: 'Public domain (1857)',
    publicDomain: true,
    sections: [
      {
        kind: 'chorus',
        bars: 'C | C | C | C | F | F | C | C | G7 | G7 | C | C | C | F | C G7 | C',
      },
    ],
  },
  {
    id: 'la-cucaracha',
    titleHe: 'לה קוקרצ׳ה',
    titleEn: 'La Cucaracha',
    artistHe: TRADITIONAL_HE,
    artistEn: TRADITIONAL_EN,
    language: 'en',
    songKey: 'C',
    bpm: 126,
    difficulty: 2,
    defaultPatternId: 'boom-chnk',
    source: 'Traditional Mexican folk song',
    publicDomain: true,
    sections: [
      {
        kind: 'verse',
        bars: 'C | C | G7 | G7 | G7 | G7 | C | C',
      },
    ],
  },
  {
    id: 'down-in-the-valley',
    titleHe: 'למטה בעמק',
    titleEn: 'Down in the Valley',
    artistHe: TRADITIONAL_HE,
    artistEn: TRADITIONAL_EN,
    language: 'en',
    songKey: 'C',
    bpm: 88,
    beatsPerBar: 3,
    difficulty: 2,
    defaultPatternId: 'waltz',
    source: 'Traditional Appalachian folk song',
    publicDomain: true,
    sections: [
      {
        kind: 'verse',
        bars: 'C | C | C | C | G7 | G7 | G7 | G7 | G7 | G7 | G7 | G7 | C | C | C | C',
      },
    ],
  },

  // -------------------------------------------------------- Hebrew festival --
  {
    id: 'hava-nagila',
    titleHe: 'הבה נגילה',
    titleEn: 'Hava Nagila',
    artistHe: TRADITIONAL_HE,
    artistEn: TRADITIONAL_EN,
    language: 'he',
    songKey: 'Dm',
    bpm: 120,
    difficulty: 3,
    defaultPatternId: 'down-up',
    source: 'Traditional, standard Dm arrangement',
    publicDomain: true,
    sections: [
      {
        kind: 'verse',
        bars: 'Dm | Dm | Gm | Gm | Dm | Dm | A7 | A7',
        cues: ['הבה', 'נגילה', 'הבה', 'נגילה', 'הבה', 'נגילה', 'ונשמחה', ''],
      },
      {
        kind: 'chorus',
        bars: 'Dm | Dm | Gm | Gm | A7 | A7 | Dm | Dm',
        cues: ['עורו', 'אחים', 'עורו', 'אחים', 'בלב', 'שמח', 'עורו', 'אחים'],
      },
    ],
  },
  {
    id: 'hevenu-shalom',
    titleHe: 'הבאנו שלום עליכם',
    titleEn: 'Hevenu Shalom Aleichem',
    artistHe: TRADITIONAL_HE,
    artistEn: TRADITIONAL_EN,
    language: 'he',
    songKey: 'Dm',
    bpm: 128,
    difficulty: 3,
    defaultPatternId: 'down-up',
    source: 'Traditional',
    publicDomain: true,
    sections: [
      {
        kind: 'verse',
        bars: 'Dm | Dm | A7 | A7 | A7 | A7 | Dm | Dm',
        cues: ['הבאנו', 'שלום', 'עליכם', '', 'הבאנו', 'שלום', 'עליכם', ''],
      },
      {
        kind: 'chorus',
        bars: 'Dm | Gm | Dm | A7 | Dm | Gm | A7 | Dm',
      },
    ],
  },
  {
    id: 'hine-ma-tov',
    titleHe: 'הנה מה טוב',
    titleEn: 'Hine Ma Tov',
    artistHe: TRADITIONAL_HE,
    artistEn: TRADITIONAL_EN,
    language: 'he',
    songKey: 'Am',
    bpm: 108,
    difficulty: 2,
    defaultPatternId: 'island',
    source: 'Traditional, Psalm 133 setting',
    publicDomain: true,
    sections: [
      {
        kind: 'verse',
        bars: 'Am | Am | Dm | Dm | E7 | E7 | Am | Am',
        cues: ['הנה', 'מה טוב', 'ומה', 'נעים', 'שבת', 'אחים', 'גם', 'יחד'],
      },
    ],
  },
  {
    id: 'siman-tov',
    titleHe: 'סימן טוב ומזל טוב',
    titleEn: 'Siman Tov u Mazal Tov',
    artistHe: TRADITIONAL_HE,
    artistEn: TRADITIONAL_EN,
    language: 'he',
    songKey: 'Am',
    bpm: 132,
    difficulty: 2,
    defaultPatternId: 'down-up',
    source: 'Traditional celebration song',
    publicDomain: true,
    sections: [
      {
        kind: 'chorus',
        bars: 'Am | Am | E7 | E7 | E7 | E7 | Am | Am',
        cues: ['סימן', 'טוב', 'ומזל', 'טוב', 'יהא', 'לנו', 'ולכל', 'ישראל'],
      },
    ],
  },
  {
    id: 'sevivon',
    titleHe: 'סביבון סוב סוב סוב',
    titleEn: 'Sevivon Sov Sov Sov',
    artistHe: TRADITIONAL_HE,
    artistEn: TRADITIONAL_EN,
    language: 'he',
    songKey: 'C',
    bpm: 116,
    difficulty: 2,
    defaultPatternId: 'down-up',
    source: 'Traditional Hanukkah song',
    publicDomain: true,
    sections: [
      {
        kind: 'verse',
        bars: 'C | C | G7 | G7 | G7 | G7 | C | C | F | F | C | C | G7 | G7 | C | C',
        cues: [
          'סביבון', 'סוב', 'חנוכה', 'הוא', 'חג', 'טוב', 'חנוכה', 'הוא',
          'חג', 'טוב', 'סביבון', 'סוב', 'סוב', 'סוב', 'סוב', '',
        ],
      },
    ],
  },
  {
    id: 'mi-yemalel',
    titleHe: 'מי ימלל',
    titleEn: 'Mi Yemalel',
    artistHe: TRADITIONAL_HE,
    artistEn: TRADITIONAL_EN,
    language: 'he',
    songKey: 'Am',
    bpm: 112,
    difficulty: 2,
    defaultPatternId: 'down-up',
    source: 'Traditional Hanukkah song',
    publicDomain: true,
    sections: [
      {
        kind: 'verse',
        bars: 'Am | Am | Dm | Am | Am | E7 | Am | Am',
        cues: ['מי', 'ימלל', 'גבורות', 'ישראל', 'אותן', 'מי', 'ימנה', ''],
      },
    ],
  },
  {
    id: 'banu-choshech',
    titleHe: 'באנו חושך לגרש',
    titleEn: 'Banu Choshech Legaresh',
    artistHe: TRADITIONAL_HE,
    artistEn: TRADITIONAL_EN,
    language: 'he',
    songKey: 'Am',
    bpm: 124,
    difficulty: 2,
    defaultPatternId: 'down-up',
    source: 'Traditional Hanukkah song',
    publicDomain: true,
    sections: [
      {
        kind: 'verse',
        bars: 'Am | Am | E7 | Am | Am | E7 | Am | Am',
        cues: ['באנו', 'חושך', 'לגרש', '', 'בידינו', 'אור', 'ואש', ''],
      },
    ],
  },
  {
    id: 'zum-gali-gali',
    titleHe: 'זום גלי גלי',
    titleEn: 'Zum Gali Gali',
    artistHe: TRADITIONAL_HE,
    artistEn: TRADITIONAL_EN,
    language: 'he',
    songKey: 'Am',
    bpm: 116,
    difficulty: 1,
    defaultPatternId: 'down-up',
    source: 'Traditional pioneer song, two-chord arrangement',
    publicDomain: true,
    sections: [
      {
        kind: 'verse',
        bars: 'Am | Am | Am | Am | E7 | E7 | Am | Am',
        cues: ['זום', 'גלי', 'גלי', '', 'זום', 'גלי', 'גלי', ''],
      },
    ],
  },
  {
    id: 'eretz-zavat-chalav',
    titleHe: 'ארץ זבת חלב',
    titleEn: 'Eretz Zavat Chalav',
    artistHe: TRADITIONAL_HE,
    artistEn: TRADITIONAL_EN,
    language: 'he',
    songKey: 'Am',
    bpm: 120,
    difficulty: 2,
    defaultPatternId: 'island',
    source: 'Traditional',
    publicDomain: true,
    sections: [
      {
        kind: 'verse',
        bars: 'Am | Am | Dm | Am | Dm | Am | E7 | Am',
        cues: ['ארץ', 'זבת', 'חלב', 'ודבש', 'ארץ', 'זבת', 'חלב', 'ודבש'],
      },
    ],
  },

  // ------------------------------------------------ minor-key traditionals --
  {
    id: 'house-of-the-rising-sun',
    titleHe: 'בית השמש העולה',
    titleEn: 'The House of the Rising Sun',
    artistHe: TRADITIONAL_HE,
    artistEn: TRADITIONAL_EN,
    language: 'en',
    songKey: 'Am',
    bpm: 72,
    beatsPerBar: 6,
    beatUnit: 8,
    difficulty: 3,
    defaultPatternId: 'six-eight',
    source: 'Traditional folk ballad',
    publicDomain: true,
    sections: [
      {
        kind: 'verse',
        bars: 'Am | C | D | F | Am | C | E7 | E7 | Am | C | D | F | Am | E7 | Am | Am',
      },
    ],
  },
  {
    id: 'scarborough-fair',
    titleHe: 'יריד סקארבורו',
    titleEn: 'Scarborough Fair',
    artistHe: TRADITIONAL_HE,
    artistEn: TRADITIONAL_EN,
    language: 'en',
    songKey: 'Am',
    bpm: 84,
    beatsPerBar: 3,
    difficulty: 3,
    defaultPatternId: 'waltz',
    source: 'Traditional English ballad',
    publicDomain: true,
    sections: [
      {
        kind: 'verse',
        bars: 'Am | G | Am | Am | Am | C | D | Am | Am | G | Am | Am',
      },
    ],
  },
  {
    id: 'greensleeves',
    titleHe: 'שרוולים ירוקים',
    titleEn: 'Greensleeves',
    artistHe: TRADITIONAL_HE,
    artistEn: TRADITIONAL_EN,
    language: 'en',
    songKey: 'Am',
    bpm: 92,
    beatsPerBar: 3,
    difficulty: 3,
    defaultPatternId: 'waltz',
    source: 'Traditional English ballad, simple Am arrangement',
    publicDomain: true,
    sections: [
      {
        kind: 'verse',
        bars: 'Am | Am | G | G | Am | Am | E7 | E7 | Am | Am | G | G | Am:2 E7:1 | Am',
      },
    ],
  },
  {
    id: 'amazing-grace',
    titleHe: 'חסד מופלא',
    titleEn: 'Amazing Grace',
    artistHe: TRADITIONAL_HE,
    artistEn: TRADITIONAL_EN,
    language: 'en',
    songKey: 'C',
    bpm: 76,
    beatsPerBar: 3,
    difficulty: 2,
    defaultPatternId: 'waltz',
    source: 'Public domain hymn (1779)',
    publicDomain: true,
    sections: [
      {
        kind: 'verse',
        bars: 'C | C | F | C | C | Am | G7 | G7 | C | C | F | C | C:2 G7:1 | C',
        cues: [
          'A-', 'mazing', 'grace', 'sound', 'saved', 'wretch', 'like', 'me',
          'I', 'once', 'was', 'lost', 'now am', 'found',
        ],
      },
    ],
  },
  {
    id: 'auld-lang-syne',
    titleHe: 'ימים עברו',
    titleEn: 'Auld Lang Syne',
    artistHe: TRADITIONAL_HE,
    artistEn: TRADITIONAL_EN,
    language: 'en',
    songKey: 'C',
    bpm: 88,
    difficulty: 2,
    defaultPatternId: 'ballad',
    source: 'Traditional Scots song',
    publicDomain: true,
    sections: [
      {
        kind: 'verse',
        bars: 'C | C | F | C | C | F | C G7 | C',
      },
    ],
  },
  {
    id: 'silent-night',
    titleHe: 'ליל דממה',
    titleEn: 'Silent Night',
    artistHe: 'פרנץ גרובר',
    artistEn: 'Franz Gruber',
    language: 'en',
    songKey: 'C',
    bpm: 68,
    beatsPerBar: 3,
    difficulty: 2,
    defaultPatternId: 'waltz',
    source: 'Public domain carol (1818)',
    publicDomain: true,
    sections: [
      {
        kind: 'verse',
        bars: 'C | C | G7 | C | C | G7 | C | C | F | C | F | C | C | G7 | C | C',
      },
    ],
  },
  {
    id: 'ode-to-joy',
    titleHe: 'אודה לשמחה',
    titleEn: 'Ode to Joy',
    artistHe: 'בטהובן',
    artistEn: 'Beethoven',
    language: 'en',
    songKey: 'C',
    bpm: 108,
    difficulty: 1,
    defaultPatternId: 'all-downs',
    source: 'Public domain, simple two-chord arrangement',
    publicDomain: true,
    sections: [
      {
        kind: 'verse',
        bars: 'C | C | C | G7 | G7 | G7 | G7 | C | C | C | C | G7 | G7 | G7 | G7 | C',
      },
    ],
  },
  {
    id: 'molly-malone',
    titleHe: 'מולי מאלון',
    titleEn: 'Molly Malone',
    artistHe: TRADITIONAL_HE,
    artistEn: TRADITIONAL_EN,
    language: 'en',
    songKey: 'C',
    bpm: 96,
    beatsPerBar: 3,
    difficulty: 3,
    defaultPatternId: 'waltz',
    source: 'Traditional Irish ballad',
    publicDomain: true,
    sections: [
      {
        kind: 'verse',
        bars: 'C | Am | Dm | G7 | C | Am | Dm:2 G7:1 | C',
      },
      {
        kind: 'chorus',
        bars: 'C | Am | Dm | G7 | C | Am | Dm:2 G7:1 | C',
      },
    ],
  },
  {
    id: 'red-river-valley',
    titleHe: 'עמק הנהר האדום',
    titleEn: 'Red River Valley',
    artistHe: TRADITIONAL_HE,
    artistEn: TRADITIONAL_EN,
    language: 'en',
    songKey: 'C',
    bpm: 92,
    difficulty: 2,
    defaultPatternId: 'boom-chnk',
    source: 'Traditional folk song',
    publicDomain: true,
    sections: [
      {
        kind: 'verse',
        bars: 'C | C | G7 | G7 | G7 | G7 | C | C | C | C7 | F | F | C | G7 | C | C',
      },
    ],
  },
  {
    id: 'guantanamera',
    titleHe: 'גואנטנמרה',
    titleEn: 'Guantanamera',
    artistHe: TRADITIONAL_HE,
    artistEn: TRADITIONAL_EN,
    language: 'en',
    songKey: 'C',
    bpm: 108,
    difficulty: 2,
    defaultPatternId: 'island',
    source: 'Traditional Cuban melody; verses from José Martí (public domain)',
    publicDomain: true,
    sections: [
      {
        kind: 'verse',
        bars: 'C | F | G7 | G7 | C | F | G7 | G7',
      },
      {
        kind: 'chorus',
        bars: 'C | F | G7 | G7 | C | F | G7 | C',
      },
    ],
  },
];
