import type { ChordModifiers } from '@/theory/chords';

/**
 * A lit control wears the colour it puts on the pads — the key legend and the
 * touch chips both read this, which is what teaches the mapping.
 */
export interface ControlColour {
  colour: string;
  /** Text that stays readable on that colour. */
  text: string;
}

export const MODIFIER_COLOURS: Partial<Record<keyof ChordModifiers, ControlColour>> = {
  minor: { colour: 'var(--color-mod-minor)', text: 'text-white' },
  seventh: { colour: 'var(--color-mod-seventh)', text: 'text-white' },
  dominant: { colour: 'var(--color-mod-dominant)', text: 'text-white' },
  suspended: { colour: 'var(--color-mod-suspended)', text: 'text-ink' },
  ninth: { colour: 'var(--color-mod-ninth)', text: 'text-ink' },
};

export const BASS_COLOUR: ControlColour = { colour: 'var(--color-mod-bass)', text: 'text-white' };
export const ACCENT_COLOUR: ControlColour = { colour: 'var(--color-accent)', text: 'text-white' };
