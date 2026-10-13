'use client';

import { audioContext } from './unlock';
import type { Midi } from '@/theory/notes';
import type {
  AudioEngine,
  InstrumentName,
  NoteOnOptions,
  UpdateOptions,
  VoiceHandle,
} from './engine';
import { createToneEngine } from './toneEngine';
import { DEFAULT_PATCH, toSynthOptions, type SynthPatch } from './synthPatch';
import {
  DEFAULT_STRINGS,
  ENSEMBLE_RATES,
  toStringsOptions,
  type StringsPatch,
} from './stringsPatch';

/**
 * The rack: both instruments alive at once behind a shared output gain.
 * Switching instruments changes which engine receives notes — nothing is
 * disposed and rebuilt, because that clicks and stalls.
 *
 * Tone.js touches `window`, so it is imported dynamically on the first user
 * gesture. Everything above this module stays synchronous and SSR-safe.
 */

/** The instruments that stream samples and are unplayable until they arrive. */
export type SampledInstrument = 'piano' | 'guitar';

export const SAMPLED: readonly SampledInstrument[] = ['piano', 'guitar'];

interface Rack {
  engines: Record<InstrumentName, AudioEngine>;
  loaded: Record<SampledInstrument, Promise<void>>;
}

const SALAMANDER_BASE = 'https://tonejs.github.io/audio/salamander/';

const SALAMANDER_URLS: Record<string, string> = Object.fromEntries(
  ['A0', 'C1', 'D#1', 'F#1', 'A1', 'C2', 'D#2', 'F#2', 'A2', 'C3', 'D#3', 'F#3', 'A3',
    'C4', 'D#4', 'F#4', 'A4', 'C5', 'D#5', 'F#5', 'A5', 'C6', 'D#6', 'F#6', 'A6',
    'C7', 'D#7', 'F#7', 'A7', 'C8',
  ].map((note) => [note, `${note.replace('#', 's')}.mp3`]),
);

const GUITAR_BASE = 'https://nbrosowsky.github.io/tonejs-instruments/samples/guitar-acoustic/';

/**
 * Every sample that actually exists in that set, D2 to D5 chromatic — verified
 * rather than assumed, because a missing file makes `Tone.loaded()` hang and the
 * instrument never becomes playable. Sharps are spelled with `s`, as the files are.
 */
const GUITAR_URLS: Record<string, string> = Object.fromEntries(
  ['D2', 'Ds2', 'E2', 'F2', 'Fs2', 'G2', 'Gs2', 'A2', 'As2', 'B2',
   'C3', 'Cs3', 'D3', 'Ds3', 'E3', 'F3', 'Fs3', 'G3', 'Gs3', 'A3', 'As3', 'B3',
   'C4', 'Cs4', 'D4', 'Ds4', 'E4', 'F4', 'Fs4', 'G4', 'Gs4', 'A4', 'As4', 'B4',
   'C5', 'Cs5', 'D5',
  ].map((note) => [note.replace('s', '#'), `${note}.mp3`]),
);

let rack: Rack | null = null;
let booting: Promise<Rack> | null = null;
let active: InstrumentName = 'synth';
const readyListeners: Record<SampledInstrument, Array<() => void>> = { piano: [], guitar: [] };

/**
 * The synth's live nodes, once built. Held outside the rack so `setSynthPatch`
 * can reach them without every caller needing the whole graph.
 */
let synthChannel: {
  synth: { set(options: object): unknown; volume: { value: number } };
  drive: { distortion: number; wet: { value: number } };
  reverb: { wet: { value: number } };
} | null = null;

let patch: SynthPatch = DEFAULT_PATCH;

/**
 * The string machine's live nodes, held for the same reason as the synth's.
 *
 * Frequency signals are typed loosely because Tone declares them as `Frequency`
 * — we only ever write a number, but the read type includes strings like "C4".
 */
interface FrequencySignal {
  value: number | string;
}

let stringsChannel: {
  synth: { set(options: object): unknown; volume: { value: number } };
  tone: { frequency: FrequencySignal; Q: { value: number } };
  fast: { wet: { value: number }; frequency: FrequencySignal; depth: number };
  slow: { wet: { value: number }; frequency: FrequencySignal; depth: number };
  hall: { wet: { value: number } };
} | null = null;

let strings: StringsPatch = DEFAULT_STRINGS;

/**
 * Reshape the synth. Safe before the rack exists — the patch is remembered and
 * applied when it is built, so the panel works before the first note.
 */
export function setSynthPatch(next: SynthPatch): void {
  patch = next;
  if (!synthChannel) return;
  synthChannel.synth.set(toSynthOptions(next));
  synthChannel.synth.volume.value = next.level;
  synthChannel.drive.distortion = next.drive;
  synthChannel.drive.wet.value = next.drive;
  synthChannel.reverb.wet.value = next.reverb;
}

/**
 * Reshape the strings. Safe before the rack exists, like `setSynthPatch`.
 *
 * The two chorus stages share one rate control: they keep their ratio, because
 * it is the difference between them that reads as several players rather than
 * as one detuned one.
 */
export function setStringsPatch(next: StringsPatch): void {
  strings = next;
  if (!stringsChannel) return;
  const { synth, tone, fast, slow, hall } = stringsChannel;

  synth.set(toStringsOptions(next));
  synth.volume.value = next.level;

  tone.frequency.value = next.tone;
  tone.Q.value = next.resonance;

  fast.wet.value = next.ensemble;
  fast.frequency.value = ENSEMBLE_RATES.fast * next.rate;
  fast.depth = next.depth * 0.55;

  slow.wet.value = next.ensemble;
  slow.frequency.value = ENSEMBLE_RATES.slow * next.rate;
  slow.depth = next.depth;

  hall.wet.value = next.reverb;
}

async function buildRack(): Promise<Rack> {
  const Tone = await import('tone');

  // Build on the context the gesture handlers already created and resumed
  // (see unlock.ts) — Tone's own would be created too late to be unlocked.
  // Dispose Tone's default one: importing Tone made it, nothing uses it, and
  // phones cap how many contexts a page may hold.
  Tone.setContext(audioContext(), true);
  // Belt and braces: a no-op if the gesture already got it running.
  await Tone.start();
  // Default lookAhead is 100ms, which you can feel when playing along to something.
  Tone.getContext().lookAhead = 0.01;

  const master = new Tone.Gain(0.7).toDestination();
  const reverb = new Tone.Reverb({ decay: 2.2, wet: 0.16 }).connect(master);
  const compressor = new Tone.Compressor(-18, 3).connect(reverb);

  // The synth gets its own drive and reverb send so the panel can reshape it
  // without touching the other instruments, and a MonoSynth voice so there is
  // a real filter and filter envelope to control.
  const synthReverb = new Tone.Reverb({ decay: 2.6, wet: patch.reverb }).connect(compressor);
  const drive = new Tone.Distortion({ distortion: patch.drive, wet: patch.drive }).connect(
    synthReverb,
  );

  const synth = new Tone.PolySynth(Tone.MonoSynth, toSynthOptions(patch));
  synth.volume.value = patch.level;
  synth.connect(drive);

  synthChannel = { synth, drive, reverb: synthReverb };

  // String machine, not a sampled orchestra: a detuned saw stack behind two
  // chorus stages, which is how the Solina and its imitators faked a section.
  // Synthesised means it is playable on the first keypress, like the synth.
  // Reverb decay is fixed and the panel only moves the send: changing decay
  // regenerates the impulse response, which drops out mid-chord.
  const hall = new Tone.Reverb({ decay: 4, wet: strings.reverb }).connect(compressor);

  // Two chorus stages at different rates is the whole trick — one alone reads as
  // a wobble, two beat against each other and read as several players.
  const ensembleFast = new Tone.Chorus({
    frequency: ENSEMBLE_RATES.fast * strings.rate,
    delayTime: 2,
    depth: strings.depth * 0.55,
    wet: strings.ensemble,
  })
    .connect(hall)
    .start();
  const ensembleSlow = new Tone.Chorus({
    frequency: ENSEMBLE_RATES.slow * strings.rate,
    delayTime: 4.5,
    depth: strings.depth,
    wet: strings.ensemble,
  })
    .connect(ensembleFast)
    .start();

  // Saws this wide are all buzz up top; roll it off where a bow stops biting.
  // One filter for the whole section rather than one per voice — same sound,
  // and it leaves a single node for the panel to move.
  const bowTone = new Tone.Filter({
    type: 'lowpass',
    frequency: strings.tone,
    rolloff: -12,
    Q: strings.resonance,
  }).connect(ensembleSlow);

  const stringSection = new Tone.PolySynth(Tone.Synth, toStringsOptions(strings));
  stringSection.volume.value = strings.level;
  stringSection.connect(bowTone);

  stringsChannel = {
    synth: stringSection,
    tone: bowTone,
    fast: ensembleFast,
    slow: ensembleSlow,
    hall,
  };

  // Both sampled instruments announce themselves the same way, so the toggle can
  // stay disabled with a reason until each one is genuinely playable.
  const loaded = {} as Record<SampledInstrument, Promise<void>>;
  const announce: Record<SampledInstrument, () => void> = { piano: () => {}, guitar: () => {} };
  for (const name of SAMPLED) {
    loaded[name] = new Promise<void>((resolve) => {
      announce[name] = () => {
        resolve();
        readyListeners[name].forEach((fn) => fn());
        readyListeners[name] = [];
      };
    });
  }

  const piano = new Tone.Sampler({
    urls: SALAMANDER_URLS,
    baseUrl: SALAMANDER_BASE,
    release: 1.2,
    onload: () => announce.piano(),
    onerror: () => announce.piano(),
  });
  piano.volume.value = -6;
  piano.connect(compressor);

  // Steel-string body: a touch of high-mid lift and its own short room, so
  // strummed chords do not sit as dry as the piano.
  const guitarBody = new Tone.Reverb({ decay: 1.4, wet: 0.14 }).connect(compressor);

  const guitar = new Tone.Sampler({
    urls: GUITAR_URLS,
    baseUrl: GUITAR_BASE,
    release: 0.8,
    onload: () => announce.guitar(),
    onerror: () => announce.guitar(),
  });
  guitar.volume.value = -4;
  guitar.connect(guitarBody);

  return {
    engines: {
      synth: createToneEngine(synth),
      strings: createToneEngine(stringSection),
      piano: createToneEngine(piano),
      guitar: createToneEngine(guitar),
    },
    loaded,
  };
}

/**
 * Pull Tone into the module cache ahead of the first gesture. Importing it does
 * not create an AudioContext, so this is safe to do on mount — it just means the
 * first keypress isn't waiting on a few hundred kilobytes.
 */
export function prefetchTone(): void {
  void import('tone');
}

/** Boot the audio graph. Safe to call repeatedly; only the first call builds. */
export function ensureRack(): Promise<Rack> {
  booting ??= buildRack().then((built) => {
    rack = built;
    return built;
  });
  return booting;
}

export function onSamplesReady(name: SampledInstrument, listener: () => void): void {
  if (rack) {
    void rack.loaded[name].then(listener);
  } else {
    readyListeners[name].push(listener);
  }
}

export function setInstrument(name: InstrumentName): void {
  if (name === active) return;
  // Hand off cleanly: the outgoing engine still owns every sounding voice.
  rack?.engines[active].releaseAll();
  active = name;
}

/**
 * A voice as the app sees it. `inner` is null while the rack is still booting —
 * the first keypress of a session queues its chord rather than dropping it.
 */
export interface Voice extends VoiceHandle {
  notes: Midi[];
  released: boolean;
  engine: AudioEngine | null;
  inner: VoiceHandle | null;
}

let nextVoiceId = 1;

export function attack(notes: Midi[], velocity = 0.8, options?: NoteOnOptions): Voice {
  const instrument = active;
  const voice: Voice = {
    id: nextVoiceId++,
    notes,
    released: false,
    engine: null,
    inner: null,
  };

  if (rack) {
    voice.engine = rack.engines[instrument];
    voice.inner = voice.engine.noteOn(notes, velocity, options);
  } else {
    void ensureRack().then((built) => {
      if (voice.released) return;
      voice.engine = built.engines[instrument];
      // Read `voice.notes`, not the captured argument: a modifier pressed while
      // the rack was still booting has already rewritten them.
      voice.inner = voice.engine.noteOn(voice.notes, velocity, options);
    });
  }
  return voice;
}

/** Move a sounding voice onto a new set of notes without re-striking it. */
export function retune(voice: Voice, notes: Midi[], options?: UpdateOptions): void {
  voice.notes = notes;
  if (voice.engine && voice.inner) voice.engine.update(voice.inner, notes, options);
}

export function release(voice: Voice): void {
  voice.released = true;
  if (voice.engine && voice.inner) {
    voice.engine.noteOff(voice.inner);
    voice.inner = null;
  }
}

export function releaseAll(): void {
  if (!rack) return;
  Object.values(rack.engines).forEach((engine) => engine.releaseAll());
}
