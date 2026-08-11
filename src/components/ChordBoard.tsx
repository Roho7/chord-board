'use client';

import { useEffect, useState } from 'react';
import type { InstrumentName } from '@/audio/engine';
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
import { ChordPad } from './ChordPad';
import { ScaleSelector } from './ScaleSelector';
import { SynthPanel } from './SynthPanel';

type View = 'keys' | 'sound';

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
    <div className="flex min-h-0 w-full flex-1 flex-col gap-6">
      {/*
        Nine columns, each pad spanning two, with the lower row offset by one.
        That reproduces the keyboard's half-key stagger exactly and keeps both
        rows inside the same width — so the pads sit where the keys do.
      */}
      <div className="grid shrink-0 grid-cols-9 gap-2 sm:gap-3">
        {KEY_ROWS.map((row, rowIndex) =>
          row.map((code, column) => {
            const degree = degreeForCode(code);
            if (degree === undefined) return null;
            return (
              <div
                key={code}
                className="col-span-2"
                style={{ gridRow: rowIndex + 1, gridColumnStart: rowIndex + column * 2 + 1 }}
              >
                <ChordPad
                  chord={chordAt(scale, degree, colour)}
                  keyLabel={KEY_LABELS[degree]}
                  state={
                    pressedDegrees.has(degree)
                      ? 'pressed'
                      : heldDegrees.has(degree)
                        ? 'ringing'
                        : extraVoice && lastDegree === degree
                          ? 'pedal'
                          : 'idle'
                  }
                  onAttack={handleAttack}
                  onRelease={releaseDegree}
                />
              </div>
            );
          }),
        )}
      </div>

      {/* Tabs sit directly under the pads — the pads themselves never move. */}
      <div
        role="tablist"
        aria-label="Panel"
        className="flex shrink-0 gap-1 self-start rounded-lg bg-ink-raised p-1"
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
              view === id ? 'bg-ember text-ink' : 'text-bone-dim hover:text-bone',
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
      <div className="min-h-0 flex-1 overflow-hidden border-t border-ink-edge pt-6">
        <div
          className="flex h-full w-[200%] transition-transform duration-300 ease-out"
          style={{ transform: view === 'keys' ? 'translateX(0)' : 'translateX(-50%)' }}
        >
          <section
            id="panel-keys"
            role="tabpanel"
            // The off-screen panel is inert so tabbing can't land inside it.
            inert={view !== 'keys'}
            className="flex h-full w-1/2 shrink-0 flex-col justify-center items-center gap-6 overflow-x-hidden overflow-y-auto pr-4 "
          >
            <KeyLegend
              modifiers={modifiers}
              sustain={sustain}
              spread={spread}
              register={register}
              extraKeys={extraKeys}
            />

            <div className="flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between w-full">
              <ScaleSelector />
              <InstrumentToggle />
            </div>
          </section>

          <section
            id="panel-sound"
            role="tabpanel"
            inert={view !== 'sound'}
            className="h-full w-1/2 shrink-0 overflow-x-hidden overflow-y-auto pr-4"
          >
            <SynthPanel />
          </section>
        </div>
      </div>
    </div>
  );
}

/** Synth and organ are synthesised and playable at once; the rest stream samples. */
const INSTRUMENTS: Array<{ name: InstrumentName; label: string; title: string }> = [
  { name: 'synth', label: 'Synth', title: 'Sawtooth through a lowpass — shape it below' },
  { name: 'organ', label: 'Organ', title: 'Drawbar organ through a Leslie' },
  { name: 'piano', label: 'Piano', title: 'Sampled piano' },
  { name: 'guitar', label: 'Guitar', title: 'Sampled steel-string acoustic' },
];

function InstrumentToggle() {
  const instrument = useAppStore((s) => s.instrument);
  const samplesReady = useAppStore((s) => s.samplesReady);
  const setInstrument = useAppStore((s) => s.setInstrument);

  return (
    <div className="flex flex-col gap-2 lg:items-end">
      <div className="flex gap-2">
        {INSTRUMENTS.map(({ name, label, title }) => {
          const waiting = name in samplesReady && !samplesReady[name as keyof typeof samplesReady];
          return (
            <button
              key={name}
              type="button"
              aria-pressed={instrument === name}
              disabled={waiting}
              title={waiting ? 'Samples still loading' : title}
              onClick={() => setInstrument(name)}
              className={[
                'rounded-md px-4 py-2 font-mono text-sm font-bold uppercase transition-colors',
                instrument === name
                  ? 'bg-ember text-ink'
                  : 'bg-ink-raised text-bone-dim hover:text-bone',
                'disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:text-bone-dim',
              ].join(' ')}
            >
              {label}
            </button>
          );
        })}
      </div>
      <p className="font-mono text-xs text-bone-dim">
        {samplesReady.piano && samplesReady.guitar
          ? 'Samples loaded'
          : 'Samples load after the first note'}
      </p>
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

  // One key width and one row height. Everything else is a multiple of these.
  const UNIT = 2.5;
  const ROW = 2.35;

  return (
    <div
      className="relative shrink-0"
      style={{ width: `${LEGEND_WIDTH * UNIT}rem`, height: `${LEGEND_ROWS * ROW}rem` }}
    >
      {KEY_LEGEND.map(({ key, row, x, width, caption, control }) => {
        const on = control ? isOn(control) : false;
        return (
          <span
            key={`${row}-${key}`}
            title={caption}
            style={{
              left: `${x * UNIT}rem`,
              top: `${row * ROW}rem`,
              width: `${(width ?? 1) * UNIT - 0.25}rem`,
              height: `${ROW - 0.25}rem`,
            }}
            className={[
              'absolute flex flex-col items-center justify-center rounded border',
              'transition-colors duration-75',
              on
                ? 'border-ember bg-ember text-ink'
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
                  on ? 'text-ink/70' : 'text-bone-dim/60',
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
