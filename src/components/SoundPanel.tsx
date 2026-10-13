'use client';

import type { InstrumentName } from '@/audio/engine';
import { useAppStore } from '@/state/store';
import { StringsPanel } from './StringsPanel';
import { SynthPanel } from './SynthPanel';

/** Which instruments have controls, and what the panel is called for each. */
const SHAPEABLE: Partial<Record<InstrumentName, () => React.ReactElement>> = {
  synth: SynthPanel,
  strings: StringsPanel,
};

/**
 * The Sound tab follows whatever is playing. Showing the synth's controls while
 * the strings are sounding is the fastest way to make a panel feel broken — so
 * the panel and the instrument are always the same thing.
 */
export function SoundPanel() {
  const instrument = useAppStore((s) => s.instrument);
  const setInstrument = useAppStore((s) => s.setInstrument);

  const Panel = SHAPEABLE[instrument];
  if (Panel) return <Panel />;

  return (
    <div className="flex flex-col items-start gap-4">
      <p className="font-mono text-sm text-bone-dim">
        The {instrument} is sampled — there is nothing to shape. Switch to a synthesised
        instrument to get controls.
      </p>
      <div className="flex gap-2">
        {(Object.keys(SHAPEABLE) as InstrumentName[]).map((name) => (
          <button
            key={name}
            type="button"
            onClick={() => setInstrument(name)}
            className="rounded-md bg-ink-raised px-4 py-2 font-mono text-sm font-bold text-accent-soft uppercase transition-colors hover:bg-ink-edge"
          >
            {name}
          </button>
        ))}
      </div>
    </div>
  );
}
