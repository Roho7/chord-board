import type { CSSProperties } from 'react';
import type { ChordModifiers, ExtraVoice } from '@/theory/chords';

/**
 * How a sounding pad's gradient reads the controls. Each kind of control gets
 * its own channel so they stack instead of fighting:
 *
 * - chord colours (J I O P [) pull the body hue toward their own shade
 * - bass voices and the pedal pool amber-rose at the bottom
 * - 8va, octave doubling and the latched register brighten the top; 8vb sinks it
 * - invert turns the whole gradient over; spread loosens the blobs
 *
 * The body is a Paper Shaders mesh gradient fed `mesh`; the overlays in
 * globals.css read `vars`, which are `@property`-registered so they morph.
 */

export type Rgb = [number, number, number];

/** Everything the mesh gradient needs, as plain numbers so it can be tweened. */
export interface MeshTint {
  colours: Rgb[];
  distortion: number;
  swirl: number;
  rotation: number;
}

export interface PadTint {
  mesh: MeshTint;
  vars: CSSProperties;
}

/** Body colours at rest: the logo's ultramarine and violet. */
const BASE: { a: Rgb; b: Rgb } = { a: hex('#2a1fff'), b: hex('#7b5cff') };

/** Where each chord colour pulls the two body colours. */
const HUES: Partial<Record<keyof ChordModifiers, { a: Rgb; b: Rgb }>> = {
  minor: { a: hex('#16107a'), b: hex('#3a2bd0') },
  seventh: { a: hex('#6a1fd8'), b: hex('#b24bff') },
  dominant: { a: hex('#b0128a'), b: hex('#ff3fae') },
  suspended: { a: hex('#4a6bff'), b: hex('#8fb0ff') },
  ninth: { a: hex('#4b30e0'), b: hex('#c9b6ff') },
};

/** How much of the resting colour survives once any chord colour is on. */
const BASE_WEIGHT = 0.25;

export interface PadTintInput {
  modifiers: ChordModifiers;
  /** Extra voices held right now — only passed to the pad that owns them. */
  extras: ReadonlySet<ExtraVoice>;
  /** Latched octave, -2..2. */
  register: number;
  spread: boolean;
  /** Only the bass is left under the pedal. */
  pedal: boolean;
}

const CREAM = hex('#f5e2a8');

export function padTint({ modifiers, extras, register, spread, pedal }: PadTintInput): PadTint {
  const active = (Object.keys(HUES) as Array<keyof ChordModifiers>).filter((m) => modifiers[m]);

  let a = BASE.a;
  let b = BASE.b;
  if (active.length > 0) {
    a = mix(BASE.a, average(active.map((m) => HUES[m]!.a)), 1 - BASE_WEIGHT);
    b = mix(BASE.b, average(active.map((m) => HUES[m]!.b)), 1 - BASE_WEIGHT);
  }

  // Minor dims the cream; add9 lets it bloom.
  const glow = modifiers.ninth ? 0.9 : modifiers.minor ? 0.35 : 0.65;

  const pool = pedal ? 1 : extras.has('bassRoot') ? 0.9 : extras.has('bassFifth') ? 0.65 : 0;

  const lift = clamp01(
    (modifiers.octaveUp ? 1 : 0) +
      (extras.has('chordOctave') ? 0.7 : 0) +
      Math.max(register, 0) * 0.35,
  );
  const sink = clamp01((modifiers.octaveDown ? 1 : 0) + Math.max(-register, 0) * 0.35);

  return {
    mesh: {
      // Two body spots, the cream hotspot, and a deep shade of the body so the
      // colour has somewhere dark to fall into.
      colours: [a, b, mix(b, CREAM, glow), mix(a, [6, 4, 20], 0.45)],
      distortion: spread ? 1 : 0.8,
      swirl: spread ? 0.6 : 0.25,
      rotation: modifiers.inverted ? 180 : 0,
    },
    vars: {
      '--pad-b': css(b),
      '--pad-pool': pool,
      '--pad-lift': lift,
      '--pad-sink': sink,
    } as CSSProperties,
  };
}

function hex(value: string): Rgb {
  const n = parseInt(value.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

function css([r, g, b]: Rgb): string {
  return `rgb(${Math.round(r)} ${Math.round(g)} ${Math.round(b)})`;
}

function mix(from: Rgb, to: Rgb, amount: number): Rgb {
  return from.map((c, i) => c + (to[i] - c) * amount) as Rgb;
}

function average(colours: Rgb[]): Rgb {
  return [0, 1, 2].map((i) => colours.reduce((sum, c) => sum + c[i], 0) / colours.length) as Rgb;
}

function clamp01(n: number): number {
  return Math.min(1, Math.max(0, n));
}
