/**
 * The string machine's tone, as plain data. Pure — no Tone.js import, same as
 * `synthPatch`, so it can be read anywhere including on the server.
 *
 * The controls are named for what a string machine actually has rather than for
 * what the synth panel has: a section of detuned players, a bow envelope, a tone
 * control, and the ensemble circuit that turns one into many.
 */

export interface StringsPatch {
  // Section — how many players, and how far out of tune with each other.
  /** Detuned copies per note. 1 is a single player and sounds like it. */
  players: number;
  /** How far apart those copies sit, in cents. */
  spread: number;
  /** Fine tuning of the whole section, in cents. */
  detune: number;

  // Bow — the amp envelope. Slow attack is what separates this from an organ.
  attack: number;
  decay: number;
  sustain: number;
  release: number;

  // Tone — one static lowpass. Saws this wide are all buzz above the bow.
  /** Lowpass cutoff in Hz. */
  tone: number;
  /** Emphasis at the cutoff. */
  resonance: number;

  // Ensemble — the two chorus stages that fake a section out of one oscillator.
  /** How much of the ensemble is heard, 0 is dry and reveals the raw saws. */
  ensemble: number;
  /** Multiplier on both chorus rates. Low is a swell, high is a warble. */
  rate: number;
  /** How far the chorus delays sweep. */
  depth: number;

  // Output
  /** Hall send. */
  reverb: number;
  /** Output level in dB. */
  level: number;
}

/**
 * The Solina-ish default: three players spread wide, a bow that takes a moment
 * to speak, and both chorus stages up. This is the sound the Strings button
 * promises — the panel is for moving away from it, not for finding it.
 */
export const DEFAULT_STRINGS: StringsPatch = {
  players: 3,
  spread: 34,
  detune: 0,

  attack: 0.18,
  decay: 0.6,
  sustain: 0.85,
  release: 1.4,

  tone: 2600,
  resonance: 0.4,

  ensemble: 0.55,
  rate: 1,
  depth: 0.6,

  reverb: 0.38,
  level: -20,
};

/** The chorus rates at `rate: 1`. Two different speeds is the whole trick. */
export const ENSEMBLE_RATES = { fast: 6.2, slow: 0.8 } as const;

/**
 * Translate a patch into Tone's Synth options. No filter block: the lowpass is a
 * separate node in the chain rather than per-voice, because one static filter
 * across the section is cheaper and sounds the same.
 */
export function toStringsOptions(patch: StringsPatch) {
  const oscillator =
    patch.players > 1
      ? { type: 'fatsawtooth' as const, count: patch.players, spread: patch.spread }
      : { type: 'sawtooth' as const };

  return {
    detune: patch.detune,
    oscillator,
    envelope: {
      attack: patch.attack,
      decay: patch.decay,
      sustain: patch.sustain,
      release: patch.release,
    },
  };
}
