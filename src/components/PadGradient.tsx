'use client';

import { MeshGradient } from '@paper-design/shaders-react';
import { useSyncExternalStore } from 'react';
import type { MeshTint, Rgb } from './padTint';
import { useTween } from './useTween';

/** Matches the CSS overlays, so the body and the pool morph together. */
const MORPH_MS = 700;

interface PadGradientProps {
  tint: MeshTint;
  /** Shader time multiplier. Changing it keeps the clock, so slowing never jumps. */
  speed: number;
  visible: boolean;
}

/**
 * The moving body of a lit pad. Mounted for every pad all the time and only
 * faded in: creating a WebGL context costs a few frames, and a press can't
 * wait for that.
 */
export function PadGradient({ tint, speed, visible }: PadGradientProps) {
  const reducedMotion = useSyncExternalStore(subscribeMotion, prefersReducedMotion, () => false);

  const flat = useTween(
    [...tint.colours.flat(), tint.distortion, tint.swirl, tint.rotation],
    MORPH_MS,
  );
  const colours: string[] = [];
  for (let i = 0; i < tint.colours.length; i++) {
    colours.push(hex(flat.slice(i * 3, i * 3 + 3) as Rgb));
  }
  const [distortion, swirl, rotation] = flat.slice(tint.colours.length * 3);

  return (
    <MeshGradient
      aria-hidden
      colors={colours}
      distortion={distortion}
      swirl={swirl}
      rotation={rotation}
      // Idle pads stop drawing altogether rather than animating unseen.
      speed={visible && !reducedMotion ? speed : 0}
      maxPixelCount={400_000}
      className="absolute inset-0 transition-opacity duration-75"
      style={{ opacity: visible ? 1 : 0 }}
    />
  );
}

function hex([r, g, b]: Rgb): string {
  return `#${[r, g, b].map((c) => Math.round(c).toString(16).padStart(2, '0')).join('')}`;
}

const MOTION_QUERY = '(prefers-reduced-motion: reduce)';

function subscribeMotion(onChange: () => void): () => void {
  const query = window.matchMedia(MOTION_QUERY);
  query.addEventListener('change', onChange);
  return () => query.removeEventListener('change', onChange);
}

function prefersReducedMotion(): boolean {
  return window.matchMedia(MOTION_QUERY).matches;
}
