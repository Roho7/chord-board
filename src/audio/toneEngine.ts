'use client';

import { midiToNoteName, type Midi } from '@/theory/notes';
import type { AudioEngine, NoteOnOptions, UpdateOptions, VoiceHandle } from './engine';

/** The slice of Tone's instruments this app actually uses. */
export interface ToneInstrument {
  triggerAttack(notes: string[], time?: number, velocity?: number): unknown;
  triggerRelease(notes: string[], time?: number): unknown;
  releaseAll?(time?: number): unknown;
  dispose(): unknown;
  /**
   * Envelope fade-in, read at `triggerAttack` time. Loosely typed because Tone
   * declares it as a `Time`: we only ever set a number and put back whatever
   * was there. Samplers expose one; PolySynth does not, which is exactly why
   * softening reaches only the sampled instruments.
   */
  attack?: number | string | object;
}

let nextId = 1;

/**
 * Wraps a Tone instrument in the engine interface. Tracks its own sounding
 * voices so `releaseAll` can silence the instrument even when the caller has
 * lost the handles — switching instruments mid-chord otherwise hangs notes forever.
 */
export function createToneEngine(instrument: ToneInstrument): AudioEngine {
  interface Sounding {
    names: string[];
    velocity: number;
  }
  const sounding = new Map<number, Sounding>();

  /**
   * How many voices are holding each note.
   *
   * Tone's PolySynth allocates a fresh voice on *every* `triggerAttack`, while
   * `triggerRelease` only releases the first unreleased voice for that pitch. So
   * attacking a note twice and releasing it once leaves one sounding forever.
   * Two chords sharing a tone — A and D share two — would do exactly that.
   *
   * Counting owners keeps it to one voice per pitch: attack only on the first
   * claim, release only when the last one lets go.
   */
  const owners = new Map<string, number>();

  /** Claim notes, returning the ones that were not already sounding. */
  function claim(names: string[]): string[] {
    const fresh: string[] = [];
    for (const name of names) {
      const count = owners.get(name) ?? 0;
      if (count === 0) fresh.push(name);
      owners.set(name, count + 1);
    }
    return fresh;
  }

  /** Give up notes, returning the ones nothing else is holding. */
  function relinquish(names: string[]): string[] {
    const dead: string[] = [];
    for (const name of names) {
      const count = (owners.get(name) ?? 1) - 1;
      if (count <= 0) {
        owners.delete(name);
        dead.push(name);
      } else {
        owners.set(name, count);
      }
    }
    return dead;
  }

  return {
    noteOn(notes: Midi[], velocity: number, options?: NoteOnOptions): VoiceHandle {
      const names = notes.map((n) => midiToNoteName(n));
      const handle: VoiceHandle = { id: nextId++, notes: [...notes] };
      sounding.set(handle.id, { names, velocity });

      const fresh = claim(names);
      if (!options?.restrike) {
        if (fresh.length > 0) instrument.triggerAttack(fresh, undefined, velocity);
        return handle;
      }

      // Re-articulate: let go of what was already ringing so the new attack is
      // an audible strike rather than a silent share. The released voice is
      // marked released on Tone's side, so it fades out and cannot hang.
      const alreadyRinging = names.filter((name) => !fresh.includes(name));
      if (alreadyRinging.length > 0) instrument.triggerRelease(alreadyRinging);
      instrument.triggerAttack(names, undefined, velocity);
      return handle;
    },

    noteOff(handle: VoiceHandle) {
      const voice = sounding.get(handle.id);
      if (!voice) return;
      sounding.delete(handle.id);

      const dead = relinquish(voice.names);
      if (dead.length > 0) instrument.triggerRelease(dead);
    },

    update(handle: VoiceHandle, notes: Midi[], options?: UpdateOptions) {
      const voice = sounding.get(handle.id);
      if (!voice) return;

      const next = notes.map((n) => midiToNoteName(n));
      // Claim before relinquishing, so a note in both sets never dips to zero
      // owners and is left ringing untouched.
      const fresh = claim(next);
      const dead = relinquish(voice.names);
      voice.names = next;

      if (dead.length > 0) instrument.triggerRelease(dead);
      if (fresh.length === 0) return;

      // Keep the voice's own velocity for later strikes; only this attack is softened.
      const velocity = options?.velocity ?? voice.velocity;
      const struck = instrument.attack;
      const soften = options?.attack !== undefined && struck !== undefined;

      if (soften) instrument.attack = options!.attack;
      instrument.triggerAttack(fresh, undefined, velocity);
      // Put it straight back: the next struck chord must still hit hard.
      if (soften) instrument.attack = struck;
    },

    releaseAll() {
      sounding.clear();
      owners.clear();
      instrument.releaseAll?.();
    },

    dispose() {
      sounding.clear();
      owners.clear();
      instrument.dispose();
    },
  };
}
