'use client';

import { type CSSProperties, useEffect, useState } from 'react';
import { prefetchTone } from '@/audio/rack';
import {
  degreeForCode,
  KEY_LABELS,
  KEY_LEGEND,
  KEY_ROWS,
  LEGEND_ROWS,
  LEGEND_WIDTH,
  type LegendControl,
} from '@/input/keymap';
import { useKeyboard } from '@/input/useKeyboard';
import { useAppStore } from '@/state/store';
import { chordAt, chordColour, type ChordModifiers, type ExtraVoice } from '@/theory/chords';
import { makeScale } from '@/theory/scales';
import { ChordPad, type PadState } from './ChordPad';
import { ACCENT_COLOUR, BASS_COLOUR, type ControlColour, MODIFIER_COLOURS } from './controlColours';
import { padTint } from './padTint';
import { SoundPanel } from './SoundPanel';
import { RotateHint } from './RotateHint';
import { TouchSurface } from './TouchSurface';
import { WheelRack } from './WheelRack';

type View = 'keys' | 'sound';

const NO_EXTRAS: ReadonlySet<ExtraVoice> = new Set();

const VIEWS: ReadonlyArray<{ id: View; label: string }> = [
  { id: 'keys', label: 'Keys' },
  { id: 'sound', label: 'Sound' },
];

export function ChordBoard() {
  useKeyboard();

  const root = useAppStore((s) => s.root);
  const mode = useAppStore((s) => s.mode);
  const heldDegrees = useAppStore((s) => s.heldDegrees);
  const pressedDegrees = useAppStore((s) => s.pressedDegrees);
  const lastDegree = useAppStore((s) => s.lastDegree);
  const extraVoice = useAppStore((s) => s.extraVoice);
  const extraKeys = useAppStore((s) => s.extraKeys);
  const sustain = useAppStore((s) => s.sustain);
  const spread = useAppStore((s) => s.spread);
  const register = useAppStore((s) => s.register);
  const attackDegree = useAppStore((s) => s.attackDegree);
  const releaseDegree = useAppStore((s) => s.releaseDegree);
  const unlockAudio = useAppStore((s) => s.unlockAudio);

  const modifiers = useAppStore((s) => s.modifiers);
  const scale = makeScale(root, mode);
  const colour = chordColour(modifiers);

  const [view, setView] = useState<View>('keys');

  useEffect(prefetchTone, []);

  function handleAttack(degree: number) {
    unlockAudio();
    attackDegree(degree);
  }

  return (
    <div className="flex min-h-0 w-full flex-1 flex-col gap-6 phone:gap-3 phone-landscape:flex-row">
      <RotateHint />

      {/*
        With a keyboard to mirror: nine columns, each pad spanning two and the
        lower row offset by one — the keyboard's half-key stagger, so the pads
        sit where the keys do. Phones get a launchpad instead, in degree order
        and filling whatever height is left: 4×2 sideways (I–IV over V–I′),
        2×4 upright.
      */}
      <div className="grid shrink-0 grid-cols-9 gap-2 sm:gap-3 phone:min-h-0 phone:flex-1 phone:gap-1.5 phone-landscape:grid-cols-4 phone-landscape:grid-rows-2 phone-portrait:grid-cols-2 phone-portrait:grid-rows-4">
        {KEY_ROWS.map((row, rowIndex) =>
          row.map((code, column) => {
            const degree = degreeForCode(code);
            if (degree === undefined) return null;
            const state: PadState = pressedDegrees.has(degree)
              ? 'pressed'
              : heldDegrees.has(degree)
                ? 'ringing'
                : extraVoice && lastDegree === degree
                  ? 'pedal'
                  : 'idle';
            // Every pad carries the current tint even while idle, so a press
            // with a modifier already down starts in the right colour instead
            // of morphing into it. The extra voices belong to the last chord.
            const owner = lastDegree === degree;
            const tint = padTint({
              modifiers,
              extras: owner ? extraKeys : NO_EXTRAS,
              register,
              spread,
              pedal: state === 'pedal',
            });
            return (
              <div
                key={code}
                className="[grid-column:var(--key-col)/span_2] [grid-row:var(--key-row)] phone-landscape:[grid-column:var(--wide-col)] phone-landscape:[grid-row:var(--wide-row)] phone-portrait:[grid-column:var(--tall-col)] phone-portrait:[grid-row:var(--tall-row)]"
                style={
                  {
                    '--key-row': rowIndex + 1,
                    '--key-col': rowIndex + column * 2 + 1,
                    '--wide-row': Math.floor(degree / 4) + 1,
                    '--wide-col': (degree % 4) + 1,
                    '--tall-row': Math.floor(degree / 2) + 1,
                    '--tall-col': (degree % 2) + 1,
                  } as CSSProperties
                }
              >
                <ChordPad
                  chord={chordAt(scale, degree, colour)}
                  tint={tint}
                  keyLabel={KEY_LABELS[degree]}
                  state={state}
                  onAttack={handleAttack}
                  onRelease={releaseDegree}
                />
              </div>
            );
          }),
        )}
      </div>

      {/*
        Touch has no control keys: the modifier touchpad and its buttons take
        their place. Sideways it sits to the left of the pads, for the hand
        that isn't playing; upright and on tablets it sits underneath.
      */}
      <div className="hidden h-48 shrink-0 pointer-coarse:block phone:block phone-portrait:h-64 phone-landscape:order-first phone-landscape:h-auto phone-landscape:w-[42%]">
        <TouchSurface />
      </div>

      {/* Tabs sit directly under the pads — the pads themselves never move. */}
      <div
        role="tablist"
        aria-label="Panel"
        className="flex shrink-0 gap-1 self-start rounded-lg bg-ink-raised p-1 phone:hidden"
      >
        {VIEWS.map(({ id, label }) => (
          <button
            key={id}
            type="button"
            role="tab"
            aria-selected={view === id}
            aria-controls={`panel-${id}`}
            onClick={() => setView(id)}
            className={[
              'rounded-md px-5 py-1.5 font-mono text-sm font-bold tracking-[0.15em] uppercase',
              'transition-colors',
              view === id ? 'bg-accent text-white' : 'text-bone-dim hover:text-bone',
            ].join(' ')}
          >
            {label}
          </button>
        ))}
      </div>

      {/*
        Both panels stay mounted and the track slides between them: the keyboard
        listener lives up here, so you can keep playing while the synth is open.
      */}
      {/* On phones the wheels live in header drawers and there is no legend to show. */}
      <div className="min-h-0 flex-1 overflow-hidden border-t border-ink-edge pt-6 phone:hidden">
        <div
          className="flex h-full w-[200%] transition-transform duration-300 ease-out"
          style={{ transform: view === 'keys' ? 'translateX(0)' : 'translateX(-50%)' }}
        >
          <section
            id="panel-keys"
            role="tabpanel"
            // The off-screen panel is inert so tabbing can't land inside it.
            inert={view !== 'keys'}
            // Safe centring: when the panel is shorter than its content, plain
            // centring pushes the top out of reach of the scrollbar.
            className="flex h-full w-1/2 shrink-0 flex-col items-center justify-center-safe gap-8 overflow-x-hidden overflow-y-auto pr-4 lg:flex-row lg:gap-12"
          >
            <KeyLegend
              modifiers={modifiers}
              sustain={sustain}
              spread={spread}
              register={register}
              extraKeys={extraKeys}
            />

            <WheelRack />
          </section>

          <section
            id="panel-sound"
            role="tabpanel"
            inert={view !== 'sound'}
            className="h-full w-1/2 shrink-0 overflow-x-hidden overflow-y-auto pr-4"
          >
            <SoundPanel />
          </section>
        </div>
      </div>
    </div>
  );
}

/**
 * The control keys drawn where they actually sit, so the legend is a picture of
 * the keyboard rather than a list. Deliberately small and dim: the pads are what
 * you read while playing, and this only has to be glanceable.
 */
function KeyLegend({
  modifiers,
  sustain,
  spread,
  register,
  extraKeys,
}: {
  modifiers: ChordModifiers;
  sustain: boolean;
  spread: boolean;
  register: number;
  extraKeys: Set<ExtraVoice>;
}) {
  function isOn(control: LegendControl): boolean {
    switch (control.kind) {
      case 'modifier':
        return modifiers[control.name];
      case 'extra':
        return extraKeys.has(control.voice);
      case 'register':
        return Math.sign(register) === control.direction;
      case 'spread':
        return spread;
      case 'sustain':
        return sustain;
    }
  }

  /** Lit legend keys wear the colour they put on the pads, which teaches the mapping. */
  function litColour(control: LegendControl): ControlColour {
    if (control.kind === 'modifier') return MODIFIER_COLOURS[control.name] ?? ACCENT_COLOUR;
    if (control.kind === 'sustain' || (control.kind === 'extra' && control.voice !== 'chordOctave')) {
      return BASS_COLOUR;
    }
    return ACCENT_COLOUR;
  }

  // One key width and one row height. Everything else is a multiple of these.
  const UNIT = 2.5;
  const ROW = 2.35;

  return (
    <div
      // A picture of the keyboard is noise on a phone — there is no keyboard.
      className="relative shrink-0 phone:hidden pointer-coarse:hidden"
      style={{ width: `${LEGEND_WIDTH * UNIT}rem`, height: `${LEGEND_ROWS * ROW}rem` }}
    >
      {KEY_LEGEND.map(({ key, row, x, width, caption, control }) => {
        const on = control ? isOn(control) : false;
        const lit = on && control ? litColour(control) : null;
        return (
          <span
            key={`${row}-${key}`}
            title={caption}
            style={{
              ...(lit && {
                backgroundColor: lit.colour,
                borderColor: lit.colour,
                boxShadow: `0 0 14px -2px ${lit.colour}`,
              }),
              left: `${x * UNIT}rem`,
              top: `${row * ROW}rem`,
              width: `${(width ?? 1) * UNIT - 0.25}rem`,
              height: `${ROW - 0.25}rem`,
            }}
            className={[
              'absolute flex flex-col items-center justify-center rounded border',
              'transition-colors duration-75',
              lit
                ? lit.text
                : control
                  ? 'border-ink-edge bg-ink-raised text-bone-dim'
                  : // Pad keys: shape only, so they recede.
                  'border-ink-edge/40 text-bone-dim/30',
            ].join(' ')}
          >
            <span className="font-mono text-[0.6rem] leading-none font-bold">{key}</span>
            {caption && (
              <span
                className={[
                  'mt-0.5 font-mono text-[0.5rem] leading-none',
                  lit ? 'opacity-75' : 'text-bone-dim/60',
                ].join(' ')}
              >
                {caption}
              </span>
            )}
          </span>
        );
      })}

      <span
        style={{ left: `${4.25 * UNIT}rem`, top: `${0.4 * ROW}rem` }}
        className="absolute font-mono text-[0.55rem] tracking-[0.2em] text-bone-dim/60 uppercase"
      >
        Octave {register > 0 ? `+${register}` : register}
      </span>
    </div>
  );
}
