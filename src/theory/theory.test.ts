import { describe, expect, it } from 'vitest';
import {
  buildChord,
  buildPadChord,
  chordAt,
  chordColour,
  chordQuality,
  chordSymbol,
  NO_MODIFIERS,
  octaveOffset,
  type ChordColour,
  type ChordModifiers,
} from './chords';
import { accidentalForKey, makeScale, MODE_NAMES } from './scales';
import {
  chordTones,
  invertVoicing,
  PAD_WINDOW,
  spreadVoicing,
  transposeVoicing,
  voice,
} from './voicing';

type Mode = Parameters<typeof makeScale>[1];

const diatonicSymbols = (root: number, mode: Mode, extension: 3 | 4 = 3) =>
  Array.from({ length: 8 }, (_, d) =>
    chordSymbol(buildChord(makeScale(root, mode), d, extension), accidentalForKey(root, mode)),
  );

/** Held modifier keys, by name. */
const held = (...keys: Array<keyof ChordModifiers>): ChordColour =>
  chordColour({ ...NO_MODIFIERS, ...Object.fromEntries(keys.map((k) => [k, true])) });

const PLAIN = chordColour(NO_MODIFIERS);

const symbols = (root: number, mode: Mode, colour: ChordColour = PLAIN) =>
  Array.from({ length: 8 }, (_, d) => chordAt(makeScale(root, mode), d, colour).symbol);

const numerals = (root: number, mode: Mode, colour: ChordColour = PLAIN) =>
  Array.from({ length: 8 }, (_, d) => chordAt(makeScale(root, mode), d, colour).numeral);

/** Every combination of the five chord-shaping modifier keys. */
const ALL_COLOURS: ChordColour[] = Array.from({ length: 32 }, (_, bits) =>
  chordColour({
    ...NO_MODIFIERS,
    seventh: Boolean(bits & 1),
    dominant: Boolean(bits & 2),
    suspended: Boolean(bits & 4),
    minor: Boolean(bits & 8),
    ninth: Boolean(bits & 16),
  }),
);

describe('the pads are plain triads — the mode only picks the roots', () => {
  it('C ionian is major all the way across', () => {
    expect(symbols(0, 'ionian')).toEqual(['C', 'D', 'E', 'F', 'G', 'A', 'B', 'C']);
    expect(numerals(0, 'ionian')).toEqual(['I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'I′']);
  });

  it('J flattens every third without moving the roots', () => {
    expect(symbols(0, 'ionian', held('minor'))).toEqual([
      'Cm', 'Dm', 'Em', 'Fm', 'Gm', 'Am', 'Bm', 'Cm',
    ]);
    expect(numerals(0, 'ionian', held('minor'))).toEqual([
      'i', 'ii', 'iii', 'iv', 'v', 'vi', 'vii', 'i′',
    ]);
  });

  it('the mode still chooses which roots you get', () => {
    expect(symbols(2, 'dorian')).toEqual(['D', 'E', 'F', 'G', 'A', 'B', 'C', 'D']);
    expect(symbols(9, 'aeolian')).toEqual(['A', 'B', 'C', 'D', 'E', 'F', 'G', 'A']);
    expect(symbols(9, 'harmonicMinor')).toEqual(['A', 'B', 'C', 'D', 'E', 'F', 'G♯', 'A']);
  });

  it('E♭ mixolydian spells with flats', () => {
    expect(symbols(3, 'mixolydian')[0]).toBe('E♭');
    expect(symbols(3, 'mixolydian')[3]).toBe('A♭');
  });

  it('never produces a diminished or augmented pad, under any modifier', () => {
    for (const mode of MODE_NAMES) {
      for (let root = 0; root < 12; root++) {
        for (const colour of ALL_COLOURS) {
          for (const symbol of symbols(root, mode, colour)) {
            expect(symbol).not.toMatch(/[°+]/);
          }
        }
      }
    }
  });
});

describe('modifier keys', () => {
  it('I adds the seventh the scale supplies', () => {
    expect(symbols(0, 'ionian', held('seventh'))).toEqual([
      'Cmaj7', 'D7', 'E7', 'Fmaj7', 'G7', 'A7', 'B7', 'Cmaj7',
    ]);
  });

  it('O adds a flat seventh regardless of the scale', () => {
    expect(symbols(0, 'ionian', held('dominant'))).toEqual([
      'C7', 'D7', 'E7', 'F7', 'G7', 'A7', 'B7', 'C7',
    ]);
  });

  it('P replaces the third with a fourth', () => {
    expect(symbols(0, 'ionian', held('suspended'))[0]).toBe('Csus4');
    expect(buildPadChord(makeScale(0, 'ionian'), 0, held('suspended'))).toEqual([60, 65, 67]);
  });

  it('P and O together give 7sus4', () => {
    expect(symbols(0, 'ionian', held('suspended', 'dominant'))[4]).toBe('G7sus4');
  });

  it('I combines with J', () => {
    expect(symbols(0, 'ionian', held('minor', 'seventh'))[0]).toBe('CmMaj7');
    expect(symbols(0, 'ionian', held('minor', 'seventh'))[1]).toBe('Dm7');
  });

  it('O wins over I, because a flat seventh is the more specific ask', () => {
    expect(symbols(0, 'ionian', held('seventh', 'dominant'))[0]).toBe('C7');
  });

  it('P wins over J, because a suspended chord has no third to flatten', () => {
    expect(symbols(0, 'ionian', held('minor', 'suspended'))[0]).toBe('Csus4');
  });

  it('names every chord it can produce, in every key, mode and combination', () => {
    for (const mode of MODE_NAMES) {
      for (let root = 0; root < 12; root++) {
        for (const colour of ALL_COLOURS) {
          for (const symbol of symbols(root, mode, colour)) {
            expect(symbol).not.toContain('?');
          }
        }
      }
    }
  });
});

describe('[ adds the ninth', () => {
  const scale = makeScale(0, 'ionian');

  it('adds a major ninth on top, whatever the mode', () => {
    expect(buildPadChord(scale, 0, held('ninth'))).toEqual([60, 64, 67, 74]);
    // Phrygian's second degree is flat, but the ninth is not — it is a colour
    // you asked for, not one the mode hands you.
    expect(buildPadChord(makeScale(4, 'phrygian'), 0, held('ninth'))).toEqual([64, 68, 71, 78]);
  });

  it('renames the chord underneath rather than stacking a suffix', () => {
    expect(symbols(0, 'ionian', held('ninth'))[0]).toBe('Cadd9');
    expect(symbols(0, 'ionian', held('ninth', 'minor'))[0]).toBe('Cmadd9');
    expect(symbols(0, 'ionian', held('ninth', 'seventh'))[0]).toBe('Cmaj9');
    expect(symbols(0, 'ionian', held('ninth', 'dominant'))[0]).toBe('C9');
    expect(symbols(0, 'ionian', held('ninth', 'minor', 'dominant'))[0]).toBe('Cm9');
    expect(symbols(0, 'ionian', held('ninth', 'suspended', 'dominant'))[0]).toBe('C9sus4');
  });

  it('numbers the numeral the same way', () => {
    expect(numerals(0, 'ionian', held('ninth'))[0]).toBe('Iadd9');
    expect(numerals(0, 'ionian', held('ninth', 'seventh'))[4]).toBe('V9');
    expect(numerals(0, 'ionian', held('ninth', 'minor', 'dominant'))[0]).toBe('i9');
  });

  it('sits above the seventh, so the stack stays in order', () => {
    const notes = buildPadChord(scale, 4, held('ninth', 'seventh'));
    expect(notes).toEqual([...notes].sort((a, b) => a - b));
  });
});

describe('the diatonic derivation still underpins it', () => {
  it('C ionian triads', () => {
    expect(diatonicSymbols(0, 'ionian')).toEqual([
      'C', 'Dm', 'Em', 'F', 'G', 'Am', 'B°', 'C',
    ]);
  });

  it('A harmonic minor gives III+ and vii°7 with no special cases', () => {
    expect(diatonicSymbols(9, 'harmonicMinor')[2]).toBe('C+');
    expect(diatonicSymbols(9, 'harmonicMinor', 4)[6]).toBe('G♯°7');
    expect(diatonicSymbols(9, 'harmonicMinor', 4)[0]).toBe('AmMaj7');
  });

  it('C melodic minor gives the maj7♯5 on III', () => {
    expect(diatonicSymbols(0, 'melodicMinor', 4)[2]).toBe('E♭maj7♯5');
  });

  it('C ionian sevenths', () => {
    expect(diatonicSymbols(0, 'ionian', 4)).toEqual([
      'Cmaj7', 'Dm7', 'Em7', 'Fmaj7', 'G7', 'Am7', 'Bm7♭5', 'Cmaj7',
    ]);
  });
});

describe('buildPadChord', () => {
  it('keeps the root and fifth fixed and moves only the third', () => {
    const scale = makeScale(0, 'ionian');
    expect(buildPadChord(scale, 1, PLAIN)).toEqual([62, 66, 69]);
    expect(buildPadChord(scale, 1, held('minor'))).toEqual([62, 65, 69]);
  });

  it('takes the diatonic seventh from the scale, not from the forced triad', () => {
    const scale = makeScale(0, 'ionian');
    expect(buildPadChord(scale, 4, held('seventh'))).toEqual([67, 71, 74, 77]); // G B D F
    expect(buildPadChord(scale, 0, held('seventh'))).toEqual([60, 64, 67, 71]); // C E G B
  });

  it('takes the flat seventh straight off the root', () => {
    const scale = makeScale(0, 'ionian');
    expect(buildPadChord(scale, 0, held('dominant'))).toEqual([60, 64, 67, 70]); // C E G B♭
  });
});

describe('buildChord', () => {
  it('wraps past the octave by adding 12 semitones per wrap', () => {
    const scale = makeScale(0, 'ionian'); // C4 = 60
    expect(buildChord(scale, 0, 3)).toEqual([60, 64, 67]);
    expect(buildChord(scale, 6, 3)).toEqual([71, 74, 77]); // B D F, both above the tonic
    expect(buildChord(scale, 7, 3)).toEqual([72, 76, 79]); // the octave I′
  });

  it('reports unknown for a chord it has no name for', () => {
    expect(chordQuality([60, 61, 62])).toBe('unknown');
  });
});

describe('voicing', () => {
  const window = PAD_WINDOW;

  it('keeps chord tones inside the window and puts the bass below it', () => {
    const scale = makeScale(0, 'ionian');
    const [bass, ...tones] = voice(buildChord(scale, 0, 3), null, window);
    expect(bass).toBe(60 - 12 * window.bassOctaves);
    expect(Math.min(...tones)).toBeGreaterThanOrEqual(window.low);
    expect(Math.max(...tones)).toBeLessThanOrEqual(window.high);
  });

  it('moves less than root position when following a previous chord', () => {
    const scale = makeScale(0, 'ionian');
    const c = chordTones(voice(buildChord(scale, 0, 3), null, window));
    const f = chordTones(voice(buildChord(scale, 3, 3), c, window));

    const rootPosition = [65, 69, 72];
    const distance = (notes: number[]) =>
      notes.reduce((sum, n) => sum + Math.min(...c.map((p) => Math.abs(n - p))), 0);

    expect(distance(f)).toBeLessThan(distance(rootPosition));
    expect(f.sort((a, b) => a - b)).not.toEqual(rootPosition);
  });

  it('is deterministic', () => {
    const scale = makeScale(7, 'mixolydian');
    const chord = buildChord(scale, 4, 4);
    expect(voice(chord, [60, 64, 67], window)).toEqual(voice(chord, [60, 64, 67], window));
  });

  it('does not let the bass note drag the next voicing downward', () => {
    const scale = makeScale(0, 'ionian');
    const previous = voice(buildChord(scale, 0, 3), null, window);
    const [, ...tones] = voice(buildChord(scale, 4, 3), chordTones(previous), window);
    expect(Math.min(...tones)).toBeGreaterThanOrEqual(window.low);
  });
});

describe('inversion', () => {
  const voicing = [36, 60, 64, 67]; // bass C2, then C4 E4 G4

  it('lifts the lowest chord tone an octave and leaves the bass alone', () => {
    expect(invertVoicing(voicing, 1)).toEqual([36, 64, 67, 72]);
  });

  it('stacks', () => {
    expect(invertVoicing(voicing, 2)).toEqual([36, 67, 72, 76]);
  });

  it('keeps the same pitch classes — it reorders, it does not re-harmonise', () => {
    const before = new Set(chordTones(voicing).map((n) => n % 12));
    const after = new Set(chordTones(invertVoicing(voicing, 1)).map((n) => n % 12));
    expect([...after].sort()).toEqual([...before].sort());
  });

  it('is a no-op at zero', () => {
    expect(invertVoicing(voicing, 0)).toEqual(voicing);
  });

  it('does not change what the pads are labelled', () => {
    expect(symbols(0, 'ionian', held('inverted'))).toEqual(symbols(0, 'ionian'));
  });
});

describe('walking the bass', () => {
  const scale = makeScale(0, 'ionian');
  const chord = buildPadChord(scale, 0, PLAIN); // C E G

  it('puts the chosen chord tone in the bass', () => {
    expect(voice(chord, null, PAD_WINDOW, 0)[0]).toBe(60 - 12 * PAD_WINDOW.bassOctaves);
    expect(voice(chord, null, PAD_WINDOW, 1)[0]).toBe(64 - 12 * PAD_WINDOW.bassOctaves);
    expect(voice(chord, null, PAD_WINDOW, 2)[0]).toBe(67 - 12 * PAD_WINDOW.bassOctaves);
  });

  it('leaves the chord tones alone — only the bass moves', () => {
    const root = chordTones(voice(chord, null, PAD_WINDOW, 0));
    expect(chordTones(voice(chord, null, PAD_WINDOW, 1))).toEqual(root);
    expect(chordTones(voice(chord, null, PAD_WINDOW, 2))).toEqual(root);
  });

  it('follows the chord colour — a minor third, a suspended fourth', () => {
    const minor = buildPadChord(scale, 0, held('minor'));
    const sus = buildPadChord(scale, 0, held('suspended'));
    expect(voice(minor, null, PAD_WINDOW, 1)[0]).toBe(63 - 12 * PAD_WINDOW.bassOctaves);
    expect(voice(sus, null, PAD_WINDOW, 1)[0]).toBe(65 - 12 * PAD_WINDOW.bassOctaves);
  });

  it('does not change the pad label — the bass keys are their own voice', () => {
    expect(chordAt(scale, 0, PLAIN).symbol).toBe('C');
  });
});

describe('spread voicing', () => {
  const scale = makeScale(0, 'ionian');

  it('doubles the root below and lifts the third into a tenth', () => {
    const [, ...tones] = spreadVoicing(buildPadChord(scale, 0, PLAIN), PAD_WINDOW);
    const root = tones[1];
    // root-12, root, fifth, third+12 — ascending, in that shape.
    expect(tones.map((n) => n - root)).toEqual([-12, 0, 7, 16]);
  });

  it('keeps every pitch class of the chord and adds no new ones', () => {
    const chord = buildPadChord(scale, 4, held('seventh'));
    const [, ...tones] = spreadVoicing(chord, PAD_WINDOW);
    expect(new Set(tones.map((n) => n % 12))).toEqual(new Set(chord.map((n) => n % 12)));
  });

  it('makes room for a seventh between the fifth and the tenth', () => {
    const [, ...tones] = spreadVoicing(buildPadChord(scale, 0, held('seventh')), PAD_WINDOW);
    const root = tones[1];
    expect(tones.map((n) => n - root)).toEqual([-12, 0, 7, 11, 16]);
  });

  it('is the same shape whatever came before — it does not voice-lead', () => {
    const chord = buildPadChord(scale, 3, PLAIN);
    expect(spreadVoicing(chord, PAD_WINDOW)).toEqual(spreadVoicing(chord, PAD_WINDOW));
  });

  it('inverts by rotating the chord, never colliding with its own doubled root', () => {
    const chord = buildPadChord(scale, 0, PLAIN); // C E G
    const inverted = spreadVoicing(chord, PAD_WINDOW, 0, 1);
    const tones = chordTones(inverted);

    // No unison: lifting the bottom of the finished spread would have put the
    // doubled root onto the root already sounding.
    expect(new Set(tones).size).toBe(tones.length);
    // Still the spread shape, now anchored on the third.
    const anchor = tones[1];
    expect(tones.map((n) => n - anchor)).toEqual([-12, 0, 8, 15]);
  });

  it('keeps every pitch class through an inversion', () => {
    const chord = buildPadChord(scale, 0, PLAIN);
    const plain = new Set(chordTones(spreadVoicing(chord, PAD_WINDOW)).map((n) => n % 12));
    const turned = new Set(chordTones(spreadVoicing(chord, PAD_WINDOW, 0, 1)).map((n) => n % 12));
    expect(turned).toEqual(plain);
  });

  it('still answers to the bass keys', () => {
    const chord = buildPadChord(scale, 0, PLAIN);
    const root = spreadVoicing(chord, PAD_WINDOW, 0)[0];
    expect(spreadVoicing(chord, PAD_WINDOW, 1)[0] - root).toBe(4);
    expect(spreadVoicing(chord, PAD_WINDOW, 2)[0] - root).toBe(7);
  });
});

describe('octave shift', () => {
  const scale = makeScale(0, 'ionian');
  const voicing = voice(buildChord(scale, 0, 3), null, PAD_WINDOW);

  it('moves every note of the chord, not just the bass', () => {
    expect(chordTones(transposeVoicing(voicing, -1))).toEqual(
      chordTones(voicing).map((n) => n - 12),
    );
    expect(transposeVoicing(voicing, 1)).toEqual(voicing.map((n) => n + 12));
  });

  it('is unconditional — a wide window cannot override it', () => {
    // The pad window spans four octaves, so voice leading would happily leave the
    // chord where it was if the octave came from the window instead.
    const wide = voice(buildChord(scale, 0, 3), null, PAD_WINDOW);
    expect(chordTones(transposeVoicing(wide, -1))).toEqual(
      chordTones(wide).map((n) => n - 12),
    );
  });

  it('leaves a voicing alone at zero', () => {
    expect(transposeVoicing(voicing, 0)).toEqual(voicing);
  });

  it('lifts an inaudible bass by an octave rather than changing its note', () => {
    // 24 - 12 = 12, below A0, so it comes back up a twelve — still a C, not a clamp to A0.
    const [bass] = transposeVoicing([24, 60, 64, 67], -1);
    expect(bass).toBe(24);
    expect(bass % 12).toBe(0);
  });

  it('cancels out when both keys are held', () => {
    expect(octaveOffset({ ...NO_MODIFIERS, octaveDown: true, octaveUp: true })).toBe(0);
    expect(octaveOffset({ ...NO_MODIFIERS, octaveDown: true })).toBe(-1);
    expect(octaveOffset({ ...NO_MODIFIERS, octaveUp: true })).toBe(1);
  });

  it('does not change what the pads are labelled', () => {
    expect(symbols(0, 'ionian', held('octaveDown'))).toEqual(symbols(0, 'ionian'));
  });
});
