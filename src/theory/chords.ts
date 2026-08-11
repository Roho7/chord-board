import { mod12, noteName, type Accidental, type Midi, type PitchClass } from './notes';
import { accidentalForKey, DEGREES_PER_OCTAVE, type Scale } from './scales';

export type Extension = 3 | 4;

export type ChordQuality =
  | 'major'
  | 'minor'
  | 'diminished'
  | 'augmented'
  | 'maj7'
  | 'dom7'
  | 'm7'
  | 'm7b5'
  | 'dim7'
  | 'mMaj7'
  | 'maj7s5'
  | 'aug7'
  | 'major6'
  | 'minor6'
  | 'sus4'
  | 'dom7sus4'
  | 'maj7sus4'
  | 'sus4add6'
  | 'unknown';

/**
 * The modifier keys, as held. Kept as independent booleans because that is what
 * the keyboard actually reports; `chordColour` and `octaveOffset` resolve the
 * combinations.
 */
export interface ChordModifiers {
  /** J — flatten the third. */
  minor: boolean;
  /** I — add the seventh the scale supplies. */
  seventh: boolean;
  /** O — add a flat seventh, whatever the scale says. */
  dominant: boolean;
  /** P — replace the third with a fourth. */
  suspended: boolean;
  /** Left Shift — drop the whole chord an octave. */
  octaveDown: boolean;
  /** C — lift the whole chord an octave. */
  octaveUp: boolean;
  /** K — take the chord up one inversion. */
  inverted: boolean;
  /** [ — add the ninth. */
  ninth: boolean;
}

export const NO_MODIFIERS: ChordModifiers = {
  minor: false,
  seventh: false,
  dominant: false,
  suspended: false,
  octaveDown: false,
  octaveUp: false,
  inverted: false,
  ninth: false,
};

export type ThirdColour = 'major' | 'minor' | 'sus4';
export type SeventhColour = 'none' | 'diatonic' | 'flat';

export interface ChordColour {
  third: ThirdColour;
  seventh: SeventhColour;
  /** Whether to add the ninth on top. Independent of the seventh. */
  ninth: boolean;
}

/**
 * Resolve held keys into one chord shape. Two deliberate precedences:
 * P beats J, because a suspended chord has no third to flatten; and O beats I,
 * because asking for a flat seventh is more specific than asking for the
 * scale's own. Holding P and O together is the 7sus4 you actually want.
 */
export function chordColour(modifiers: ChordModifiers): ChordColour {
  return {
    third: modifiers.suspended ? 'sus4' : modifiers.minor ? 'minor' : 'major',
    seventh: modifiers.dominant ? 'flat' : modifiers.seventh ? 'diatonic' : 'none',
    ninth: modifiers.ninth,
  };
}

/**
 * How many octaves to move the whole chord — bass and all tones together, after
 * voicing. Register, not colour, so the pad labels never change. Holding both
 * keys cancels out, which is the only sensible reading of "down and up".
 */
export function octaveOffset(modifiers: ChordModifiers): number {
  return (modifiers.octaveUp ? 1 : 0) - (modifiers.octaveDown ? 1 : 0);
}

/**
 * How many inversions to take the voicing up. Like the octave keys this is
 * voicing, not harmony — the same notes in a different order — so the pad
 * label does not change.
 */
export function inversionSteps(modifiers: ChordModifiers): number {
  return modifiers.inverted ? 1 : 0;
}

/**
 * Which chord tone a bass key sounds: 0 root, 1 third, 2 fifth.
 *
 * Not a modifier — the bass keys strike notes of their own rather than
 * reshaping the chord, so nothing here is read while a chord is voiced.
 */
export type BassTone = 0 | 1 | 2;

/**
 * The extra voice a support key sounds alongside the pads: the whole chord
 * doubled an octave up, or a single low note under it.
 */
export type ExtraVoice = 'chordOctave' | 'bassRoot' | 'bassFifth';

/**
 * Stack thirds on `degree` by walking the scale in steps of two, wrapping mod 7
 * and adding an octave per wrap. No per-mode tables: the scale decides the quality.
 */
export function buildChord(scale: Scale, degree: number, extension: Extension): Midi[] {
  return Array.from({ length: extension }, (_, i) => {
    const idx = degree + i * 2;
    const octaves = Math.floor(idx / DEGREES_PER_OCTAVE);
    return scale.root + scale.intervals[idx % DEGREES_PER_OCTAVE] + octaves * 12;
  });
}

/** Interval signature measured from the chord's own root, e.g. [0,4,7] → "0,4,7". */
function signature(chord: Midi[]): string {
  const root = chord[0];
  return [...new Set(chord.map((n) => mod12(n - root)))].sort((a, b) => a - b).join(',');
}

const QUALITIES: Record<string, ChordQuality> = {
  '0,4,7': 'major',
  '0,3,7': 'minor',
  '0,3,6': 'diminished',
  '0,4,8': 'augmented',
  '0,4,7,11': 'maj7',
  '0,4,7,10': 'dom7',
  '0,3,7,10': 'm7',
  '0,3,6,10': 'm7b5',
  '0,3,6,9': 'dim7',
  '0,3,7,11': 'mMaj7',
  '0,4,8,11': 'maj7s5',
  '0,4,8,10': 'aug7',
  '0,4,7,9': 'major6',
  '0,3,7,9': 'minor6',
  '0,5,7': 'sus4',
  '0,5,7,10': 'dom7sus4',
  '0,5,7,11': 'maj7sus4',
  '0,5,7,9': 'sus4add6',
};

export function chordQuality(chord: Midi[]): ChordQuality {
  return QUALITIES[signature(chord)] ?? 'unknown';
}

/** Suffix appended to the root letter, e.g. "m7♭5" in "Bm7♭5". */
const SYMBOL_SUFFIX: Record<ChordQuality, string> = {
  major: '',
  minor: 'm',
  diminished: '°',
  augmented: '+',
  maj7: 'maj7',
  dom7: '7',
  m7: 'm7',
  m7b5: 'm7♭5',
  dim7: '°7',
  mMaj7: 'mMaj7',
  maj7s5: 'maj7♯5',
  aug7: '7♯5',
  major6: '6',
  minor6: 'm6',
  sus4: 'sus4',
  dom7sus4: '7sus4',
  maj7sus4: 'maj7sus4',
  sus4add6: '6sus4',
  unknown: '?',
};

/** Qualities whose roman numeral is written in upper case. */
const MAJOR_ISH = new Set<ChordQuality>([
  'major',
  'augmented',
  'maj7',
  'dom7',
  'maj7s5',
  'aug7',
  'major6',
  // A suspended chord has no third, so it is neither major nor minor — the
  // numeral stays upper case and the suffix carries the information.
  'sus4',
  'dom7sus4',
  'maj7sus4',
  'sus4add6',
  'unknown',
]);

const NUMERAL_SUFFIX: Record<ChordQuality, string> = {
  major: '',
  minor: '',
  diminished: '°',
  augmented: '+',
  maj7: 'maj7',
  dom7: '7',
  m7: '7',
  m7b5: 'ø7',
  dim7: '°7',
  mMaj7: 'maj7',
  maj7s5: '+maj7',
  aug7: '+7',
  major6: '6',
  minor6: '6',
  sus4: 'sus4',
  dom7sus4: '7sus4',
  maj7sus4: 'maj7sus4',
  sus4add6: '6sus4',
  unknown: '',
};

const NUMERALS = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII'] as const;

export interface ChordInfo {
  degree: number;
  notes: Midi[];
  root: PitchClass;
  quality: ChordQuality;
  /** "Cmaj7" */
  symbol: string;
  /** "Imaj7" */
  numeral: string;
}

const THIRD: Record<ThirdColour, number> = { major: 4, minor: 3, sus4: 5 };

/**
 * The chord actually under the pads. The scale supplies the root of each degree
 * and, when I is held, the seventh — so V of ionian is a dominant 7 and I is a
 * maj7. Everything else is the player's choice: the fifth is always perfect and
 * the third is whatever the modifiers say, so no pad can surprise you with a
 * diminished or augmented chord.
 */
export function buildPadChord(scale: Scale, degree: number, colour: ChordColour): Midi[] {
  const diatonic = buildChord(scale, degree, colour.seventh === 'diatonic' ? 4 : 3);
  const root = diatonic[0];
  const notes = [root, root + THIRD[colour.third], root + 7];

  if (colour.seventh === 'diatonic') notes.push(diatonic[3]);
  else if (colour.seventh === 'flat') notes.push(root + 10);

  // A plain major ninth, not the scale's — a ♭9 is an altered, dissonant colour
  // you ask for deliberately, never something a mode should hand you by surprise.
  if (colour.ninth) notes.push(root + 14);

  return notes;
}

/**
 * How a ninth renames the chord it sits on. Only the qualities a pad can
 * actually produce appear here: the fifth is always perfect, so nothing
 * diminished or augmented can reach this table.
 */
const NINTH_SYMBOL: Partial<Record<ChordQuality, string>> = {
  major: 'add9',
  minor: 'madd9',
  sus4: 'sus4add9',
  maj7: 'maj9',
  dom7: '9',
  m7: 'm9',
  mMaj7: 'mMaj9',
  major6: '6/9',
  minor6: 'm6/9',
  dom7sus4: '9sus4',
  maj7sus4: 'maj9sus4',
  sus4add6: '6/9sus4',
};

const NINTH_NUMERAL: Partial<Record<ChordQuality, string>> = {
  major: 'add9',
  minor: 'add9',
  sus4: 'sus4add9',
  maj7: 'maj9',
  dom7: '9',
  m7: '9',
  mMaj7: 'maj9',
  major6: '6/9',
  minor6: '6/9',
  dom7sus4: '9sus4',
  maj7sus4: 'maj9sus4',
  sus4add6: '6/9sus4',
};

export function chordSymbol(chord: Midi[], accidental: Accidental = 'sharp'): string {
  return noteName(chord[0], accidental) + SYMBOL_SUFFIX[chordQuality(chord)];
}

export function romanNumeral(chord: Midi[], degree: number, suffix?: string): string {
  const quality = chordQuality(chord);
  const base = NUMERALS[degree % DEGREES_PER_OCTAVE];
  const numeral = MAJOR_ISH.has(quality) ? base : base.toLowerCase();
  const octaveMark = degree >= DEGREES_PER_OCTAVE ? '′' : '';
  return numeral + (suffix ?? NUMERAL_SUFFIX[quality]) + octaveMark;
}

/** Everything a pad needs to render and play one degree. */
export function chordAt(scale: Scale, degree: number, colour: ChordColour): ChordInfo {
  const notes = buildPadChord(scale, degree, colour);
  const accidental = accidentalForKey(mod12(scale.root), scale.mode);

  // Name the chord underneath the ninth, then let the ninth rename it — a maj7
  // becomes a maj9, a plain triad becomes an add9. Composing the name this way
  // keeps one entry per quality instead of one per quality-and-ninth pairing.
  const base = colour.ninth ? notes.slice(0, -1) : notes;
  const quality = chordQuality(base);

  return {
    degree,
    notes,
    root: mod12(notes[0]),
    quality,
    symbol: colour.ninth
      ? noteName(base[0], accidental) + (NINTH_SYMBOL[quality] ?? 'add9')
      : chordSymbol(base, accidental),
    numeral: romanNumeral(base, degree, colour.ninth ? NINTH_NUMERAL[quality] ?? 'add9' : undefined),
  };
}
