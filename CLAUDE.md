@AGENTS.md

# Chord Board — build spec

A browser instrument for jamming. Pick a key and mode; eight keyboard keys become
the eight diatonic chords of that scale. Built for playing along with friends, not
for music education — latency and feel matter more than completeness.

## Stack

- Next.js (App Router) + TypeScript, strict mode
- Tone.js for audio
- Zustand for state
- Vitest for the theory module
- No Web MIDI — browser audio only

## Architecture

Five stages, strictly one direction:

```
keydown → degree resolver → chord builder → voicer → audio engine
                                  ↑
                            scale state (root + mode)
```

```
src/
  theory/    notes.ts  scales.ts  chords.ts  voicing.ts   ← pure, zero deps, unit-tested
  audio/     engine.ts  toneEngine.ts  rack.ts
  input/     keymap.ts  useKeyboard.ts
  state/     store.ts
  components/  ChordBoard.tsx  ChordPad.tsx  ScaleSelector.tsx
  app/       page.tsx  layout.tsx  globals.css
```

`theory/` must have no imports from anywhere else in the app. It is testable
without audio, without React, without a browser. Protect this boundary.

## Theory core

Scales are interval arrays in semitones from the root:

```ts
const SCALES = {
  ionian:        [0, 2, 4, 5, 7, 9, 11],
  dorian:        [0, 2, 3, 5, 7, 9, 10],
  phrygian:      [0, 1, 3, 5, 7, 8, 10],
  lydian:        [0, 2, 4, 6, 7, 9, 11],
  mixolydian:    [0, 2, 4, 5, 7, 9, 10],
  aeolian:       [0, 2, 3, 5, 7, 8, 10],
  locrian:       [0, 1, 3, 5, 6, 8, 10],
  harmonicMinor: [0, 2, 3, 5, 7, 8, 11],
  melodicMinor:  [0, 2, 3, 5, 7, 9, 11],
} as const;
```

**Do not hardcode chord qualities per mode.** Derive them. To build the chord on
degree `d`, take scale indices `d`, `d+2`, `d+4` (plus `d+6` for a seventh),
wrapping mod 7 and adding 12 semitones per wrap:

```ts
function buildChord(scale: Scale, degree: number, extension: 3 | 4): Midi[] {
  return Array.from({ length: extension }, (_, i) => {
    const idx = degree + i * 2;
    const octaves = Math.floor(idx / 7);
    return scale.root + scale.intervals[idx % 7] + octaves * 12;
  });
}
```

Then name the chord by measuring intervals from its root:

| Intervals | Quality |
|---|---|
| `0,4,7` | major |
| `0,3,7` | minor |
| `0,3,6` | diminished |
| `0,4,8` | augmented |
| `0,4,7,11` | maj7 |
| `0,4,7,10` | dominant 7 |
| `0,3,7,10` | m7 |
| `0,3,6,10` | m7♭5 |
| `0,3,6,9` | dim7 |

This yields correct results for harmonic minor (the `III+`, the `vii°7`) with no
special cases. Roman numerals come from the same function — case by quality,
`°` for diminished, `+` for augmented.

## Keymap

```
A S D F  →  degrees 0 1 2 3   (I  II  III  IV)
Z X C V  →  degrees 4 5 6 7   (V  VI  VII  I′)
```

**Key on `event.code`, never `event.key`.** Holding Shift turns `event.key` from
`'a'` into `'A'` and would silently break every pad. `event.code` is also
layout-independent, so AZERTY and QWERTZ work for free.

```ts
const KEYMAP: Record<string, number> = {
  KeyA: 0, KeyS: 1, KeyD: 2, KeyF: 3,
  KeyZ: 4, KeyX: 5, KeyC: 6, KeyV: 7,
};
```

Shift held at keydown → build a seventh instead of a triad. **Read the modifier
at attack time only.** If Shift is pressed while a chord is already sounding, do
not upgrade it mid-sustain — store the decision on the voice handle and ignore
Shift until that key lifts.

Note for later: `Z X C V` sits physically below `A S D F` but represents higher
degrees, which may feel inverted in play. Keep the map in its own module so
moving V–I′ to `Q W E R` is a one-line change.

## Voicing

Root-position triads sound like a MIDI demo. Two rules fix most of it:

1. **Constrain to a window** (roughly MIDI 55–76). Of the available inversions,
   pick the one with the smallest total semitone distance from the previous
   chord's notes. That's voice leading.
2. **Add a bass note** two octaves below the chord root, unaffected by inversion.

Signature stays pure and swappable:

```ts
function voice(chord: Midi[], previous: Midi[] | null, window: Window): Midi[]
```

Each instrument gets its own window config — pads want tight close voicings, the
piano wants a wider spread with the bass further down.

## Audio

Both instruments stay alive at once, routed into a shared output gain. Do not
dispose and recreate on switch — it clicks and stalls.

```ts
interface AudioEngine {
  noteOn(notes: Midi[], velocity: number): VoiceHandle;
  noteOff(handle: VoiceHandle): void;
  releaseAll(): void;
  dispose(): void;
}
```

- Default to the synth (`Tone.PolySynth`) — zero load time, playable immediately
- Load the sampled piano (`Tone.Sampler`, Salamander samples) in the background
- Keep the piano toggle disabled until `Tone.loaded()` resolves; show why
- On switch, call `releaseAll()` on the outgoing engine or held notes hang forever

## State

```ts
interface AppState {
  root: PitchClass;              // 0-11
  mode: ModeName;
  instrument: 'synth' | 'piano';
  pianoReady: boolean;
  heldDegrees: Map<number, VoiceHandle>;
  lastVoicing: Midi[] | null;    // voice-leading context
}
```

`heldDegrees` is keyed by degree, not key code — makes "is this pad lit?" a
trivial lookup and prevents leaking a voice on double-press.

## Gotchas that will cost an hour each

- `AudioContext` starts suspended. Resume it on the first user gesture or nothing
  plays and there is no error.
- Ignore `event.repeat` on keydown, or holding a key retriggers forever.
- Tone.js touches `window` — audio modules need `'use client'` and must not be
  imported into a server component.
- Track held keys in a `Set`/`Map` so a chord releases when *its own* key lifts,
  not when any key lifts.
- `preventDefault` on mapped keys so the page doesn't scroll or trigger find.

## Build order

1. `theory/` with Vitest tests. Verify chord names and roman numerals for a few
   keys and modes before any UI exists.
2. Keymap + static board rendering 8 pads with names and numerals. No sound.
3. Synth engine, root-position triads. First playable version.
4. Voice leading + bass note. This is the "sounds like music now" step.
5. Shift → sevenths.
6. Sampler engine + instrument toggle.

Ship each step working before starting the next.

## UI direction

Reference is a row of eight pads showing, per pad: the chord letter large, the
roman numeral beneath, and the keyboard key that triggers it. Pads light on press.

Design it for a dim room and peripheral vision — someone glances at this while
playing, they don't read it. That means high contrast, large type, and an
unmistakable pressed state. Avoid the default dark-slate-and-neon-accent look;
pick a palette with an actual point of view and commit to it.