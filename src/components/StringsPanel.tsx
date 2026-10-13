'use client';

import type { StringsPatch } from '@/audio/stringsPatch';
import { useAppStore } from '@/state/store';
import {
  asCents,
  asDecibels,
  asHertz,
  asMilliseconds,
  asPercent,
  ControlGroup,
  Fader,
} from './SynthControls';

export function StringsPanel() {
  const patch = useAppStore((s) => s.stringsPatch);
  const setPatch = useAppStore((s) => s.setStringsPatch);

  // Same typed shorthand as the synth panel: `set('tone')` is a handler for one field.
  const set =
    <K extends keyof StringsPatch>(key: K) =>
    (value: StringsPatch[K]) =>
      setPatch({ [key]: value } as Partial<StringsPatch>);

  return (
    <div className="flex flex-col gap-4">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="font-mono text-sm font-bold tracking-[0.3em] uppercase">Strings</h2>
        <button
          type="button"
          onClick={() => setPatch(null)}
          className="rounded-md bg-ink-raised px-3 py-1.5 font-mono text-xs tracking-[0.15em] text-bone-dim uppercase hover:text-bone"
        >
          Reset
        </button>
      </header>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <ControlGroup title="Section">
          <Fader
            label="Players"
            value={patch.players}
            min={1}
            max={7}
            step={1}
            format={(v) => `${v}`}
            onChange={set('players')}
          />
          <Fader
            label="Spread"
            value={patch.spread}
            min={0}
            max={80}
            step={1}
            format={asCents}
            onChange={set('spread')}
          />
          <Fader
            label="Detune"
            value={patch.detune}
            min={-50}
            max={50}
            step={1}
            format={asCents}
            onChange={set('detune')}
          />
        </ControlGroup>

        <ControlGroup title="Bow">
          <Fader
            label="Attack"
            value={patch.attack}
            min={0.001}
            max={2}
            step={0.001}
            format={asMilliseconds}
            onChange={set('attack')}
          />
          <Fader
            label="Decay"
            value={patch.decay}
            min={0.01}
            max={4}
            step={0.01}
            format={asMilliseconds}
            onChange={set('decay')}
          />
          <Fader
            label="Sustain"
            value={patch.sustain}
            min={0}
            max={1}
            step={0.01}
            format={asPercent}
            onChange={set('sustain')}
          />
          <Fader
            label="Release"
            value={patch.release}
            min={0.01}
            max={8}
            step={0.01}
            format={asMilliseconds}
            onChange={set('release')}
          />
        </ControlGroup>

        <ControlGroup title="Tone">
          <Fader
            label="Cutoff"
            value={patch.tone}
            min={200}
            max={8000}
            step={10}
            format={asHertz}
            onChange={set('tone')}
          />
          <Fader
            label="Resonance"
            value={patch.resonance}
            min={0}
            max={12}
            step={0.1}
            format={(v) => v.toFixed(1)}
            onChange={set('resonance')}
          />
        </ControlGroup>

        <ControlGroup title="Ensemble">
          <Fader
            label="Amount"
            value={patch.ensemble}
            min={0}
            max={1}
            step={0.01}
            format={asPercent}
            onChange={set('ensemble')}
          />
          <Fader
            label="Rate"
            value={patch.rate}
            min={0.1}
            max={3}
            step={0.01}
            format={(v) => `${v.toFixed(2)}×`}
            onChange={set('rate')}
          />
          <Fader
            label="Depth"
            value={patch.depth}
            min={0}
            max={1}
            step={0.01}
            format={asPercent}
            onChange={set('depth')}
          />
        </ControlGroup>

        <ControlGroup title="Output">
          <Fader
            label="Hall"
            value={patch.reverb}
            min={0}
            max={1}
            step={0.01}
            format={asPercent}
            onChange={set('reverb')}
          />
          <Fader
            label="Level"
            value={patch.level}
            min={-40}
            max={0}
            step={0.5}
            format={asDecibels}
            onChange={set('level')}
          />
        </ControlGroup>
      </div>
    </div>
  );
}
