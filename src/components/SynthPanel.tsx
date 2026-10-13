'use client';

import type { FilterType, Rolloff, SynthPatch, Waveform } from '@/audio/synthPatch';
import { useAppStore } from '@/state/store';
import {
  asCents,
  asDecibels,
  asHertz,
  asMilliseconds,
  asPercent,
  Choice,
  ControlGroup,
  Fader,
} from './SynthControls';

const WAVEFORMS: ReadonlyArray<{ value: Waveform; label: string }> = [
  { value: 'sawtooth', label: 'Saw' },
  { value: 'square', label: 'Square' },
  { value: 'triangle', label: 'Tri' },
  { value: 'sine', label: 'Sine' },
];

const FILTER_TYPES: ReadonlyArray<{ value: FilterType; label: string }> = [
  { value: 'lowpass', label: 'Low' },
  { value: 'highpass', label: 'High' },
  { value: 'bandpass', label: 'Band' },
];

const ROLLOFFS: ReadonlyArray<{ value: Rolloff; label: string }> = [
  { value: -12, label: '12' },
  { value: -24, label: '24' },
  { value: -48, label: '48' },
];

export function SynthPanel() {
  const patch = useAppStore((s) => s.patch);
  const setPatch = useAppStore((s) => s.setPatch);

  // Typed shorthand: `set('cutoff')` returns a handler for that one field.
  const set =
    <K extends keyof SynthPatch>(key: K) =>
    (value: SynthPatch[K]) =>
      setPatch({ [key]: value } as Partial<SynthPatch>);

  return (
    <div className="flex flex-col gap-4">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="font-mono text-sm font-bold tracking-[0.3em] uppercase">Synth</h2>
        <button
          type="button"
          onClick={() => setPatch(null)}
          className="rounded-md bg-ink-raised px-3 py-1.5 font-mono text-xs tracking-[0.15em] text-bone-dim uppercase hover:text-bone"
        >
          Reset
        </button>
      </header>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <ControlGroup title="Oscillator">
          <Choice label="Waveform" value={patch.waveform} options={WAVEFORMS} onChange={set('waveform')} />
          <Fader
            label="Voices"
            value={patch.voices}
            min={1}
            max={7}
            step={1}
            format={(v) => `${v}`}
            onChange={set('voices')}
          />
          <Fader
            label="Spread"
            value={patch.spread}
            min={0}
            max={100}
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

        <ControlGroup title="Amp envelope">
          <Fader label="Attack" value={patch.attack} min={0.001} max={3} step={0.001} format={asMilliseconds} onChange={set('attack')} />
          <Fader label="Decay" value={patch.decay} min={0.01} max={4} step={0.01} format={asMilliseconds} onChange={set('decay')} />
          <Fader label="Sustain" value={patch.sustain} min={0} max={1} step={0.01} format={asPercent} onChange={set('sustain')} />
          <Fader label="Release" value={patch.release} min={0.01} max={8} step={0.01} format={asMilliseconds} onChange={set('release')} />
        </ControlGroup>

        <ControlGroup title="Filter">
          <Choice label="Type" value={patch.filterType} options={FILTER_TYPES} onChange={set('filterType')} />
          <Fader label="Cutoff" value={patch.cutoff} min={40} max={4000} step={1} format={asHertz} onChange={set('cutoff')} />
          <Fader label="Resonance" value={patch.resonance} min={0} max={16} step={0.1} format={(v) => v.toFixed(1)} onChange={set('resonance')} />
          <Choice label="Slope dB/oct" value={patch.rolloff} options={ROLLOFFS} onChange={set('rolloff')} />
        </ControlGroup>

        <ControlGroup title="Filter envelope">
          <Fader label="Amount" value={patch.filterOctaves} min={0} max={7} step={0.1} format={(v) => `${v.toFixed(1)} oct`} onChange={set('filterOctaves')} />
          <Fader label="Attack" value={patch.filterAttack} min={0.001} max={3} step={0.001} format={asMilliseconds} onChange={set('filterAttack')} />
          <Fader label="Decay" value={patch.filterDecay} min={0.01} max={4} step={0.01} format={asMilliseconds} onChange={set('filterDecay')} />
          <Fader label="Sustain" value={patch.filterSustain} min={0} max={1} step={0.01} format={asPercent} onChange={set('filterSustain')} />
          <Fader label="Release" value={patch.filterRelease} min={0.01} max={8} step={0.01} format={asMilliseconds} onChange={set('filterRelease')} />
        </ControlGroup>

        <ControlGroup title="Output">
          <Fader label="Drive" value={patch.drive} min={0} max={1} step={0.01} format={asPercent} onChange={set('drive')} />
          <Fader label="Reverb" value={patch.reverb} min={0} max={1} step={0.01} format={asPercent} onChange={set('reverb')} />
          <Fader label="Level" value={patch.level} min={-40} max={0} step={0.5} format={asDecibels} onChange={set('level')} />
        </ControlGroup>
      </div>
    </div>
  );
}
