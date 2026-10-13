'use client';

import { useEffect, useRef, useState } from 'react';

/**
 * Ease a flat list of numbers toward `target` over `duration` ms. The shader
 * takes plain uniforms, which snap when they change; this is what turns a
 * modifier press into a morph. Retargeting mid-flight starts from wherever the
 * values are now, so quick taps never jump.
 */
export function useTween(target: number[], duration: number): number[] {
  const [value, setValue] = useState(target);
  const current = useRef(target);
  const key = target.join(',');

  useEffect(() => {
    const from = current.current;
    const to = key.split(',').map(Number);
    if (from.length !== to.length || from.every((v, i) => v === to[i])) {
      current.current = to;
      setValue(to);
      return;
    }

    const start = performance.now();
    let frame = requestAnimationFrame(function step(now) {
      const t = Math.min(1, (now - start) / duration);
      const eased = 1 - (1 - t) ** 3;
      const next = from.map((v, i) => v + (to[i] - v) * eased);
      current.current = next;
      setValue(next);
      if (t < 1) frame = requestAnimationFrame(step);
    });
    return () => cancelAnimationFrame(frame);
  }, [key, duration]);

  return value;
}
