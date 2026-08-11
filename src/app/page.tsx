import { ChordBoard } from '@/components/ChordBoard';

export default function Page() {
  return (
    // The pads sit at the top and never move. Everything else — legend, scale,
    // synth — shares the space underneath, one tab at a time.
    <main className="mx-auto flex h-full w-full max-w-[1600px] flex-col px-4 py-6 sm:px-8">
      <header className="flex flex-wrap items-baseline justify-between gap-4 pb-8">
        <h1 className="text-2xl font-extrabold tracking-[0.3em] uppercase">Chord Board</h1>
        <p className="font-mono text-xs tracking-[0.2em] text-bone-dim uppercase">
          A S D F · Q W E R — colour with I O P J K L . [ — space doubles, ; &apos; bass, 1 2 3 latch
        </p>
      </header>

      <ChordBoard />
    </main>
  );
}
