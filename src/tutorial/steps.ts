import type { AppState } from '@/state/store';

/** The slice of the board a step can see. A plain subset so tests can build one literally. */
export type BoardSnapshot = Pick<
  AppState,
  'pressedDegrees' | 'modifiers' | 'extraKeys' | 'root' | 'mode'
>;

export interface TutorialStep {
  id: string;
  /** The `data-tutorial` value of the element the pulse ring goes around. */
  target: string;
  title: string;
  body: string;
  /**
   * `now` is the board as it is; `atStart` is the board as it was when the
   * step began, for steps that ask for a change rather than a state.
   */
  done: (now: BoardSnapshot, atStart: BoardSnapshot) => boolean;
}

/**
 * Modifiers only mean something while a chord is down, so each of these asks
 * for a pad held at the same moment. Pads are read from `pressedDegrees`, not
 * `heldDegrees`, which under sustain outlives the key.
 */
const padDown = (now: BoardSnapshot) => now.pressedDegrees.size > 0;

export const TUTORIAL_STEPS: readonly TutorialStep[] = [
  {
    id: 'play',
    target: 'pad-A',
    title: 'Play a chord',
    body: 'Press A. Every pad is a chord in the current key, and the letter on it is the key that plays it.',
    done: padDown,
  },
  {
    id: 'minor',
    target: 'key-J',
    title: 'Make it minor',
    body: 'Hold J, then press a pad. J flattens the third of whatever you play.',
    done: (now) => now.modifiers.minor && padDown(now),
  },
  {
    id: 'colour',
    target: 'key-I',
    title: 'Add colour',
    body: 'Hold I, O or P, then press a pad. They add a 7th, a dominant 7th or a suspended 4th.',
    done: (now) =>
      (now.modifiers.seventh || now.modifiers.dominant || now.modifiers.suspended) && padDown(now),
  },
  {
    id: 'bass',
    target: 'key-;',
    title: 'Add bass and octave',
    body: 'Press ; for the bass note, or Space to double the chord an octave up. They follow the last chord you played.',
    done: (now) => now.extraKeys.has('bassRoot') || now.extraKeys.has('chordOctave'),
  },
  {
    id: 'key-mode',
    target: 'wheels',
    title: 'Change key or mode',
    body: 'Scroll or drag the Key or Mode wheel. The pads re-spell themselves to match.',
    done: (now, atStart) => now.root !== atStart.root || now.mode !== atStart.mode,
  },
];
