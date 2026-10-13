'use client';

import { create } from 'zustand';
import {
  attack,
  ensureRack,
  onSamplesReady,
  SAMPLED,
  type SampledInstrument,
  release,
  releaseAll,
  retune,
  setInstrument as setRackInstrument,
  setSynthPatch,
  setStringsPatch as setRackStringsPatch,
  type Voice,
} from '@/audio/rack';
import type { InstrumentName } from '@/audio/engine';
import { DEFAULT_PATCH, type SynthPatch } from '@/audio/synthPatch';
import { DEFAULT_STRINGS, type StringsPatch } from '@/audio/stringsPatch';
import {
  buildPadChord,
  chordColour,
  inversionSteps,
  NO_MODIFIERS,
  octaveOffset,
  type BassTone,
  type ChordModifiers,
  type ExtraVoice,
} from '@/theory/chords';
import type { Midi, PitchClass } from '@/theory/notes';
import { REGISTER_LIMIT } from '@/input/keymap';
import { makeScale, type ModeName } from '@/theory/scales';
import {
  chordTones,
  GUITAR_WINDOW,
  invertVoicing,
  PAD_WINDOW,
  PIANO_WINDOW,
  spreadVoicing,
  STRINGS_WINDOW,
  transposeVoicing,
  voice as voiceChord,
  type VoicingWindow,
} from '@/theory/voicing';

const WINDOWS: Record<InstrumentName, VoicingWindow> = {
  synth: PAD_WINDOW,
  strings: STRINGS_WINDOW,
  piano: PIANO_WINDOW,
  guitar: GUITAR_WINDOW,
};

/**
 * The last step: move the finished voicing bodily by whole octaves. Two things
 * add up here — the register you latched with 1 and 3, and whatever the
 * momentary octave keys are doing on top of it right now.
 */
function shape(voicing: Midi[], modifiers: ChordModifiers, register: number): Midi[] {
  return transposeVoicing(voicing, register + octaveOffset(modifiers));
}

/**
 * A note brought in by a modifier rather than by a keystrike. Quieter than the
 * 0.8 of a struck chord and faded in rather than struck, so the third sliding
 * under J reads as the chord bending rather than as that note being played.
 */
const BEND = { velocity: 0.35, attack: 0.12 } as const;

/**
 * Voice a chord the way the board is currently set: either the close, voice-led
 * default or the wide spread. The only place that choice is made.
 */
function voiceFor(
  chord: Midi[],
  previous: Midi[] | null,
  window: VoicingWindow,
  modifiers: ChordModifiers,
  spread: boolean,
  bass: BassTone = 0,
): Midi[] {
  const inversions = inversionSteps(modifiers);
  // Inversion belongs to the voicing, not to a step after it: the close voicing
  // rotates its chosen notes, while the spread rotates the chord it is built
  // from. Same key, the right meaning in each mode.
  return spread
    ? spreadVoicing(chord, window, bass, inversions)
    : invertVoicing(voiceChord(chord, previous, window, bass), inversions);
}

/**
 * The notes a support key sounds for a degree. Derived rather than remembered,
 * so it always reflects the current key, mode, instrument, octave and voicing.
 *
 * Space doubles the whole chord an octave up; the other two pick a single note
 * out of the bass. Both follow the modifiers, so a chord coloured by J or [ is
 * doubled as it actually sounds.
 */
function extraNotesFor(
  place: Pick<AppState, 'root' | 'mode' | 'instrument' | 'spread' | 'register'>,
  degree: number,
  modifiers: ChordModifiers,
  previous: Midi[] | null,
  kind: ExtraVoice,
): Midi[] {
  const chord = buildPadChord(makeScale(place.root, place.mode), degree, chordColour(modifiers));
  const window = WINDOWS[place.instrument];

  if (kind === 'chordOctave') {
    const voiced = shape(voiceFor(chord, previous, window, modifiers, place.spread), modifiers, place.register);
    return transposeVoicing(voiced, 1);
  }

  const bass: BassTone = kind === 'bassFifth' ? 2 : 0;
  return [shape(voiceFor(chord, previous, window, modifiers, place.spread, bass), modifiers, place.register)[0]];
}

/**
 * Re-voice everything currently sounding for a new set of modifiers or voicing
 * mode. Shared by the modifier keys and the spread toggle so they can never
 * drift apart. Returns the voice-leading context to carry forward.
 */
function revoiceSounding(
  state: AppState,
  modifiers: ChordModifiers,
  spread: boolean,
  register: number,
): Midi[] | null {
  const scale = makeScale(state.root, state.mode);
  const colour = chordColour(modifiers);
  const window = WINDOWS[state.instrument];
  let lastVoicing = state.lastVoicing;

  state.heldDegrees.forEach((voice, degree) => {
    const chord = buildPadChord(scale, degree, colour);
    const voiced = voiceFor(chord, lastVoicing, window, modifiers, spread);
    retune(voice, shape(voiced, modifiers, register), BEND);
    lastVoicing = chordTones(voiced);
  });

  if (state.extraVoice && state.extraKind !== null && state.lastDegree !== null) {
    const place = { ...state, spread, register };
    retune(
      state.extraVoice,
      extraNotesFor(place, state.lastDegree, modifiers, lastVoicing, state.extraKind),
      BEND,
    );
  }
  return lastVoicing;
}

/** The AudioContext only ever needs unlocking once per page load. */
let unlocked = false;

export interface AppState {
  root: PitchClass;
  mode: ModeName;
  instrument: InstrumentName;
  /** Which sampled instruments have finished streaming and are playable. */
  samplesReady: Record<SampledInstrument, boolean>;
  /** I O P J, as held. Live — sounding chords follow them. */
  modifiers: ChordModifiers;
  /** The synth's tone. Applies live, including to notes already sounding. */
  patch: SynthPatch;
  /** The string machine's tone. Live in the same way. */
  stringsPatch: StringsPatch;
  /**
   * Caps Lock. On, a chord keeps ringing after its key lifts, like a sustain
   * pedal you don't have to hold — but only the latest one. Striking the next
   * chord stops the last, so the board never piles up into a wash.
   */
  sustain: boolean;
  /**
   * The 2 key. A toggle, not a held modifier: on, every chord is voiced wide —
   * root doubled below, third lifted into a tenth.
   */
  spread: boolean;
  /**
   * The latched working register in octaves, set with 1 and 3. Unlike the
   * momentary octave keys this stays where you put it, so a whole section can
   * sit low without a finger held down.
   */
  register: number;
  /**
   * Every sounding voice, keyed by degree, not key code: makes "is this pad
   * sounding?" a lookup and prevents leaking a voice on double-press. Under
   * sustain this outlives the keypress, so it is not the same as `pressedDegrees`.
   */
  heldDegrees: Map<number, Voice>;
  /** Which pad keys are physically down right now. */
  pressedDegrees: Set<number>;
  /** Which support keys are physically down. */
  extraKeys: Set<ExtraVoice>;
  /**
   * The one extra voice sounding, and which support key it belongs to.
   * Monophonic: a new support key replaces it rather than stacking on top.
   */
  extraVoice: Voice | null;
  extraKind: ExtraVoice | null;
  /**
   * The last degree struck, remembered past its release. The bass keys sound
   * tones of this chord, so they always have something to play.
   */
  lastDegree: number | null;
  /** Voice-leading context: the last chord's tones, without its bass note. */
  lastVoicing: Midi[] | null;

  setRoot(root: PitchClass): void;
  setMode(mode: ModeName): void;
  setInstrument(instrument: InstrumentName): void;
  /** Modifiers apply immediately, to sounding chords as well as new ones. */
  setModifiers(patch: Partial<ChordModifiers>): void;
  setSustain(on: boolean): void;
  toggleSpread(): void;
  /** Step the latched register, clamped. */
  stepRegister(delta: number): void;
  /** A support key went down: strike its voice of the last chord played. */
  pressExtra(kind: ExtraVoice): void;
  /** A support key came up. Never sounds anything — silence only. */
  releaseExtra(kind: ExtraVoice): void;
  /** Change part of the synth patch. Pass null to reset it. */
  setPatch(patch: Partial<SynthPatch> | null): void;
  /** Change part of the strings patch. Pass null to reset it. */
  setStringsPatch(patch: Partial<StringsPatch> | null): void;
  attackDegree(degree: number): void;
  releaseDegree(degree: number): void;
  panic(): void;
  unlockAudio(): void;
}

export const useAppStore = create<AppState>((set, get) => ({
  root: 0,
  mode: 'ionian',
  instrument: 'synth',
  samplesReady: { piano: false, guitar: false },
  modifiers: NO_MODIFIERS,
  patch: DEFAULT_PATCH,
  stringsPatch: DEFAULT_STRINGS,
  sustain: false,
  spread: false,
  register: 0,
  heldDegrees: new Map(),
  pressedDegrees: new Set(),
  extraKeys: new Set(),
  extraVoice: null,
  extraKind: null,
  lastDegree: null,
  lastVoicing: null,

  setRoot(root) {
    get().panic();
    set({ root, lastVoicing: null });
  },

  setMode(mode) {
    get().panic();
    set({ mode, lastVoicing: null });
  },

  setInstrument(instrument) {
    if (instrument === get().instrument) return;
    if (instrument in get().samplesReady && !get().samplesReady[instrument as SampledInstrument]) return;
    // Release on the outgoing engine first, or its held notes hang forever.
    get().panic();
    setRackInstrument(instrument);
    set({ instrument, lastVoicing: null });
  },

  setModifiers(patch) {
    const state = get();
    const modifiers = { ...state.modifiers, ...patch };
    const keys = Object.keys(modifiers) as Array<keyof ChordModifiers>;
    if (keys.every((key) => modifiers[key] === state.modifiers[key])) return;

    // Bend every sounding chord onto the new colour, inversion and register.
    // Voicing happens in the base register and root position; the octave and
    // invert keys reshape the result afterwards. Leading from `lastVoicing`
    // rather than from the sounding notes keeps the context in that base
    // register, so the reshaping never has to be undone.
    const lastVoicing = revoiceSounding(state, modifiers, state.spread, state.register);

    set({ modifiers, lastVoicing });
  },

  setPatch(patch) {
    const next = patch === null ? DEFAULT_PATCH : { ...get().patch, ...patch };
    // Push to the audio graph first so a dragged slider is heard on this frame,
    // not after React has re-rendered.
    setSynthPatch(next);
    set({ patch: next });
  },

  setStringsPatch(patch) {
    const next = patch === null ? DEFAULT_STRINGS : { ...get().stringsPatch, ...patch };
    // Audio graph first, same reason: a dragged slider should be heard on this
    // frame rather than after React has re-rendered.
    setRackStringsPatch(next);
    set({ stringsPatch: next });
  },

  toggleSpread() {
    const state = get();
    const spread = !state.spread;
    // Live, like every other control: chords already sounding open up or close
    // back down rather than waiting for the next keypress.
    const lastVoicing = revoiceSounding(state, state.modifiers, spread, state.register);
    set({ spread, lastVoicing });
  },

  stepRegister(delta) {
    const state = get();
    const register = Math.max(-REGISTER_LIMIT, Math.min(REGISTER_LIMIT, state.register + delta));
    if (register === state.register) return;

    // Live, like every other control: whatever is sounding moves with you.
    const lastVoicing = revoiceSounding(state, state.modifiers, state.spread, register);
    set({ register, lastVoicing });
  },

  setSustain(on) {
    const state = get();
    if (on === state.sustain) return;
    if (on) {
      set({ sustain: true });
      return;
    }

    // Sustain off: everything still ringing without a key behind it stops now.
    const held = new Map(state.heldDegrees);
    state.heldDegrees.forEach((voice, degree) => {
      if (state.pressedDegrees.has(degree)) return;
      release(voice);
      held.delete(degree);
    });
    set({ sustain: false, heldDegrees: held });
  },

  pressExtra(kind) {
    const state = get();
    const extraKeys = new Set(state.extraKeys).add(kind);
    if (state.lastDegree === null) {
      set({ extraKeys });
      return;
    }

    // One extra voice at a time: the new key replaces whatever was sounding
    // rather than stacking on top. `restrike` makes the attack audible even
    // when a held chord is already sounding some of those pitches.
    if (state.extraVoice) release(state.extraVoice);
    const notes = extraNotesFor(state, state.lastDegree, state.modifiers, state.lastVoicing, kind);
    set({
      extraKeys,
      extraVoice: attack(notes, 0.8, { restrike: true }),
      extraKind: kind,
    });
  },

  releaseExtra(kind) {
    const state = get();
    if (!state.extraKeys.has(kind)) return;

    const extraKeys = new Set(state.extraKeys);
    extraKeys.delete(kind);

    // Letting go never sounds a note. While another support key is still down
    // what it struck simply carries on — these move on presses only.
    if (extraKeys.size > 0) {
      set({ extraKeys });
      return;
    }
    if (state.extraVoice) release(state.extraVoice);
    set({ extraKeys, extraVoice: null, extraKind: null });
  },

  attackDegree(degree) {
    const state = get();
    const { heldDegrees, pressedDegrees, lastVoicing, modifiers } = state;
    if (pressedDegrees.has(degree)) return;

    // Sustain holds the latest chord, not a pile of them: striking a new one
    // clears anything still ringing without a key behind it. Pads you are
    // physically holding are left alone, so you can still stack chords by hand.
    const held = new Map(heldDegrees);
    heldDegrees.forEach((voice, sounding) => {
      if (sounding !== degree && pressedDegrees.has(sounding)) return;
      release(voice);
      held.delete(sounding);
    });

    const chord = buildPadChord(makeScale(state.root, state.mode), degree, chordColour(modifiers));
    const voiced = voiceFor(chord, lastVoicing, WINDOWS[state.instrument], modifiers, state.spread);

    // A sounding bass note is left alone: the bass keys are their own voice and
    // do not belong to any chord, so playing a chord never cuts the bass.
    held.set(degree, attack(shape(voiced, modifiers, state.register)));
    set({
      heldDegrees: held,
      pressedDegrees: new Set(pressedDegrees).add(degree),
      lastDegree: degree,
      lastVoicing: chordTones(voiced),
    });
  },

  releaseDegree(degree) {
    const state = get();
    const { heldDegrees, pressedDegrees, sustain } = state;
    if (!pressedDegrees.has(degree)) return;

    const pressed = new Set(pressedDegrees);
    pressed.delete(degree);
    const voice = heldDegrees.get(degree);

    // Under sustain the key lifts but the chord keeps ringing.
    if (sustain) {
      set({ pressedDegrees: pressed });
      return;
    }

    if (voice) release(voice);
    const held = new Map(heldDegrees);
    held.delete(degree);
    set({ heldDegrees: held, pressedDegrees: pressed });
  },

  panic() {
    const { heldDegrees, extraVoice } = get();
    heldDegrees.forEach(release);
    if (extraVoice) release(extraVoice);
    releaseAll();
    set({
      heldDegrees: new Map(),
      pressedDegrees: new Set(),
      extraVoice: null,
      extraKind: null,
      extraKeys: new Set(),
    });
  },

  unlockAudio() {
    if (unlocked) return;
    unlocked = true;
    void ensureRack();
    for (const name of SAMPLED) {
      onSamplesReady(name, () =>
        set((state) => ({ samplesReady: { ...state.samplesReady, [name]: true } })),
      );
    }
  },
}));
