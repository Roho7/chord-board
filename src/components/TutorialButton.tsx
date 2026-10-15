'use client';

import { useAppStore } from '@/state/store';
import { useTutorialStore } from '@/tutorial/store';
import { useTutorialEligible } from '@/tutorial/useEligible';

/** Replays the tour. Absent wherever the tour itself doesn't run. */
export function TutorialButton() {
  const eligible = useTutorialEligible();
  if (!eligible) return null;

  return (
    <>
      <span aria-hidden className="h-4 w-px bg-white/10" />
      <button
        type="button"
        aria-label="Replay the tutorial"
        title="Replay the tutorial"
        onClick={() => useTutorialStore.getState().start(useAppStore.getState())}
        className="flex size-5 items-center justify-center rounded-full border border-ink-edge font-mono text-[0.65rem] font-bold text-bone-dim hover:border-accent-soft hover:text-bone"
      >
        ?
      </button>
    </>
  );
}
