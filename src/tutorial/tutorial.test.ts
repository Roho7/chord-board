import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useAppStore } from '@/state/store';
import { NO_MODIFIERS } from '@/theory/chords';
import { readSeen } from './seen';
import { connectTutorial, SUCCESS_BEAT_MS, useTutorialStore } from './store';
import { type BoardSnapshot, TUTORIAL_STEPS } from './steps';

const idle: BoardSnapshot = {
  pressedDegrees: new Set(),
  modifiers: NO_MODIFIERS,
  extraKeys: new Set(),
  root: 0,
  mode: 'ionian',
};

function board(patch: Partial<BoardSnapshot>): BoardSnapshot {
  return { ...idle, ...patch };
}

function step(id: string) {
  const found = TUTORIAL_STEPS.find((s) => s.id === id);
  if (!found) throw new Error(`no step ${id}`);
  return found;
}

describe('step table', () => {
  it('has five steps in teaching order', () => {
    expect(TUTORIAL_STEPS.map((s) => s.id)).toEqual(['play', 'minor', 'colour', 'bass', 'key-mode']);
  });

  it('points every step at a distinct target', () => {
    expect(TUTORIAL_STEPS.map((s) => s.target)).toEqual([
      'pad-A',
      'key-J',
      'key-I',
      'key-;',
      'wheels',
    ]);
  });

  it('is not satisfied by an idle board', () => {
    for (const s of TUTORIAL_STEPS) expect(s.done(idle, idle)).toBe(false);
  });
});

describe('predicates', () => {
  it('play: any pad held', () => {
    expect(step('play').done(board({ pressedDegrees: new Set([3]) }), idle)).toBe(true);
  });

  it('minor: needs J and a pad together', () => {
    const minor = { ...NO_MODIFIERS, minor: true };
    expect(step('minor').done(board({ modifiers: minor }), idle)).toBe(false);
    expect(step('minor').done(board({ pressedDegrees: new Set([0]) }), idle)).toBe(false);
    expect(
      step('minor').done(board({ modifiers: minor, pressedDegrees: new Set([0]) }), idle),
    ).toBe(true);
  });

  it('colour: I, O or P with a pad, and not J', () => {
    const pad = new Set([1]);
    for (const name of ['seventh', 'dominant', 'suspended'] as const) {
      const modifiers = { ...NO_MODIFIERS, [name]: true };
      expect(step('colour').done(board({ modifiers }), idle)).toBe(false);
      expect(step('colour').done(board({ modifiers, pressedDegrees: pad }), idle)).toBe(true);
    }
    const minor = { ...NO_MODIFIERS, minor: true };
    expect(step('colour').done(board({ modifiers: minor, pressedDegrees: pad }), idle)).toBe(false);
  });

  it('bass: ; or Space, but not the other bass key', () => {
    expect(step('bass').done(board({ extraKeys: new Set(['bassRoot']) }), idle)).toBe(true);
    expect(step('bass').done(board({ extraKeys: new Set(['chordOctave']) }), idle)).toBe(true);
    expect(step('bass').done(board({ extraKeys: new Set(['bassFifth']) }), idle)).toBe(false);
  });

  it('key-mode: compares against where the step began', () => {
    const start = board({ root: 7, mode: 'dorian' });
    expect(step('key-mode').done(board({ root: 7, mode: 'dorian' }), start)).toBe(false);
    expect(step('key-mode').done(board({ root: 9, mode: 'dorian' }), start)).toBe(true);
    expect(step('key-mode').done(board({ root: 7, mode: 'aeolian' }), start)).toBe(true);
  });
});

describe('tutorial store', () => {
  beforeEach(() => {
    useTutorialStore.setState({ phase: 'off', solved: false, atStart: null });
  });

  it('opens the welcome card only from off', () => {
    useTutorialStore.getState().showWelcome();
    expect(useTutorialStore.getState().phase).toBe('welcome');
    useTutorialStore.getState().start(idle);
    useTutorialStore.getState().showWelcome();
    expect(useTutorialStore.getState().phase).toEqual({ step: 0 });
  });

  it('start begins at step one and records the seen flag for the session', () => {
    useTutorialStore.getState().start(idle);
    expect(useTutorialStore.getState().phase).toEqual({ step: 0 });
    expect(readSeen()).toBe(true);
  });

  it('observe ignores a board that does not satisfy the step', () => {
    useTutorialStore.getState().start(idle);
    useTutorialStore.getState().observe(idle);
    expect(useTutorialStore.getState().solved).toBe(false);
  });

  it('observe solves the step and next moves on, snapshotting the new start', () => {
    const { start, observe, next } = useTutorialStore.getState();
    start(idle);
    observe(board({ pressedDegrees: new Set([0]) }));
    expect(useTutorialStore.getState().solved).toBe(true);

    const later = board({ root: 5, mode: 'lydian' });
    next(later);
    const state = useTutorialStore.getState();
    expect(state.phase).toEqual({ step: 1 });
    expect(state.solved).toBe(false);
    expect(state.atStart?.root).toBe(5);
    expect(state.atStart?.mode).toBe('lydian');
  });

  it('next does nothing until the step is solved', () => {
    useTutorialStore.getState().start(idle);
    useTutorialStore.getState().next(idle);
    expect(useTutorialStore.getState().phase).toEqual({ step: 0 });
  });

  it('walks all five steps to done', () => {
    const solutions: Partial<BoardSnapshot>[] = [
      { pressedDegrees: new Set([0]) },
      { pressedDegrees: new Set([0]), modifiers: { ...NO_MODIFIERS, minor: true } },
      { pressedDegrees: new Set([0]), modifiers: { ...NO_MODIFIERS, dominant: true } },
      { extraKeys: new Set(['bassRoot']) },
      { root: 2 },
    ];
    useTutorialStore.getState().start(idle);
    solutions.forEach((solution, index) => {
      expect(useTutorialStore.getState().phase).toEqual({ step: index });
      useTutorialStore.getState().observe(board(solution));
      useTutorialStore.getState().next(idle);
    });
    expect(useTutorialStore.getState().phase).toBe('done');
    useTutorialStore.getState().dismiss();
    expect(useTutorialStore.getState().phase).toBe('off');
  });

  it('skip ends the tour from any phase', () => {
    useTutorialStore.getState().showWelcome();
    useTutorialStore.getState().skip();
    expect(useTutorialStore.getState().phase).toBe('off');

    useTutorialStore.getState().start(idle);
    useTutorialStore.getState().observe(board({ pressedDegrees: new Set([0]) }));
    useTutorialStore.getState().skip();
    expect(useTutorialStore.getState().phase).toBe('off');
    expect(useTutorialStore.getState().solved).toBe(false);
  });
});

describe('connectTutorial', () => {
  let disconnect: () => void;

  beforeEach(() => {
    vi.useFakeTimers();
    useAppStore.setState({ pressedDegrees: new Set(), root: 0, mode: 'ionian' });
    useTutorialStore.setState({ phase: 'off', solved: false, atStart: null });
    disconnect = connectTutorial();
  });

  afterEach(() => {
    disconnect();
    vi.useRealTimers();
  });

  it('solves on a board change and advances after the success beat', () => {
    useTutorialStore.getState().start(useAppStore.getState());
    useAppStore.setState({ pressedDegrees: new Set([0]) });
    expect(useTutorialStore.getState().solved).toBe(true);
    expect(useTutorialStore.getState().phase).toEqual({ step: 0 });

    vi.advanceTimersByTime(SUCCESS_BEAT_MS);
    expect(useTutorialStore.getState().phase).toEqual({ step: 1 });
    expect(useTutorialStore.getState().solved).toBe(false);
  });

  it('does not advance if skipped during the beat', () => {
    useTutorialStore.getState().start(useAppStore.getState());
    useAppStore.setState({ pressedDegrees: new Set([0]) });
    useTutorialStore.getState().skip();
    vi.advanceTimersByTime(SUCCESS_BEAT_MS * 2);
    expect(useTutorialStore.getState().phase).toBe('off');
  });
});
