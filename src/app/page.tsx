import { ChordBoard } from '@/components/ChordBoard';
import { SynthPanel } from '@/components/SynthPanel';

export default function Page() {
  return (
    // Two halves: the board you play, and the synth you shape. The panel scrolls
    // on its own so the pads never leave the screen.
    <main className="mx-auto flex h-full w-full max-w-[1600px] flex-col">
      <section className="flex flex-col gap-8 px-4 py-6 sm:px-8">
        <header className="flex flex-wrap items-baseline justify-between gap-4">
          <h1 className="text-2xl font-extrabold tracking-[0.3em] uppercase">Chord Board</h1>
          <p className="font-mono text-xs tracking-[0.2em] text-bone-dim uppercase">
            A S D F · Q W E R — colour with I O P J K L . [ — space doubles, ; &apos; bass, 1 2 3 latch
          </p>
        </header>

        <ChordBoard />
      </section>

      <section className="min-h-0 flex-1 overflow-y-auto border-t border-ink-edge px-4 py-6 sm:px-8">
        <SynthPanel />
      </section>
    </main>
  );
}
