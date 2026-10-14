'use client';

import { useSyncExternalStore } from 'react';

/**
 * The tour teaches keys, so it only runs where there is a keyboard and room for
 * the legend: a fine pointer, and wide enough not to count as a phone layout.
 */
const QUERY = '(pointer: fine) and (min-width: 640px)';

function subscribe(notify: () => void): () => void {
  const list = window.matchMedia(QUERY);
  list.addEventListener('change', notify);
  return () => list.removeEventListener('change', notify);
}

export function useTutorialEligible(): boolean {
  // Server and first paint say no, so touch devices never flash the card.
  return useSyncExternalStore(subscribe, () => window.matchMedia(QUERY).matches, () => false);
}
