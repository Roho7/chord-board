'use client';

import { useAppStore } from '@/state/store';
import { noteName, PITCH_CLASSES } from '@/theory/notes';
import { accidentalForKey, MODE_LABELS, MODE_NAMES, type ModeName } from '@/theory/scales';

const chip = 'rounded-md px-3 py-2 font-mono text-sm font-bold uppercase transition-colors';
const chipOn = 'bg-ember text-ink';
const chipOff = 'bg-ink-raised text-bone-dim hover:bg-ink-edge hover:text-bone';

export function ScaleSelector() {
  const root = useAppStore((s) => s.root);
  const mode = useAppStore((s) => s.mode);
  const setRoot = useAppStore((s) => s.setRoot);
  const setMode = useAppStore((s) => s.setMode);

  return (
    <div className="flex flex-col gap-4">
      <Group label="Key">
        {PITCH_CLASSES.map((pc) => (
          <button
            key={pc}
            type="button"
            aria-pressed={pc === root}
            onClick={() => setRoot(pc)}
            className={`${chip} min-w-11 ${pc === root ? chipOn : chipOff}`}
          >
            {/* Spell each key the way it is actually written in this mode. */}
            {noteName(pc, accidentalForKey(pc, mode))}
          </button>
        ))}
      </Group>

      {/*
        The key is a live control — you reach for it constantly, so it stays out
        in the open. The mode is set once and left, so it folds into a select
        rather than spending a whole row on nine chips you rarely touch.
      */}
      <Group label="Mode">
        <div className="relative">
          <select
            value={mode}
            aria-label="Mode"
            onChange={(event) => setMode(event.target.value as ModeName)}
            className={`${chip} ${chipOff} appearance-none pr-9 focus-visible:ring-2 focus-visible:ring-ember-soft/70 focus-visible:outline-none`}
          >
            {MODE_NAMES.map((name) => (
              <option key={name} value={name} className="bg-ink text-bone">
                {MODE_LABELS[name]}
              </option>
            ))}
          </select>
          <span
            aria-hidden
            className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-bone-dim"
          >
            ▾
          </span>
        </div>
      </Group>
    </div>
  );
}

function Group({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <span className="w-14 shrink-0 font-mono text-xs tracking-[0.25em] text-bone-dim uppercase">
        {label}
      </span>
      {children}
    </div>
  );
}
