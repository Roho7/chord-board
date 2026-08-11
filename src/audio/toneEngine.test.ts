import { beforeEach, describe, expect, it } from 'vitest';
import { createToneEngine, type ToneInstrument } from './toneEngine';

/**
 * A stand-in for Tone's PolySynth that models the behaviour that matters:
 * every attack allocates a voice, and a release only ever kills one voice per
 * pitch. Anything left in `ringing` after all keys are up is a stuck note.
 */
function fakeInstrument() {
  const ringing: string[] = [];
  /** Every note ever struck, so a test can prove a note was NOT re-struck. */
  const attacks: string[] = [];
  /** The velocity each note was last struck at. */
  const velocities = new Map<string, number>();
  /** The instrument's attack at the moment each note was struck. */
  const attackTimes = new Map<string, unknown>();
  const instrument: ToneInstrument = {
    // Samplers expose a settable attack; this stand-in does too.
    attack: 0,
    triggerAttack(names, _time, velocity) {
      attacks.push(...names);
      ringing.push(...names);
      for (const name of names) {
        velocities.set(name, velocity ?? 1);
        attackTimes.set(name, instrument.attack);
      }
    },
    triggerRelease(names) {
      for (const name of names) {
        const index = ringing.indexOf(name);
        if (index !== -1) ringing.splice(index, 1);
      }
    },
    releaseAll() {
      ringing.length = 0;
    },
    dispose() {},
  };
  return { instrument, ringing, attacks, velocities, attackTimes };
}

describe('toneEngine voice bookkeeping', () => {
  let fake: ReturnType<typeof fakeInstrument>;
  let engine: ReturnType<typeof createToneEngine>;

  beforeEach(() => {
    fake = fakeInstrument();
    engine = createToneEngine(fake.instrument);
  });

  it('leaves nothing ringing after two overlapping chords are released', () => {
    // C major and E minor share E4 and G4 — the A/D pads in C ionian.
    const c = engine.noteOn([60, 64, 67], 0.8);
    const e = engine.noteOn([64, 67, 71], 0.8);

    engine.noteOff(c);
    engine.noteOff(e);

    expect(fake.ringing).toEqual([]);
  });

  it('never sounds the same pitch twice', () => {
    engine.noteOn([60, 64, 67], 0.8);
    engine.noteOn([64, 67, 71], 0.8);

    expect(new Set(fake.ringing).size).toBe(fake.ringing.length);
  });

  it('keeps a shared note ringing while the other chord still holds it', () => {
    const c = engine.noteOn([60, 64, 67], 0.8);
    engine.noteOn([64, 67, 71], 0.8);

    engine.noteOff(c);

    expect(fake.ringing).toContain('E4');
    expect(fake.ringing).toContain('G4');
    expect(fake.ringing).not.toContain('C4');
  });

  it('survives fast alternation between two overlapping pads', () => {
    let a = engine.noteOn([60, 64, 67], 0.8);
    for (let i = 0; i < 20; i++) {
      const d = engine.noteOn([64, 67, 71], 0.8);
      engine.noteOff(a);
      a = engine.noteOn([60, 64, 67], 0.8);
      engine.noteOff(d);
    }
    engine.noteOff(a);

    expect(fake.ringing).toEqual([]);
  });

  it('retunes by difference, leaving common tones untouched', () => {
    const voice = engine.noteOn([60, 64, 67], 0.8);
    engine.update(voice, [60, 63, 67]);

    expect(fake.ringing.sort()).toEqual(['C4', 'D#4', 'G4']);

    engine.noteOff(voice);
    expect(fake.ringing).toEqual([]);
  });

  it('handles a voicing that doubles a pitch', () => {
    // A bass note can land on the same pitch as a chord tone.
    const voice = engine.noteOn([60, 60, 64, 67], 0.8);
    expect(fake.ringing.filter((n) => n === 'C4')).toHaveLength(1);

    engine.noteOff(voice);
    expect(fake.ringing).toEqual([]);
  });

  it('trims a chord to its bass without re-striking the bass', () => {
    // What the pedal does: tones stop, the bass note carries on untouched.
    const voice = engine.noteOn([36, 60, 64, 67], 0.8);
    engine.update(voice, [36]);

    expect(fake.ringing).toEqual(['C2']);
    expect(fake.attacks.filter((n) => n === 'C2')).toHaveLength(1);
  });

  it('ties the bass through a chord change that shares it', () => {
    // Pedalling C's bass, then pressing C again: the bass must not re-attack.
    const voice = engine.noteOn([36, 60, 64, 67], 0.8);
    engine.update(voice, [36]);
    engine.update(voice, [36, 60, 64, 67]);

    expect(fake.attacks.filter((n) => n === 'C2')).toHaveLength(1);
    expect(fake.ringing.sort()).toEqual(['C2', 'C4', 'E4', 'G4']);
  });

  it('shares a note another voice already holds, by default', () => {
    engine.noteOn([36, 60, 64, 67], 0.8);
    const pedal = engine.noteOn([36], 0.8);
    expect(fake.attacks.filter((n) => n === 'C2')).toHaveLength(1);

    engine.noteOff(pedal);
    expect(fake.ringing).toContain('C2');
  });

  it('restrike strikes a note even while a chord is holding it', () => {
    // The pedal under a held chord: you must hear the bass articulate.
    const chord = engine.noteOn([36, 60, 64, 67], 0.8);
    const pedal = engine.noteOn([36], 0.8, { restrike: true });

    expect(fake.attacks.filter((n) => n === 'C2')).toHaveLength(2);
    expect(fake.ringing).toContain('C2');

    // And it still cleans up — no hanging voice from the extra strike.
    engine.noteOff(pedal);
    expect(fake.ringing).toContain('C2');
    engine.noteOff(chord);
    expect(fake.ringing).toEqual([]);
  });

  it('restrike on a silent note is an ordinary attack', () => {
    const pedal = engine.noteOn([36], 0.8, { restrike: true });
    expect(fake.attacks.filter((n) => n === 'C2')).toHaveLength(1);

    engine.noteOff(pedal);
    expect(fake.ringing).toEqual([]);
  });

  it('brings a retuned note in at the velocity it is given', () => {
    // A modifier moving one note should bend the chord, not play that note at you.
    const voice = engine.noteOn([60, 64, 67], 0.8);
    engine.update(voice, [60, 63, 67], { velocity: 0.35 });

    expect(fake.velocities.get('D#4')).toBe(0.35);
    // The notes that did not move were never re-struck.
    expect(fake.attacks.filter((n) => n === 'C4')).toHaveLength(1);
    expect(fake.attacks.filter((n) => n === 'G4')).toHaveLength(1);
  });

  it('keeps the voice its own velocity for notes struck later', () => {
    const voice = engine.noteOn([60, 64, 67], 0.8);
    engine.update(voice, [60, 63, 67], { velocity: 0.35 });
    engine.update(voice, [60, 64, 67]);

    expect(fake.velocities.get('E4')).toBe(0.8);
  });

  it('fades a retuned note in, then puts the attack straight back', () => {
    // A sampled piano's hammer is in the recording — turning it down is not
    // enough, it has to be faded past.
    const voice = engine.noteOn([60, 64, 67], 0.8);
    engine.update(voice, [60, 63, 67], { velocity: 0.35, attack: 0.12 });

    expect(fake.attackTimes.get('D#4')).toBe(0.12);
    // Restored, so the next struck chord still hits hard.
    expect(fake.instrument.attack).toBe(0);
  });

  it('leaves the attack alone on an instrument that has none', () => {
    const bare = fakeInstrument();
    delete bare.instrument.attack;
    const synth = createToneEngine(bare.instrument);

    const voice = synth.noteOn([60, 64, 67], 0.8);
    synth.update(voice, [60, 63, 67], { velocity: 0.35, attack: 0.12 });

    expect(bare.instrument.attack).toBeUndefined();
    expect(bare.ringing.sort()).toEqual(['C4', 'D#4', 'G4']);
  });

  it('releaseAll clears bookkeeping so later notes still work', () => {
    engine.noteOn([60, 64, 67], 0.8);
    engine.releaseAll();
    expect(fake.ringing).toEqual([]);

    const next = engine.noteOn([60, 64, 67], 0.8);
    expect(fake.ringing.sort()).toEqual(['C4', 'E4', 'G4']);

    engine.noteOff(next);
    expect(fake.ringing).toEqual([]);
  });
});
