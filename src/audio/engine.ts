'use client';

import type { Midi } from '@/theory/notes';

export type InstrumentName = 'synth' | 'organ' | 'piano' | 'guitar';

/** Opaque token identifying one sounding chord. */
export interface VoiceHandle {
  readonly id: number;
  readonly notes: Midi[];
}

export interface NoteOnOptions {
  /**
   * Strike the notes even if another voice is already holding them, so the
   * attack is heard. Without this a note already ringing is silently shared.
   */
  restrike?: boolean;
}

export interface UpdateOptions {
  /**
   * Velocity for notes the update brings in. A modifier moving one note of a
   * held chord should sound like the chord bending, not like that note being
   * played — so it comes in softer than the strike that started the chord.
   */
  velocity?: number;
  /**
   * Fade-in for those notes, in seconds. Velocity alone cannot hide a sampled
   * piano's hammer: the transient is in the recording, so it has to be faded
   * past rather than turned down. Ignored by instruments with no attack of
   * their own — the synth's envelope stays whatever the panel says.
   */
  attack?: number;
}

export interface AudioEngine {
  noteOn(notes: Midi[], velocity: number, options?: NoteOnOptions): VoiceHandle;
  noteOff(handle: VoiceHandle): void;
  /**
   * Change which notes a sounding voice holds, releasing and attacking only the
   * difference. Lets a held chord follow the modifier keys without re-striking —
   * the chord bends rather than restarting.
   */
  update(handle: VoiceHandle, notes: Midi[], options?: UpdateOptions): void;
  releaseAll(): void;
  dispose(): void;
}
