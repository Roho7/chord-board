const STORAGE_KEY = 'chord-board:tutorial-seen';

const listeners = new Set<() => void>();

/**
 * Storage can be blocked (private mode), and the welcome card must not come
 * back the moment it is waved away, so the session remembers too.
 */
let seenThisSession = false;

export function readSeen(): boolean {
  if (seenThisSession) return true;
  try {
    return localStorage.getItem(STORAGE_KEY) === '1';
  } catch {
    return false;
  }
}

export function markSeen(): void {
  seenThisSession = true;
  try {
    localStorage.setItem(STORAGE_KEY, '1');
  } catch {
    // Blocked storage: the tour just offers itself again next visit.
  }
  listeners.forEach((notify) => notify());
}

export function subscribeSeen(notify: () => void): () => void {
  listeners.add(notify);
  return () => {
    listeners.delete(notify);
  };
}
