import { accidentalForMajor, mod12, type Accidental, MIDDLE_C, type Midi, type PitchClass } from './notes';

export const SCALES = {
  ionian: [0, 2, 4, 5, 7, 9, 11],
  dorian: [0, 2, 3, 5, 7, 9, 10],
  phrygian: [0, 1, 3, 5, 7, 8, 10],
  lydian: [0, 2, 4, 6, 7, 9, 11],
  mixolydian: [0, 2, 4, 5, 7, 9, 10],
  aeolian: [0, 2, 3, 5, 7, 8, 10],
  locrian: [0, 1, 3, 5, 6, 8, 10],
  harmonicMinor: [0, 2, 3, 5, 7, 8, 11],
  melodicMinor: [0, 2, 3, 5, 7, 9, 11],
} as const;

export type ModeName = keyof typeof SCALES;

export const MODE_NAMES = Object.keys(SCALES) as ModeName[];

/** Human-facing labels. */
export const MODE_LABELS: Record<ModeName, string> = {
  ionian: 'Ionian',
  dorian: 'Dorian',
  phrygian: 'Phrygian',
  lydian: 'Lydian',
  mixolydian: 'Mixolydian',
  aeolian: 'Aeolian',
  locrian: 'Locrian',
  harmonicMinor: 'Harmonic minor',
  melodicMinor: 'Melodic minor',
};

export interface Scale {
  /** MIDI note of the tonic — carries an octave, not just a pitch class. */
  root: Midi;
  intervals: readonly number[];
  mode: ModeName;
}

export const DEGREES_PER_OCTAVE = 7;

/**
 * Semitones from each mode's tonic back to the tonic of the major scale that
 * shares its notes. Harmonic and melodic minor borrow aeolian's signature —
 * their raised degrees are accidentals, not part of the key signature.
 */
const PARENT_MAJOR_OFFSET: Record<ModeName, number> = {
  ionian: 0,
  dorian: 2,
  phrygian: 4,
  lydian: 5,
  mixolydian: 7,
  aeolian: 9,
  locrian: 11,
  harmonicMinor: 9,
  melodicMinor: 9,
};

/**
 * Whether a key is written with sharps or flats. C melodic minor sits in three
 * flats, so its III is E♭maj7♯5 — not D♯maj7♯5.
 */
export function accidentalForKey(root: PitchClass, mode: ModeName): Accidental {
  return accidentalForMajor(mod12(root - PARENT_MAJOR_OFFSET[mode]));
}

/**
 * Build a scale rooted on `pitchClass`, placed in the octave containing `nearMidi`.
 * Keeps every key's chords in roughly the same register so the voicer has less work.
 */
export function makeScale(pitchClass: PitchClass, mode: ModeName, nearMidi: Midi = MIDDLE_C): Scale {
  const base = Math.floor(nearMidi / 12) * 12;
  return { root: base + pitchClass, intervals: SCALES[mode], mode };
}
