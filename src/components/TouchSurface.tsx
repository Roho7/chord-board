'use client';

import { type PointerEvent, useRef, useState } from 'react';
import { useAppStore } from '@/state/store';
import type { ChordModifiers, ExtraVoice } from '@/theory/chords';
import { ACCENT_COLOUR, BASS_COLOUR, type ControlColour, MODIFIER_COLOURS } from './controlColours';

/**
 * The phone's left hand: a modifier touchpad plus a column of round buttons,
 * standing in for the control keys a phone doesn't have.
 */
export function TouchSurface() {
  return (
    <div className="flex h-full min-h-0 gap-2">
      <ModifierPad />
      <div className="grid shrink-0 grid-cols-2 content-between gap-x-2 gap-y-1.5">
        {BUTTONS.map((button) => (
          <HoldButton key={button.label} button={button} />
        ))}
        <LatchButton label="Sust" kind="sustain" />
        <LatchButton label="Sprd" kind="spread" />
      </div>
    </div>
  );
}

type Zone = { minor: boolean; seventh: boolean };

/** The modifiers the pad owns — the only ones it ever sets or clears. */
type PadModifiers = Pick<ChordModifiers, 'minor' | 'seventh' | 'dominant' | 'suspended'>;

const NONE: PadModifiers = { minor: false, seventh: false, dominant: false, suspended: false };

/**
 * Up-right is the scale's own 7th — maj7 on I and IV, a dominant on V. Down-
 * right is a true m7: minor with a flat 7th. Minor plus the scale's 7th would
 * give mMaj7 on I and IV, which is not what "m7" promises.
 */
function modifiersFor(zone: Zone): PadModifiers {
  return {
    minor: zone.minor,
    seventh: zone.seventh && !zone.minor,
    dominant: zone.seventh && zone.minor,
    suspended: !zone.seventh && !zone.minor,
  };
}

/** Sus4 up-left, 7th up-right, minor down-left, m7 down-right. */
const ZONES: Array<{ zone: Zone; label: string; colour: string }> = [
  { zone: { minor: false, seventh: false }, label: 'Sus4', colour: 'var(--color-mod-suspended)' },
  { zone: { minor: false, seventh: true }, label: '7th', colour: 'var(--color-mod-seventh)' },
  { zone: { minor: true, seventh: false }, label: 'Minor', colour: 'var(--color-mod-minor)' },
  {
    zone: { minor: true, seventh: true },
    label: 'm7',
    colour: 'linear-gradient(135deg, var(--color-mod-minor), var(--color-mod-dominant))',
  },
];

/**
 * Two axes, played by feel: right adds the 7th, down makes it minor. Up-left
 * is neither, so it takes sus4. Sliding across the middle changes the chord
 * live — the sounding pads retune and their colour morphs with it — and
 * lifting the finger lets it go back to plain.
 */
function ModifierPad() {
  const setModifiers = useAppStore((s) => s.setModifiers);
  const unlockAudio = useAppStore((s) => s.unlockAudio);
  const finger = useRef<number | null>(null);
  // What the pad itself has switched on, so letting go clears only that — a
  // Dom7 held on its own button survives the pad being released.
  const owned = useRef<PadModifiers>(NONE);
  const [touch, setTouch] = useState<{ x: number; y: number; zone: Zone } | null>(null);

  function read(event: PointerEvent<HTMLDivElement>) {
    const box = event.currentTarget.getBoundingClientRect();
    const x = clamp01((event.clientX - box.left) / box.width);
    const y = clamp01((event.clientY - box.top) / box.height);
    return { x, y, zone: { minor: y > 0.5, seventh: x > 0.5 } };
  }

  /**
   * Switch off what the pad had on, then on what the new zone wants. A
   * modifier that was already on — Dom7 held on its own button — is left
   * alone and never claimed, so lifting off the pad can't cancel it.
   */
  function apply(next: PadModifiers) {
    const current = useAppStore.getState().modifiers;
    const patch: Partial<ChordModifiers> = {};
    const claimed = { ...NONE };
    for (const key of Object.keys(next) as Array<keyof PadModifiers>) {
      if (next[key]) {
        if (owned.current[key]) claimed[key] = true;
        else if (!current[key]) {
          patch[key] = true;
          claimed[key] = true;
        }
      } else if (owned.current[key]) {
        patch[key] = false;
      }
    }
    owned.current = claimed;
    setModifiers(patch);
  }

  function down(event: PointerEvent<HTMLDivElement>) {
    // One finger owns the pad; a second touch landing on it is ignored.
    if (finger.current !== null) return;
    finger.current = event.pointerId;
    event.currentTarget.setPointerCapture(event.pointerId);
    unlockAudio();
    const next = read(event);
    setTouch(next);
    apply(modifiersFor(next.zone));
  }

  function move(event: PointerEvent<HTMLDivElement>) {
    if (event.pointerId !== finger.current) return;
    const next = read(event);
    // Only touch the store when the zone actually changes: every setModifiers
    // retunes whatever is sounding.
    if (touch && sameZone(touch.zone, next.zone)) setTouch({ ...next, zone: touch.zone });
    else {
      setTouch(next);
      apply(modifiersFor(next.zone));
    }
  }

  function up(event: PointerEvent<HTMLDivElement>) {
    if (event.pointerId !== finger.current) return;
    finger.current = null;
    setTouch(null);
    apply(NONE);
  }

  return (
    <div
      role="application"
      aria-label="Chord colour pad: up-left sus4, up-right seventh, down-left minor, down-right minor seventh"
      onPointerDown={down}
      onPointerMove={move}
      onPointerUp={up}
      onPointerCancel={up}
      onContextMenu={(event) => event.preventDefault()}
      className="relative grid min-h-0 flex-1 touch-none grid-cols-2 grid-rows-2 gap-1 overflow-hidden rounded-xl"
    >
      {ZONES.map(({ zone, label, colour }) => {
        const lit = touch !== null && sameZone(touch.zone, zone);
        return (
          <div
            key={label}
            className={[
              'flex items-center justify-center rounded-lg font-mono text-[0.65rem] font-bold tracking-[0.15em] uppercase',
              'transition-[background,color] duration-150',
              lit ? 'text-white' : 'bg-ink-raised/60 text-bone-dim/70',
            ].join(' ')}
            style={lit ? { background: colour } : undefined}
          >
            {label}
          </div>
        );
      })}

      {/* Where the finger is — the zones are big, but this shows how close the edge is. */}
      {touch && (
        <span
          aria-hidden
          className="pointer-events-none absolute size-9 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white/80 bg-white/15 shadow-[0_0_18px_rgb(255_255_255/0.4)]"
          style={{ left: `${touch.x * 100}%`, top: `${touch.y * 100}%` }}
        />
      )}
    </div>
  );
}

function sameZone(a: Zone, b: Zone): boolean {
  return a.minor === b.minor && a.seventh === b.seventh;
}

function clamp01(n: number): number {
  return Math.min(1, Math.max(0, n));
}

type Button =
  | { kind: 'modifier'; name: keyof ChordModifiers; label: string }
  | { kind: 'extra'; voice: ExtraVoice; label: string };

/** Everything the touchpad doesn't cover, held like the keys they stand for. */
const BUTTONS: Button[] = [
  { kind: 'modifier', name: 'dominant', label: 'Dom7' },
  { kind: 'modifier', name: 'ninth', label: 'Add9' },
  { kind: 'extra', voice: 'bassRoot', label: 'Bass' },
  { kind: 'extra', voice: 'bassFifth', label: 'B5' },
  { kind: 'modifier', name: 'octaveUp', label: '8va' },
  { kind: 'modifier', name: 'octaveDown', label: '8vb' },
  { kind: 'extra', voice: 'chordOctave', label: 'Oct' },
  { kind: 'modifier', name: 'inverted', label: 'Inv' },
];

const ROUND =
  'flex size-11 touch-none items-center justify-center rounded-full font-mono text-[0.6rem] font-bold uppercase transition-colors duration-75';

/**
 * Every button tracks its own finger, so a thumb can hold Bass while the
 * other hand plays the pads.
 */
function HoldButton({ button }: { button: Button }) {
  const on = useAppStore((s) =>
    button.kind === 'modifier' ? s.modifiers[button.name] : s.extraKeys.has(button.voice),
  );
  const setModifiers = useAppStore((s) => s.setModifiers);
  const pressExtra = useAppStore((s) => s.pressExtra);
  const releaseExtra = useAppStore((s) => s.releaseExtra);
  const unlockAudio = useAppStore((s) => s.unlockAudio);

  const colour: ControlColour =
    button.kind === 'modifier'
      ? (MODIFIER_COLOURS[button.name] ?? ACCENT_COLOUR)
      : button.voice === 'chordOctave'
        ? ACCENT_COLOUR
        : BASS_COLOUR;

  function press(event: PointerEvent<HTMLButtonElement>) {
    // Keep this finger's lift coming here even if it slides off the button.
    event.currentTarget.setPointerCapture(event.pointerId);
    unlockAudio();
    if (button.kind === 'modifier') setModifiers({ [button.name]: true });
    else pressExtra(button.voice);
  }

  function lift() {
    if (button.kind === 'modifier') setModifiers({ [button.name]: false });
    else releaseExtra(button.voice);
  }

  return (
    <button
      type="button"
      aria-pressed={on}
      onPointerDown={press}
      onPointerUp={lift}
      onPointerCancel={lift}
      onContextMenu={(event) => event.preventDefault()}
      style={on ? { backgroundColor: colour.colour, boxShadow: `0 0 14px -2px ${colour.colour}` } : undefined}
      className={[ROUND, on ? colour.text : 'bg-ink-raised/70 text-bone-dim'].join(' ')}
    >
      {button.label}
    </button>
  );
}

/** Sustain and spread latch, as they do on the keyboard: tap on, tap off. */
function LatchButton({ label, kind }: { label: string; kind: 'sustain' | 'spread' }) {
  const on = useAppStore((s) => s[kind]);
  const setSustain = useAppStore((s) => s.setSustain);
  const toggleSpread = useAppStore((s) => s.toggleSpread);
  const colour = kind === 'sustain' ? BASS_COLOUR : ACCENT_COLOUR;

  return (
    <button
      type="button"
      aria-pressed={on}
      onClick={() => (kind === 'sustain' ? setSustain(!on) : toggleSpread())}
      style={on ? { borderColor: colour.colour, color: colour.colour, boxShadow: `0 0 12px -4px ${colour.colour}` } : undefined}
      className={[ROUND, 'border border-white/10 text-bone-dim'].join(' ')}
    >
      {label}
    </button>
  );
}
