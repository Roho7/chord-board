'use client';

import type { ChordInfo } from '@/theory/chords';
import { PadGradient } from './PadGradient';
import type { PadTint } from './padTint';

/**
 * `ringing` is a whole chord still sounding under sustain with its key already
 * up; `pedal` is that chord trimmed to its bass note under the pedal.
 */
export type PadState = 'idle' | 'pressed' | 'ringing' | 'pedal';

interface ChordPadProps {
  chord: ChordInfo;
  /** Gradient colours from the held modifiers — see `padTint`. */
  tint: PadTint;
  keyLabel: string;
  state: PadState;
  onAttack: (degree: number) => void;
  onRelease: (degree: number) => void;
}

const SURFACE: Record<PadState, string> = {
  pressed: 'scale-[0.97] text-white shadow-[0_0_56px_-10px_var(--pad-b)]',
  // Sounding but not held: the colour runs round the rim and the middle stays
  // dark, so a glance tells you what is ringing and what your fingers are on.
  ringing: 'text-accent-soft shadow-[0_0_36px_-16px_var(--pad-b)]',
  // Only the bass is left, so only the warm pool at the bottom is lit.
  pedal: 'border border-white/[0.06] border-t-white/15 bg-ink-raised/60 text-bone backdrop-blur-md',
  idle: 'border border-white/[0.06] border-t-white/15 bg-ink-raised/60 text-bone backdrop-blur-md hover:border-white/15',
};

const BADGE: Record<PadState, string> = {
  pressed: 'bg-white/15 text-white backdrop-blur-sm',
  ringing: 'bg-ink text-accent-soft',
  pedal: 'bg-ink/70 text-bone-dim',
  idle: 'bg-ink/70 text-bone-dim',
};

const NUMERAL: Record<PadState, string> = {
  pressed: 'text-white/85 drop-shadow-[0_1px_4px_rgb(16_6_50/0.6)]',
  ringing: 'text-accent-soft/70',
  pedal: 'text-bone-dim',
  idle: 'text-bone-dim',
};

/** The drift slows to half speed once the key is up and the chord just rings. */
const SPEED: Partial<Record<PadState, number>> = { pressed: 0.9, ringing: 0.45 };

export function ChordPad({ chord, tint, keyLabel, state, onAttack, onRelease }: ChordPadProps) {
  const lit = state !== 'idle';
  const flowing = state === 'pressed' || state === 'ringing';

  return (
    <button
      type="button"
      aria-pressed={lit}
      aria-label={`${chord.symbol}, ${chord.numeral}, key ${keyLabel}`}
      onPointerDown={(event) => {
        // Keep the pointer's events coming to this pad even if it leaves.
        event.currentTarget.setPointerCapture(event.pointerId);
        onAttack(chord.degree);
      }}
      onPointerUp={() => onRelease(chord.degree)}
      onPointerCancel={() => onRelease(chord.degree)}
      onContextMenu={(event) => event.preventDefault()}
      style={tint.vars}
      className={[
        // Fixed height rather than an aspect ratio: four-across pads are wide, and
        // a portrait ratio would make each row taller than the board it sits in.
        'pad-tint group relative isolate flex h-24 w-full flex-col items-center justify-center sm:h-28 lg:h-32',
        'overflow-hidden rounded-xl px-2 transition-[transform,background-color,border-color,box-shadow]',
        'duration-75 ease-out outline-none',
        'focus-visible:ring-4 focus-visible:ring-accent-soft/70',
        SURFACE[state],
      ].join(' ')}
    >
      <PadGradient tint={tint.mesh} speed={SPEED[state] ?? 0} visible={flowing} />
      {state === 'ringing' && (
        <span
          aria-hidden
          className="absolute inset-[3px] rounded-[calc(0.75rem-3px)] bg-ink-raised/95 shadow-[inset_0_0_28px_-8px_var(--pad-b)]"
        />
      )}
      {lit && <span aria-hidden className="pad-register" />}
      {/* Remounts on every press, so every attack gets its own flash. */}
      {state === 'pressed' && <span aria-hidden className="pad-bloom" />}

      <span
        className={[
          'absolute top-2 left-2 z-10 flex h-7 w-7 items-center justify-center rounded-md',
          'font-mono text-sm font-bold',
          BADGE[state],
        ].join(' ')}
      >
        {keyLabel}
      </span>

      <span
        className={[
          'relative z-10 text-[clamp(1.75rem,4.5vw,3.25rem)] leading-none font-extrabold tracking-tight tabular-nums',
          state === 'pressed' ? 'glass-glyph' : '',
        ].join(' ')}
      >
        {chord.symbol}
      </span>

      <span
        className={[
          'relative z-10 mt-2 font-mono text-base tracking-[0.2em] uppercase',
          NUMERAL[state],
        ].join(' ')}
      >
        {chord.numeral}
      </span>
    </button>
  );
}
