'use client';

import '@ncdai/react-wheel-picker/style.css';
import {
  WheelPicker,
  WheelPickerWrapper,
  type WheelPickerOption,
  type WheelPickerValue,
} from '@ncdai/react-wheel-picker';
import type { CSSProperties, KeyboardEvent, ReactNode } from 'react';
import type { InstrumentName } from '@/audio/engine';
import { useAppStore } from '@/state/store';
import { noteName, PITCH_CLASSES, type PitchClass } from '@/theory/notes';
import { accidentalForKey, MODE_LABELS, MODE_NAMES, type ModeName } from '@/theory/scales';

/** Synth and strings are synthesised and playable at once; the rest stream samples. */
export const INSTRUMENTS: Array<{ name: InstrumentName; label: string }> = [
  { name: 'synth', label: 'Synth' },
  { name: 'strings', label: 'Strings' },
  { name: 'piano', label: 'Piano' },
  { name: 'guitar', label: 'Guitar' },
];

const ITEM_HEIGHT = 30;
/** Items around the whole drum. Fewer means a tighter curve and a shorter rack. */
const VISIBLE = 16;

/**
 * Key, mode and instrument as three drums side by side, like the rotary
 * selectors on a hardware unit. Scroll or drag to turn them. On phones each
 * drum lives in its own drawer instead (see `SelectorDrawers`).
 */
export function WheelRack() {
  return (
    <WheelHost className="flex shrink-0 gap-3 sm:gap-6" data-tutorial="wheels">
      <Drum label="Key" width="w-14 sm:w-20">
        <KeyWheel />
      </Drum>
      <Drum label="Mode" width="w-36 sm:w-44">
        <ModeWheel />
      </Drum>
      <Drum label="Sound" width="w-24 sm:w-32">
        <SoundWheel />
      </Drum>
    </WheelHost>
  );
}

/**
 * Whatever holds drums: sets their row height and how many rows show, and
 * keeps them from stealing the keyboard.
 */
export function WheelHost({
  rows = 3,
  className = '',
  children,
  'data-tutorial': tutorial,
}: {
  rows?: number;
  className?: string;
  children: ReactNode;
  'data-tutorial'?: string;
}) {
  return (
    <div
      data-tutorial={tutorial}
      className={`wheel-rack ${className}`}
      style={{ '--wheel-item': `${ITEM_HEIGHT}px`, '--wheel-rows': rows } as CSSProperties}
      // Clicking a drum must not focus it: a focused drum would read the pad
      // keys as type-ahead and jump to whatever letter you just played.
      onMouseDown={(event) => event.preventDefault()}
      onKeyDownCapture={forwardPlayingKeys}
    >
      {children}
    </div>
  );
}

export function KeyWheel() {
  const root = useAppStore((s) => s.root);
  const mode = useAppStore((s) => s.mode);
  const setRoot = useAppStore((s) => s.setRoot);

  // Spell each key the way it is actually written in the current mode.
  const options: WheelPickerOption<PitchClass>[] = PITCH_CLASSES.map((pc) => ({
    value: pc,
    label: noteName(pc, accidentalForKey(pc, mode)),
  }));

  return (
    <Stepper onStep={(dir) => setRoot(stepValue(options, root, dir, true))}>
      <WheelPicker
        options={options}
        value={root}
        onValueChange={setRoot}
        infinite
        optionItemHeight={ITEM_HEIGHT}
        visibleCount={VISIBLE}
        classNames={CLASSES}
      />
    </Stepper>
  );
}

export function ModeWheel() {
  const mode = useAppStore((s) => s.mode);
  const setMode = useAppStore((s) => s.setMode);

  const options: WheelPickerOption<ModeName>[] = MODE_NAMES.map((name) => ({
    value: name,
    label: MODE_LABELS[name],
  }));

  return (
    <Stepper onStep={(dir) => setMode(stepValue(options, mode, dir, false))}>
      <WheelPicker
        options={options}
        value={mode}
        onValueChange={setMode}
        optionItemHeight={ITEM_HEIGHT}
        visibleCount={VISIBLE}
        classNames={CLASSES}
      />
    </Stepper>
  );
}

export function SoundWheel() {
  const instrument = useAppStore((s) => s.instrument);
  const samplesReady = useAppStore((s) => s.samplesReady);
  const setInstrument = useAppStore((s) => s.setInstrument);

  const options: WheelPickerOption<InstrumentName>[] = INSTRUMENTS.map(({ name, label }) => {
    const waiting = name in samplesReady && !samplesReady[name as keyof typeof samplesReady];
    return { value: name, label: waiting ? `${label} …` : label, textValue: label, disabled: waiting };
  });

  return (
    <Stepper onStep={(dir) => setInstrument(stepValue(options, instrument, dir, false))}>
      <WheelPicker
        options={options}
        value={instrument}
        onValueChange={setInstrument}
        optionItemHeight={ITEM_HEIGHT}
        visibleCount={VISIBLE}
        classNames={CLASSES}
      />
    </Stepper>
  );
}

/**
 * The option one step from `current`, skipping any that can't be chosen.
 * `wrap` is for drums that go all the way round; the rest stop at their ends.
 */
function stepValue<T extends WheelPickerValue>(
  options: WheelPickerOption<T>[],
  current: T,
  dir: -1 | 1,
  wrap: boolean,
): T {
  const from = options.findIndex((option) => option.value === current);
  for (let i = from + dir; ; i += dir) {
    const index = wrap ? (i + options.length) % options.length : i;
    const option = options[index];
    if (!option || index === from) return current;
    if (!option.disabled) return option.value;
  }
}

/** A drum with chevrons that appear on hover and nudge it one row. */
function Stepper({ onStep, children }: { onStep: (dir: -1 | 1) => void; children: ReactNode }) {
  return (
    <div className="group relative">
      <WheelPickerWrapper>{children}</WheelPickerWrapper>
      <Chevron dir={-1} label="Previous" onStep={onStep} />
      <Chevron dir={1} label="Next" onStep={onStep} />
    </div>
  );
}

function Chevron({
  dir,
  label,
  onStep,
}: {
  dir: -1 | 1;
  label: string;
  onStep: (dir: -1 | 1) => void;
}) {
  return (
    <button
      type="button"
      tabIndex={-1}
      aria-label={label}
      onClick={() => onStep(dir)}
      className={[
        'absolute left-1/2 z-10 flex h-5 w-8 -translate-x-1/2 items-center justify-center rounded',
        'text-bone-dim opacity-0 transition-opacity hover:text-bone group-hover:opacity-100',
        'pointer-coarse:hidden',
        dir === -1 ? 'top-0' : 'bottom-0',
      ].join(' ')}
    >
      <svg viewBox="0 0 12 8" className="h-2 w-3" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
        <path d={dir === -1 ? 'M1 6.5 6 1.5l5 5' : 'M1 1.5l5 5 5-5'} />
      </svg>
    </button>
  );
}

const CLASSES = {
  optionItem: 'font-mono text-sm font-bold text-bone-dim/80 uppercase',
  // No band — the selection is just lit. It draws exactly over the drum's own
  // centre row (see `.wheel-rack` in globals.css), so nothing ghosts.
  highlightWrapper: 'font-mono text-sm font-bold text-bone uppercase',
};

function Drum({ label, width, children }: { label: string; width: string; children: ReactNode }) {
  return (
    <div className={`flex flex-col gap-1 ${width}`}>
      <span className="text-center font-mono text-[0.6rem] tracking-[0.3em] text-bone-dim/60 uppercase">
        {label}
      </span>
      {children}
    </div>
  );
}

/** Keys a drum is allowed to keep: the ones that turn it. */
const DRUM_KEYS = new Set(['ArrowUp', 'ArrowDown', 'Home', 'End', 'PageUp', 'PageDown', 'Tab']);

/**
 * A drum reached with Tab still holds focus, so anything that isn't turning it
 * is let go and handed to the instrument — the chord plays instead of the drum
 * jumping to that letter.
 */
function forwardPlayingKeys(event: KeyboardEvent<HTMLDivElement>) {
  if (DRUM_KEYS.has(event.key)) return;
  event.stopPropagation();
  (document.activeElement as HTMLElement | null)?.blur();
  const native = event.nativeEvent;
  window.dispatchEvent(
    new globalThis.KeyboardEvent(native.type, {
      key: native.key,
      code: native.code,
      repeat: native.repeat,
      shiftKey: native.shiftKey,
      ctrlKey: native.ctrlKey,
      altKey: native.altKey,
      metaKey: native.metaKey,
      modifierCapsLock: native.getModifierState('CapsLock'),
    }),
  );
}
