'use client';

import type { ChordInfo } from '@/theory/chords';

/**
 * `ringing` is a whole chord still sounding under sustain with its key already
 * up; `pedal` is that chord trimmed to its bass note under the pedal.
 */
export type PadState = 'idle' | 'pressed' | 'ringing' | 'pedal';

interface ChordPadProps {
  chord: ChordInfo;
  keyLabel: string;
  state: PadState;
  onAttack: (degree: number) => void;
  onRelease: (degree: number) => void;
}

const SURFACE: Record<PadState, string> = {
  pressed: 'border-ember bg-ember text-ink shadow-[0_0_60px_-6px_var(--color-ember)] scale-[0.97]',
  // Sounding but not held: outlined rather than filled, so a glance tells you
  // what is ringing and what your fingers are actually on.
  ringing: 'border-ember bg-ink-raised text-ember shadow-[0_0_40px_-16px_var(--color-ember)]',
  // Only the bottom edge is lit — spatially, the low note is what's left.
  pedal:
    'border-ink-edge border-b-4 border-b-ember bg-ink-raised text-bone shadow-[0_10px_30px_-18px_var(--color-ember)]',
  idle: 'border-ink-edge bg-ink-raised text-bone hover:border-bone-dim',
};

const BADGE: Record<PadState, string> = {
  pressed: 'bg-ink/25 text-ink',
  ringing: 'bg-ink text-ember',
  pedal: 'bg-ink text-bone-dim',
  idle: 'bg-ink text-bone-dim',
};

const NUMERAL: Record<PadState, string> = {
  pressed: 'text-ink/70',
  ringing: 'text-ember/70',
  pedal: 'text-bone-dim',
  idle: 'text-bone-dim',
};

export function ChordPad({ chord, keyLabel, state, onAttack, onRelease }: ChordPadProps) {
  const lit = state !== 'idle';

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
      className={[
        // Fixed height rather than an aspect ratio: four-across pads are wide, and
        // a portrait ratio would make each row taller than the board it sits in.
        'group relative flex h-24 w-full flex-col items-center justify-center sm:h-28 lg:h-32',
        'rounded-xl border-2 px-2 transition-[transform,background-color,border-color,box-shadow]',
        'duration-75 ease-out outline-none',
        'focus-visible:ring-4 focus-visible:ring-ember-soft/70',
        SURFACE[state],
      ].join(' ')}
    >
      <span
        className={[
          'absolute top-2 left-2 flex h-7 w-7 items-center justify-center rounded-md',
          'font-mono text-sm font-bold',
          BADGE[state],
        ].join(' ')}
      >
        {keyLabel}
      </span>

      <span className="text-[clamp(1.75rem,4.5vw,3.25rem)] leading-none font-extrabold tracking-tight tabular-nums">
        {chord.symbol}
      </span>

      <span
        className={[
          'mt-2 font-mono text-base tracking-[0.2em] uppercase',
          NUMERAL[state],
        ].join(' ')}
      >
        {chord.numeral}
      </span>
    </button>
  );
}
