'use client';

import { type ReactNode, useEffect, useState, useSyncExternalStore } from 'react';
import { useAppStore } from '@/state/store';
import { readSeen, subscribeSeen } from '@/tutorial/seen';
import { connectTutorial, useTutorialStore } from '@/tutorial/store';
import { TUTORIAL_STEPS } from '@/tutorial/steps';
import { useTutorialEligible } from '@/tutorial/useEligible';

interface Box {
  left: number;
  top: number;
  width: number;
  height: number;
}

/** How far the ring stands off the thing it circles. */
const RING_GAP = 6;

export function Tutorial() {
  const eligible = useTutorialEligible();
  // Storage is read after hydration only, as in RotateHint: the server can't know.
  const seen = useSyncExternalStore(subscribeSeen, readSeen, () => true);
  const phase = useTutorialStore((s) => s.phase);
  const solved = useTutorialStore((s) => s.solved);
  const showWelcome = useTutorialStore((s) => s.showWelcome);
  const skip = useTutorialStore((s) => s.skip);
  const dismiss = useTutorialStore((s) => s.dismiss);

  useEffect(connectTutorial, []);

  useEffect(() => {
    if (eligible && !seen) showWelcome();
  }, [eligible, seen, showWelcome]);

  const active = phase !== 'off';
  useEffect(() => {
    if (!active) return;
    function onKeyDown(event: KeyboardEvent) {
      if (event.code !== 'Escape') return;
      if (useTutorialStore.getState().phase === 'done') dismiss();
      else skip();
    }
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [active, skip, dismiss]);

  if (!eligible || phase === 'off') return null;

  if (typeof phase === 'object') {
    const step = TUTORIAL_STEPS[phase.step];
    return (
      <>
        <Ring key={step.id} target={step.target} solved={solved} />
        <Dock>
          <div className="flex items-center justify-between gap-3">
            <span className="font-mono text-[0.65rem] tracking-[0.2em] text-bone-dim uppercase">
              Step {phase.step + 1} / {TUTORIAL_STEPS.length}
            </span>
            <button type="button" onClick={skip} className={LINK_BUTTON}>
              Skip
            </button>
          </div>
          <div aria-hidden className="mt-2 flex gap-1">
            {TUTORIAL_STEPS.map((s, index) => (
              <span
                key={s.id}
                className={[
                  'h-0.5 flex-1 rounded-full',
                  index <= phase.step ? 'bg-accent' : 'bg-ink-edge',
                ].join(' ')}
              />
            ))}
          </div>
          <p className="mt-3 text-base font-extrabold tracking-tight text-bone">
            {solved && <span className="mr-1.5 text-mod-ninth">✓</span>}
            {step.title}
          </p>
          <p className="mt-1 text-sm leading-snug text-bone-dim">
            {solved ? 'Nice.' : step.body}
          </p>
        </Dock>
      </>
    );
  }

  if (phase === 'welcome') {
    return (
      <Dock>
        <p className="text-base font-extrabold tracking-tight text-bone">New here? 60-second tour</p>
        <p className="mt-1 text-sm leading-snug text-bone-dim">
          Five quick things to try on the keys. The board stays live the whole time.
        </p>
        <div className="mt-3 flex items-center gap-3">
          <button
            type="button"
            onClick={() => useTutorialStore.getState().start(useAppStore.getState())}
            className="rounded-md bg-accent px-4 py-1.5 font-mono text-xs font-bold tracking-[0.15em] text-white uppercase hover:bg-accent/85"
          >
            Start
          </button>
          <button type="button" onClick={skip} className={LINK_BUTTON}>
            I know what I&apos;m doing
          </button>
        </div>
      </Dock>
    );
  }

  return (
    <Dock>
      <p className="text-base font-extrabold tracking-tight text-bone">
        <span className="mr-1.5 text-mod-ninth">✓</span>That&apos;s the core of it
      </p>
      <p className="mt-1 text-sm leading-snug text-bone-dim">
        The Sound tab shapes the tone. The ? up top replays this.
      </p>
      <button type="button" onClick={dismiss} className={`mt-3 ${LINK_BUTTON}`}>
        Close
      </button>
    </Dock>
  );
}

const LINK_BUTTON =
  'font-mono text-[0.65rem] tracking-[0.15em] text-bone-dim uppercase underline-offset-2 hover:text-bone hover:underline';

/**
 * Every card sits in the same spot, so the eye learns where to look. The strip
 * itself ignores the pointer; only the card takes clicks.
 */
function Dock({ children }: { children: ReactNode }) {
  return (
    <div
      aria-live="polite"
      className="pointer-events-none fixed inset-x-0 bottom-8 z-30 flex justify-center px-4"
    >
      <div className="pointer-events-auto w-full max-w-sm rounded-2xl border border-ink-edge bg-ink-raised/90 p-4 shadow-[0_8px_32px_rgba(0,0,0,0.5)] backdrop-blur animate-in fade-in slide-in-from-bottom-2">
        {children}
      </div>
    </div>
  );
}

function sameBox(a: Box | null, b: Box | null): boolean {
  if (!a || !b) return a === b;
  return a.left === b.left && a.top === b.top && a.width === b.width && a.height === b.height;
}

/**
 * A pulsing outline around a `data-tutorial` element. Fixed-position and
 * pointer-transparent, so it adds nothing to the layout and takes no clicks.
 */
function Ring({ target, solved }: { target: string; solved: boolean }) {
  const [box, setBox] = useState<Box | null>(null);

  useEffect(() => {
    const element = document.querySelector(`[data-tutorial="${target}"]`);
    if (!element) return;

    function measure() {
      const rect = (element as Element).getBoundingClientRect();
      // The off-screen panel is parked past the viewport edge, not removed.
      const visible = rect.width > 0 && rect.right > 0 && rect.left < window.innerWidth;
      const next = visible
        ? { left: rect.left, top: rect.top, width: rect.width, height: rect.height }
        : null;
      // Transition events fire for every pad press; don't re-render for a rect that held still.
      setBox((prev) => (sameBox(prev, next) ? prev : next));
    }

    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(element);
    window.addEventListener('resize', measure);
    // The key panel slides on a CSS transition, which no observer reports.
    window.addEventListener('transitionend', measure, true);
    window.addEventListener('scroll', measure, true);
    return () => {
      observer.disconnect();
      window.removeEventListener('resize', measure);
      window.removeEventListener('transitionend', measure, true);
      window.removeEventListener('scroll', measure, true);
    };
  }, [target]);

  if (!box) return null;
  return (
    <div
      aria-hidden
      data-solved={solved}
      className="tutorial-ring pointer-events-none fixed z-20 rounded-xl"
      style={{
        left: box.left - RING_GAP,
        top: box.top - RING_GAP,
        width: box.width + RING_GAP * 2,
        height: box.height + RING_GAP * 2,
      }}
    />
  );
}
