import type { ChordModifiers, ExtraVoice } from '@/theory/chords';

/**
 * Physical key → scale degree.
 *
 * Keyed on `event.code`, never `event.key`: holding Shift turns `event.key`
 * from 'a' into 'A' and would break every pad, and `code` is layout-independent
 * so AZERTY and QWERTZ work without a second map.
 *
 * The degrees snake: `A S D F` runs left to right along the home row, then
 * `R E W Q` runs back right to left along the row above. So degree 3 (F) and
 * degree 4 (R) are physically adjacent, and the scale never jumps across the
 * keyboard mid-climb.
 *
 * This is the only place in the app that knows about key codes — relabelling
 * the board is an edit to this object and nothing else.
 */
export const KEYMAP: Record<string, number> = {
  KeyA: 0,
  KeyS: 1,
  KeyD: 2,
  KeyF: 3,
  KeyR: 4,
  KeyE: 5,
  KeyW: 6,
  KeyQ: 7,
};

export const DEGREE_COUNT = 8;

/**
 * The pads as they sit on the keyboard, top row first, each entry a key code in
 * left-to-right order. The board renders straight from this, so what you see
 * matches what your fingers are on — including the snake, which puts the octave
 * (Q) at the far left of the upper row rather than following IV along.
 */
export const KEY_ROWS: readonly (readonly string[])[] = [
  ['KeyQ', 'KeyW', 'KeyE', 'KeyR'],
  ['KeyA', 'KeyS', 'KeyD', 'KeyF'],
];

/**
 * Modifier keys, all under the right hand so the left hand never has to leave
 * the pads. Held, not toggled — they colour whatever is sounding.
 */
export const MODIFIER_KEYS: Record<string, keyof ChordModifiers> = {
  KeyI: 'seventh',
  KeyO: 'dominant',
  KeyP: 'suspended',
  KeyJ: 'minor',
  // J and K together: the two keys that reshape the chord itself.
  KeyK: 'inverted',
  // Momentary octave, stacked in the ring finger's column so the higher key is
  // the higher octave. Held like any other colour — dip a chord and spring back.
  KeyL: 'octaveUp',
  Period: 'octaveDown',
  BracketLeft: 'ninth',
};

/**
 * The support keys, played by the right hand alongside the pads. Each strikes
 * one extra voice of the last chord played — press to sound it, release to stop
 * it. Peers, not modifiers: none depends on another, none reshapes the chord,
 * and letting go of one never sounds anything.
 */
export const EXTRA_KEYS: Record<string, ExtraVoice> = {
  Space: 'chordOctave',
  Semicolon: 'bassRoot',
  Quote: 'bassFifth',
};

export function extraKeyFor(code: string): ExtraVoice | undefined {
  return EXTRA_KEYS[code];
}

/**
 * The number row holds the settings you latch rather than hold: 1 and 3 step the
 * working register down and up, with the spread toggle between them. Deliberately
 * away from the playing keys — you set these between phrases, not during one.
 */
export const SPREAD_KEY = 'Digit2';

export const REGISTER_KEYS: Record<string, number> = {
  Digit1: -1,
  Digit3: 1,
};

/** How far the latched register can travel from centre, in octaves. */
export const REGISTER_LIMIT = 2;

export function registerStepFor(code: string): number | undefined {
  return REGISTER_KEYS[code];
}

/**
 * What each control key does, and exactly where it sits on the keyboard.
 *
 * `x` is the key's left edge in key-widths from the left of the board, taking
 * the real stagger from the physical rows: the number row starts flush, QWERTY
 * is pushed right by Tab's 1.5 widths, the home row by Caps' 1.75. That is why
 * 1 2 3 sit far to the left of I O P — a row offset cannot express this, only
 * a per-key position can.
 *
 * The pad keys are included as unlit ghosts. Without them the right-hand cluster
 * floats with nothing to place it against, and the split between the hand that
 * plays and the hand that colours stops being obvious.
 */
export type LegendControl =
  | { kind: 'modifier'; name: keyof ChordModifiers }
  | { kind: 'extra'; voice: ExtraVoice }
  | { kind: 'register'; direction: -1 | 1 }
  | { kind: 'spread' }
  | { kind: 'sustain' };

export interface LegendKey {
  key: string;
  /** Which physical row: 0 numbers, 1 QWERTY, 2 home, 3 bottom, 4 space bar. */
  row: number;
  /** Left edge, in key widths from the left of the board. */
  x: number;
  width?: number;
  caption?: string;
  /** Absent for the pad keys, which are drawn only to give the layout shape. */
  control?: LegendControl;
}

export const LEGEND_ROWS = 5;
/** The board is this many key-widths across, from ` to ]. */
export const LEGEND_WIDTH = 13;

export const KEY_LEGEND: LegendKey[] = [
  // Number row — latched settings.
  { key: '1', row: 0, x: 1, caption: '8vb', control: { kind: 'register', direction: -1 } },
  { key: '2', row: 0, x: 2, caption: 'Spread', control: { kind: 'spread' } },
  { key: '3', row: 0, x: 3, caption: '8va', control: { kind: 'register', direction: 1 } },

  // QWERTY row — pads on the left, chord colours on the right.
  { key: 'Q', row: 1, x: 1.5 },
  { key: 'W', row: 1, x: 2.5 },
  { key: 'E', row: 1, x: 3.5 },
  { key: 'R', row: 1, x: 4.5 },
  { key: 'I', row: 1, x: 8.5, caption: '7th', control: { kind: 'modifier', name: 'seventh' } },
  { key: 'O', row: 1, x: 9.5, caption: 'Dom 7', control: { kind: 'modifier', name: 'dominant' } },
  { key: 'P', row: 1, x: 10.5, caption: 'Sus 4', control: { kind: 'modifier', name: 'suspended' } },
  { key: '[', row: 1, x: 11.5, caption: 'Add 9', control: { kind: 'modifier', name: 'ninth' } },

  // Home row.
  { key: 'Caps', row: 2, x: 0, width: 1.75, caption: 'Sustain', control: { kind: 'sustain' } },
  { key: 'A', row: 2, x: 1.75 },
  { key: 'S', row: 2, x: 2.75 },
  { key: 'D', row: 2, x: 3.75 },
  { key: 'F', row: 2, x: 4.75 },
  { key: 'J', row: 2, x: 7.75, caption: 'Minor', control: { kind: 'modifier', name: 'minor' } },
  { key: 'K', row: 2, x: 8.75, caption: 'Invert', control: { kind: 'modifier', name: 'inverted' } },
  { key: 'L', row: 2, x: 9.75, caption: '8va', control: { kind: 'modifier', name: 'octaveUp' } },
  { key: ';', row: 2, x: 10.75, caption: 'Bass', control: { kind: 'extra', voice: 'bassRoot' } },
  { key: "'", row: 2, x: 11.75, caption: 'Bass 5', control: { kind: 'extra', voice: 'bassFifth' } },

  // Bottom row.
  { key: '.', row: 3, x: 10.25, caption: '8vb', control: { kind: 'modifier', name: 'octaveDown' } },

  // Space bar.
  {
    key: 'Space',
    row: 4,
    x: 3.75,
    width: 5.25,
    caption: 'Octave',
    control: { kind: 'extra', voice: 'chordOctave' },
  },
];

export function modifierForCode(code: string): keyof ChordModifiers | undefined {
  return MODIFIER_KEYS[code];
}

/** Degree → the letter printed on the pad. */
export const KEY_LABELS: string[] = Object.entries(KEYMAP)
  .sort((a, b) => a[1] - b[1])
  .map(([code]) => code.replace('Key', ''));

export function degreeForCode(code: string): number | undefined {
  return KEYMAP[code];
}
