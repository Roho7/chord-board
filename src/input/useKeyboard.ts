'use client';

import { useEffect } from 'react';
import { useAppStore } from '@/state/store';
import { NO_MODIFIERS } from '@/theory/chords';
import {
  degreeForCode,
  extraKeyFor,
  modifierForCode,
  registerStepFor,
  SPREAD_KEY,
} from './keymap';

/**
 * Binds the physical keyboard to the board. Chords are tracked per degree, so a
 * chord ends when its own key lifts — not when any key lifts.
 *
 * The modifiers are live: pressing one bends whatever is already sounding
 * rather than waiting for the next attack.
 */
export function useKeyboard(): void {
  useEffect(() => {
    const {
      attackDegree,
      releaseDegree,
      setModifiers,
      setSustain,
      toggleSpread,
      stepRegister,
      pressExtra,
      releaseExtra,
      panic,
      unlockAudio,
    } = useAppStore.getState();

    /**
     * Caps Lock has no reliable keydown/keyup of its own across platforms, but
     * every key event carries its current state — so read it off whatever the
     * player just pressed. It only updates on the next keystroke, which for a
     * latch is soon enough.
     */
    function readCapsLock(event: KeyboardEvent) {
      setSustain(event.getModifierState('CapsLock'));
    }

    function onKeyDown(event: KeyboardEvent) {
      readCapsLock(event);
      // Auto-repeat would retrigger the chord dozens of times a second.
      if (event.repeat) return;
      if (event.metaKey || event.ctrlKey || event.altKey) return;

      const modifier = modifierForCode(event.code);
      if (modifier) {
        event.preventDefault();
        setModifiers({ [modifier]: true });
        return;
      }

      if (event.code === SPREAD_KEY) {
        event.preventDefault();
        toggleSpread();
        return;
      }

      const step = registerStepFor(event.code);
      if (step !== undefined) {
        event.preventDefault();
        stepRegister(step);
        return;
      }

      const extra = extraKeyFor(event.code);
      if (extra !== undefined) {
        // Space scrolls the page and re-clicks the last focused button otherwise.
        event.preventDefault();
        unlockAudio();
        pressExtra(extra);
        return;
      }

      const degree = degreeForCode(event.code);
      if (degree === undefined) return;

      // Stop the page scrolling or opening quick-find under the player.
      event.preventDefault();
      unlockAudio();
      attackDegree(degree);
    }

    function onKeyUp(event: KeyboardEvent) {
      readCapsLock(event);

      const modifier = modifierForCode(event.code);
      if (modifier) {
        event.preventDefault();
        setModifiers({ [modifier]: false });
        return;
      }

      const extra = extraKeyFor(event.code);
      if (extra !== undefined) {
        event.preventDefault();
        releaseExtra(extra);
        return;
      }

      const degree = degreeForCode(event.code);
      if (degree === undefined) return;
      event.preventDefault();
      releaseDegree(degree);
    }

    // Alt-tabbing away swallows the keyup, which would hang the chord and leave
    // the modifiers stuck down.
    function onBlur() {
      setModifiers(NO_MODIFIERS);
      panic();
    }

    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    window.addEventListener('blur', onBlur);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
      window.removeEventListener('blur', onBlur);
      useAppStore.getState().panic();
    };
  }, []);
}
