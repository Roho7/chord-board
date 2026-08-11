/**
 * The synth's tone, as plain data. Pure — no Tone.js import, so it can be read
 * and reasoned about anywhere, including on the server.
 *
 * Every field maps onto one control in the synth panel and one Tone parameter.
 */

export type Waveform = 'sine' | 'triangle' | 'sawtooth' | 'square';
export type FilterType = 'lowpass' | 'highpass' | 'bandpass';
export type Rolloff = -12 | -24 | -48;

export interface SynthPatch {
  // Oscillator
  waveform: Waveform;
  /** Detuned copies of the oscillator. 1 is a single clean oscillator. */
  voices: number;
  /** How far apart those copies are detuned, in cents. */
  spread: number;
  /** Fine tuning of the whole oscillator, in cents. */
  detune: number;

  // Amplitude envelope — how the note swells and fades.
  attack: number;
  decay: number;
  sustain: number;
  release: number;

  // Filter
  filterType: FilterType;
  /** Where the filter sits when the filter envelope is closed, in Hz. */
  cutoff: number;
  /** Emphasis at the cutoff. High values whistle. */
  resonance: number;
  /** Steepness of the filter slope, in dB per octave. */
  rolloff: Rolloff;

  // Filter envelope — how far and how fast the filter opens on each note.
  filterAttack: number;
  filterDecay: number;
  filterSustain: number;
  filterRelease: number;
  /** How many octaves above the cutoff the envelope opens the filter. */
  filterOctaves: number;

  // Output
  /** Waveshaping drive, 0 is clean. */
  drive: number;
  /** Reverb send for the synth alone. */
  reverb: number;
  /** Output level in dB. */
  level: number;
}

/**
 * A bare unison sawtooth through a gentle static lowpass — one oscillator per
 * note, no detune, no filter sweep, and an amp envelope that is a fast edge into
 * full sustain. Plain enough that every control in the panel has somewhere
 * obvious to move it.
 *
 * Filter envelope amount is 0, which pins the filter at the cutoff: a static
 * filter, not a sweeping one.
 */
export const DEFAULT_PATCH: SynthPatch = {
  waveform: 'sawtooth',
  voices: 1,
  spread: 0,
  detune: 0,

  attack: 0.05,
  decay: 0.05,
  sustain: 1,
  release: 0.05,

  filterType: 'lowpass',
  cutoff: 1200,
  resonance: 0.7,
  rolloff: -12,

  filterAttack: 0.01,
  filterDecay: 0.1,
  filterSustain: 1,
  filterRelease: 0.1,
  filterOctaves: 0,

  drive: 0,
  reverb: 0,
  level: -20,
};

/**
 * Translate a patch into Tone's MonoSynth options. The only real trick is the
 * `fat` prefix: Tone exposes detuned stacks as a separate oscillator type
 * rather than as a voice count, so one voice means dropping the prefix.
 */
export function toSynthOptions(patch: SynthPatch) {
  const oscillator =
    patch.voices > 1
      ? { type: `fat${patch.waveform}` as const, count: patch.voices, spread: patch.spread }
      : { type: patch.waveform };

  return {
    detune: patch.detune,
    oscillator,
    envelope: {
      attack: patch.attack,
      decay: patch.decay,
      sustain: patch.sustain,
      release: patch.release,
    },
    filter: {
      type: patch.filterType,
      Q: patch.resonance,
      rolloff: patch.rolloff,
    },
    filterEnvelope: {
      attack: patch.filterAttack,
      decay: patch.filterDecay,
      sustain: patch.filterSustain,
      release: patch.filterRelease,
      baseFrequency: patch.cutoff,
      octaves: patch.filterOctaves,
    },
  };
}
