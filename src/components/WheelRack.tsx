'use client';

import '@ncdai/react-wheel-picker/style.css';
import {
  WheelPicker,
  WheelPickerWrapper,
  type WheelPickerOption,
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
    <WheelHost className="flex shrink-0 gap-3 sm:gap-6">
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
}: {
  rows?: number;
  className?: string;
  children: ReactNode;
}) {
  return (
    <div
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
    <WheelPickerWrapper>
      <WheelPicker
        options={options}
        value={root}
        onValueChange={setRoot}
        infinite
        optionItemHeight={ITEM_HEIGHT}
        visibleCount={VISIBLE}
        classNames={CLASSES}
      />
    </WheelPickerWrapper>
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
    <WheelPickerWrapper>
      <WheelPicker
        options={options}
        value={mode}
        onValueChange={setMode}
        optionItemHeight={ITEM_HEIGHT}
        visibleCount={VISIBLE}
        classNames={CLASSES}
      />
    </WheelPickerWrapper>
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
    <WheelPickerWrapper>
      <WheelPicker
        options={options}
        value={instrument}
        onValueChange={setInstrument}
        optionItemHeight={ITEM_HEIGHT}
        visibleCount={VISIBLE}
        classNames={CLASSES}
      />
    </WheelPickerWrapper>
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
