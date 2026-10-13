'use client';

import { useState, useSyncExternalStore } from 'react';

const STORAGE_KEY = 'chord-board:rotate-hint-dismissed';

/**
 * Upright phones still work, but the board is built to be held sideways —
 * say so once, quietly, and remember when it's waved away.
 */
export function RotateHint() {
  // Read storage after hydration only: the server can't know, and guessing
  // wrong would flash the hint or mismatch the markup.
  const storedDismissal = useSyncExternalStore(noop, readDismissed, () => true);
  const [dismissed, setDismissed] = useState(false);

  if (storedDismissal || dismissed) return null;

  function dismiss() {
    setDismissed(true);
    try {
      localStorage.setItem(STORAGE_KEY, '1');
    } catch {
      // Private mode or blocked storage: the hint just comes back next visit.
    }
  }

  return (
    <div className="hidden shrink-0 items-center justify-between gap-3 rounded-lg border border-white/[0.06] px-3 py-2 pointer-coarse:phone-portrait:flex">
      <span className="font-mono text-[0.65rem] tracking-[0.15em] text-bone-dim uppercase">
        ↻ Turn sideways for the full board
      </span>
      <button
        type="button"
        onClick={dismiss}
        aria-label="Dismiss"
        className="flex size-6 items-center justify-center rounded-full text-bone-dim hover:text-bone"
      >
        ×
      </button>
    </div>
  );
}

function readDismissed(): boolean {
  try {
    return localStorage.getItem(STORAGE_KEY) === '1';
  } catch {
    return false;
  }
}

function noop(): () => void {
  return () => {};
}
