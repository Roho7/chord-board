'use client';

/**
 * Getting the browser to make sound at all.
 *
 * An AudioContext starts suspended and may only be resumed inside a user
 * gesture — and for touch, the gesture is the finger *lifting*: the spec counts
 * `pointerup`/`touchend` from a touch as activation, but not `pointerdown`. A
 * mouse counts on press. So unlocking from a pad's `pointerdown` works on a
 * laptop and silently does nothing on a phone.
 *
 * The context is created here, natively and synchronously, rather than by
 * Tone: Tone arrives by dynamic import, and anything that has to wait for a
 * module has already lost the gesture. The rack hands this context to Tone.
 */

let context: AudioContext | null = null;

export function audioContext(): AudioContext {
  context ??= new AudioContext({ latencyHint: 'interactive' });
  return context;
}

/** Resume if suspended. Synchronous — call it straight from a gesture handler. */
export function resumeAudio(): void {
  const ctx = audioContext();
  if (ctx.state !== 'running') void ctx.resume();
}

/** Every event the spec accepts as user activation, touch and mouse alike. */
const GESTURES = ['pointerup', 'touchend', 'click', 'keydown'] as const;

/**
 * Try to resume on every gesture until the context is actually running —
 * a refused attempt must not count as done — then stop listening. Returns a
 * cleanup for React effects.
 */
export function installGestureUnlock(): () => void {
  // iOS mutes Web Audio while the ringer switch is on silent unless the page
  // says it is a playback app — an instrument is exactly that.
  const session = (navigator as Navigator & { audioSession?: { type: string } }).audioSession;
  if (session) session.type = 'playback';

  function onGesture() {
    resumeAudio();
    if (context?.state === 'running') remove();
  }

  function remove() {
    for (const type of GESTURES) window.removeEventListener(type, onGesture, true);
  }

  // Capture phase, so nothing that stops propagation can starve it.
  for (const type of GESTURES) window.addEventListener(type, onGesture, true);
  return remove;
}
