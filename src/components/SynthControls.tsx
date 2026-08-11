'use client';

/** The two control primitives the synth panel is built from. */

interface FaderProps {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  /** How the value reads back, e.g. "220 Hz". */
  format: (value: number) => string;
  onChange: (value: number) => void;
}

export function Fader({ label, value, min, max, step, format, onChange }: FaderProps) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="flex items-baseline justify-between gap-2">
        <span className="font-mono text-[0.65rem] tracking-[0.18em] text-bone-dim uppercase">
          {label}
        </span>
        <span className="font-mono text-xs font-bold text-bone tabular-nums">
          {format(value)}
        </span>
      </span>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(event) => onChange(event.target.valueAsNumber)}
        className="accent-ember h-1.5 w-full cursor-pointer appearance-none rounded-full bg-ink-edge"
      />
    </label>
  );
}

interface ChoiceProps<T extends string | number> {
  label: string;
  value: T;
  options: ReadonlyArray<{ value: T; label: string }>;
  onChange: (value: T) => void;
}

export function Choice<T extends string | number>({
  label,
  value,
  options,
  onChange,
}: ChoiceProps<T>) {
  return (
    <div className="flex flex-col gap-1.5">
      <span className="font-mono text-[0.65rem] tracking-[0.18em] text-bone-dim uppercase">
        {label}
      </span>
      <div className="flex flex-wrap gap-1">
        {options.map((option) => (
          <button
            key={option.value}
            type="button"
            aria-pressed={option.value === value}
            onClick={() => onChange(option.value)}
            className={[
              'rounded px-2 py-1 font-mono text-[0.7rem] font-bold uppercase transition-colors',
              option.value === value
                ? 'bg-ember text-ink'
                : 'bg-ink text-bone-dim hover:text-bone',
            ].join(' ')}
          >
            {option.label}
          </button>
        ))}
      </div>
    </div>
  );
}

export function ControlGroup({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="flex flex-col gap-3 rounded-lg border border-ink-edge bg-ink-raised p-4">
      <h3 className="font-mono text-xs font-bold tracking-[0.25em] text-ember uppercase">
        {title}
      </h3>
      {children}
    </section>
  );
}

/** Shared readouts, so units are formatted the same way everywhere. */
export const asMilliseconds = (value: number) =>
  value >= 1 ? `${value.toFixed(2)} s` : `${Math.round(value * 1000)} ms`;
export const asHertz = (value: number) =>
  value >= 1000 ? `${(value / 1000).toFixed(2)} kHz` : `${Math.round(value)} Hz`;
export const asPercent = (value: number) => `${Math.round(value * 100)}%`;
export const asCents = (value: number) => `${Math.round(value)} ¢`;
export const asDecibels = (value: number) => `${value.toFixed(1)} dB`;
