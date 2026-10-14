import { create } from 'zustand';
import { useAppStore } from '@/state/store';
import { markSeen } from './seen';
import { type BoardSnapshot, TUTORIAL_STEPS } from './steps';

export type TutorialPhase = 'off' | 'welcome' | 'done' | { step: number };

export interface TutorialState {
  phase: TutorialPhase;
  /** The current step's goal has been met; the success beat is playing. */
  solved: boolean;
  /** The board when the current step began, for steps that ask for a change. */
  atStart: BoardSnapshot | null;

  showWelcome(): void;
  /** Begin at step one. Also the replay. */
  start(board: BoardSnapshot): void;
  skip(): void;
  /** Leave the closing card. */
  dismiss(): void;
  /** Mark the current step solved if the board now satisfies it. */
  observe(board: BoardSnapshot): void;
  /** Move past a solved step. */
  next(board: BoardSnapshot): void;
}

/** Long enough to register the tick, short enough not to make anyone wait. */
export const SUCCESS_BEAT_MS = 600;

function snapshot(board: BoardSnapshot): BoardSnapshot {
  const { pressedDegrees, modifiers, extraKeys, root, mode } = board;
  return { pressedDegrees, modifiers, extraKeys, root, mode };
}

export const useTutorialStore = create<TutorialState>((set, get) => ({
  phase: 'off',
  solved: false,
  atStart: null,

  showWelcome() {
    if (get().phase === 'off') set({ phase: 'welcome' });
  },

  start(board) {
    markSeen();
    set({ phase: { step: 0 }, solved: false, atStart: snapshot(board) });
  },

  skip() {
    markSeen();
    set({ phase: 'off', solved: false, atStart: null });
  },

  dismiss() {
    set({ phase: 'off', solved: false, atStart: null });
  },

  observe(board) {
    const { phase, solved, atStart } = get();
    if (typeof phase !== 'object' || solved || !atStart) return;
    if (TUTORIAL_STEPS[phase.step].done(board, atStart)) set({ solved: true });
  },

  next(board) {
    const { phase, solved } = get();
    if (typeof phase !== 'object' || !solved) return;
    if (phase.step + 1 >= TUTORIAL_STEPS.length) {
      markSeen();
      set({ phase: 'done', solved: false, atStart: null });
      return;
    }
    set({ phase: { step: phase.step + 1 }, solved: false, atStart: snapshot(board) });
  },
}));

/**
 * Watch the board and carry the tutorial along: mark a step solved the moment
 * the board satisfies it, then move on after the success beat. Returns the
 * cleanup.
 */
export function connectTutorial(): () => void {
  let timer: ReturnType<typeof setTimeout> | undefined;

  const unsubscribeBoard = useAppStore.subscribe((board) => {
    useTutorialStore.getState().observe(board);
  });

  const unsubscribeTutorial = useTutorialStore.subscribe((state, previous) => {
    const justSolved = state.solved && !previous.solved;
    if (justSolved) {
      timer = setTimeout(() => {
        useTutorialStore.getState().next(useAppStore.getState());
      }, SUCCESS_BEAT_MS);
    } else if (!state.solved && previous.solved) {
      // Skipped, or replayed, mid-beat: the pending advance is stale.
      clearTimeout(timer);
    }
  });

  return () => {
    clearTimeout(timer);
    unsubscribeBoard();
    unsubscribeTutorial();
  };
}
