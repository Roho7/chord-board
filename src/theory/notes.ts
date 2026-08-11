/**
 * Pitch primitives. Pure — no imports, no side effects.
 */

/** 0 = C, 1 = C#/Db, ... 11 = B. */
export type PitchClass = number;

/** A MIDI note number. 60 = C4. */
export type Midi = number;

export const MIDDLE_C: Midi = 60;

const SHARP_NAMES = ['C', 'C♯', 'D', 'D♯', 'E', 'F', 'F♯', 'G', 'G♯', 'A', 'A♯', 'B'] as const;
const FLAT_NAMES = ['C', 'D♭', 'D', 'E♭', 'E', 'F', 'G♭', 'G', 'A♭', 'A', 'B♭', 'B'] as const;

export type Accidental = 'sharp' | 'flat';

/**
 * Position on the circle of fifths for each major key, negative meaning flats.
 * C = 0, G = 1, F = -1, and so on.
 */
const FIFTHS: Record<PitchClass, number> = {
  0: 0, 7: 1, 2: 2, 9: 3, 4: 4, 11: 5, 6: 6,
  5: -1, 10: -2, 3: -3, 8: -4, 1: -5,
};

/** Which accidental the major key on `root` is written with. */
export function accidentalForMajor(root: PitchClass): Accidental {
  return FIFTHS[mod12(root)] < 0 ? 'flat' : 'sharp';
}

export function mod12(n: number): PitchClass {
  return ((n % 12) + 12) % 12;
}

export function pitchClass(midi: Midi): PitchClass {
  return mod12(midi);
}

export function noteName(pitch: Midi | PitchClass, accidental: Accidental = 'sharp'): string {
  const names = accidental === 'flat' ? FLAT_NAMES : SHARP_NAMES;
  return names[mod12(pitch)];
}

/** MIDI number → scientific pitch notation, e.g. 60 → "C4". Handy for Tone.js. */
export function midiToNoteName(midi: Midi, accidental: Accidental = 'sharp'): string {
  const octave = Math.floor(midi / 12) - 1;
  return `${noteName(midi, accidental)}${octave}`.replace('♯', '#').replace('♭', 'b');
}

export const PITCH_CLASSES: readonly PitchClass[] = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11];
