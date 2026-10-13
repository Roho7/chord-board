import type { Midi } from './notes';

export interface VoicingWindow {
  /** Lowest MIDI note the chord tones may occupy. */
  low: Midi;
  /** Highest MIDI note the chord tones may occupy. */
  high: Midi;
  /** How many octaves below the chord root the bass note sits. */
  bassOctaves: number;
}

/**
 * Tight and close — the synth pad muddies fast in the low register.
 *
 * Two octaves of bass, not three: at three the root landed near C1 (~32 Hz),
 * which reads as weight under a chord but nearly vanishes when the pedal leaves
 * it ringing alone.
 */
export const PAD_WINDOW: VoicingWindow = { low: 35, high: 86, bassOctaves: 2 };

/**
 * A string section is stacked, not clustered: violins up top, a cello two
 * octaves under. Keep the tones above the viola floor — sawtooth ensembles turn
 * to porridge below C3 — and take the full two octaves of bass for the cello.
 */
export const STRINGS_WINDOW: VoicingWindow = { low: 52, high: 81, bassOctaves: 2 };

/** Wider spread, and the sampler has real low end — but the same pedal problem. */
export const PIANO_WINDOW: VoicingWindow = { low: 52, high: 79, bassOctaves: 2 };

/**
 * Guitar chords live in a narrow band — roughly E2 to E5 on the instrument, and
 * the samples only cover D2 to D5. Keep the tones inside that and the bass just
 * one octave down, or the Sampler pitch-shifts far enough to sound rubbery.
 */
export const GUITAR_WINDOW: VoicingWindow = { low: 45, high: 76, bassOctaves: 1 };

const LOWEST_PLAYABLE: Midi = 21; // A0

/**
 * Lift a bass note by whole octaves until it is audible. Clamping to the floor
 * would change the *note*, not just its register — the bass has to stay the
 * chord root, so it can only move by twelves.
 */
function audibleBass(bass: Midi): Midi {
  let note = bass;
  while (note < LOWEST_PLAYABLE) note += 12;
  return note;
}

/**
 * Move a finished voicing bodily up or down whole octaves — bass and every
 * chord tone, all by the same amount.
 *
 * This is applied *after* voicing rather than by moving the window, because the
 * voicer is free to pick any octave that fits its window: widen the window and
 * voice leading wins, so the chord stays put and only the bass appears to move.
 * Transposing the result is unconditional, which is what an octave key should be.
 */
export function transposeVoicing(voicing: Midi[], octaves: number): Midi[] {
  if (octaves === 0) return voicing;
  const [bass, ...tones] = voicing;
  return [audibleBass(bass + octaves * 12), ...tones.map((note) => note + octaves * 12)];
}

/**
 * Take a voicing up `steps` inversions: the lowest chord tone jumps an octave,
 * becoming the new top note. The bass is left where it is — it is the chord's
 * root, and moving it would change which chord you are hearing, not its shape.
 */
export function invertVoicing(voicing: Midi[], steps: number): Midi[] {
  if (steps <= 0) return voicing;
  const [bass, ...tones] = voicing;
  return [bass, ...rotateUp(tones, steps)];
}

/** Move the lowest note up an octave, `steps` times. */
function rotateUp(notes: Midi[], steps: number): Midi[] {
  let out = [...notes].sort((a, b) => a - b);
  for (let i = 0; i < steps; i++) {
    const [lowest, ...rest] = out;
    out = [...rest, lowest + 12];
  }
  return out;
}

/** The chord tones of a voicing, without its bass note. */
export function chordTones(voicing: Midi[]): Midi[] {
  return voicing.slice(1);
}

/** Every inversion of `chord`, each shifted by whole octaves, that fits the window. */
function candidates(chord: Midi[], window: VoicingWindow): Midi[][] {
  const sorted = [...chord].sort((a, b) => a - b);
  const out: Midi[][] = [];

  for (let inversion = 0; inversion < sorted.length; inversion++) {
    const inverted = sorted
      .map((note, i) => (i < inversion ? note + 12 : note))
      .sort((a, b) => a - b);

    for (let octave = -3; octave <= 3; octave++) {
      const shifted = inverted.map((n) => n + octave * 12);
      if (shifted[0] >= window.low && shifted[shifted.length - 1] <= window.high) {
        out.push(shifted);
      }
    }
  }
  return out;
}

/** Total semitone travel from the previous chord — the thing voice leading minimises. */
function travel(notes: Midi[], previous: Midi[]): number {
  return notes.reduce(
    (sum, note) => sum + Math.min(...previous.map((p) => Math.abs(note - p))),
    0,
  );
}

/**
 * Open, "colourful" voicing: the third lifted an octave to become a tenth, the
 * root doubled an octave below, the fifth and any seventh in between.
 *
 *     C E G   →   C3  C4  G4  E5
 *                 └── root doubled    └── third as a tenth
 *
 * A fixed shape rather than a search, so it deliberately does not voice-lead:
 * every chord gets the same spread, transposed. That consistency is the point —
 * it is the sound of one hand keeping a shape and moving it.
 */
export function spreadVoicing(
  chord: Midi[],
  window: VoicingWindow,
  bassTone = 0,
  inversions = 0,
): Midi[] {
  // Invert the chord *before* spreading it, not the finished voicing. Lifting
  // the bottom note of a spread would move its doubled root onto the root
  // already sounding — a unison, the low octave gone, and nothing new heard.
  // Rotating first keeps the shape and gives a genuine inversion of it.
  const [root, third, fifth, ...extras] = rotateUp(chord, inversions);
  const tones = [root - 12, root, fifth, ...extras, third + 12].sort((a, b) => a - b);

  const fitted = centreInWindow(tones, window);
  // How far the whole shape moved, so the bass follows it.
  const moved = fitted[0] - tones[0];
  const bassNote = chord[bassTone % chord.length] + moved;

  return [audibleBass(bassNote - 12 * window.bassOctaves), ...fitted];
}

/** Nudge a chord into the window when no inversion fits outright (wide sevenths). */
function centreInWindow(chord: Midi[], window: VoicingWindow): Midi[] {
  const sorted = [...chord].sort((a, b) => a - b);
  const centre = (window.low + window.high) / 2;
  const chordCentre = (sorted[0] + sorted[sorted.length - 1]) / 2;
  const octaves = Math.round((centre - chordCentre) / 12);
  return sorted.map((n) => n + octaves * 12);
}

/**
 * Pick the inversion closest to the previous chord, then hang a bass note underneath.
 * Pure and swappable: same chord + same previous + same window always gives the same voicing.
 *
 * `previous` is the previous chord's *tones* — pass it through `chordTones` first.
 * The bass is not voice-led, and including it would drag every chord downward.
 *
 * Returns `[bass, ...chordTones]`, ascending after the bass.
 */
export function voice(
  chord: Midi[],
  previous: Midi[] | null,
  window: VoicingWindow,
  /** Which chord tone to hang underneath: 0 root, 1 third, 2 fifth. */
  bassTone = 0,
): Midi[] {
  const options = candidates(chord, window);
  const centre = (window.low + window.high) / 2;
  const previousTones = previous ?? [];

  let best: Midi[];
  if (options.length === 0) {
    best = centreInWindow(chord, window);
  } else if (previousTones.length === 0) {
    // First chord of the session: sit near the middle of the window.
    best = options.reduce((a, b) =>
      Math.abs(average(b) - centre) < Math.abs(average(a) - centre) ? b : a,
    );
  } else {
    best = options.reduce((a, b) => {
      const scoreA = travel(a, previousTones) + Math.abs(average(a) - centre) * 0.01;
      const scoreB = travel(b, previousTones) + Math.abs(average(b) - centre) * 0.01;
      return scoreB < scoreA ? b : a;
    });
  }

  // The bass follows a chord tone in root position, not the inverted bottom note.
  const bass = audibleBass(chord[bassTone % chord.length] - 12 * window.bassOctaves);
  return [bass, ...best];
}

function average(notes: Midi[]): number {
  return notes.reduce((a, b) => a + b, 0) / notes.length;
}
