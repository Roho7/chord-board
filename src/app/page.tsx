import { ChordBoard } from '@/components/ChordBoard';

export default function Page() {
  return (
    // The pads sit at the top and never move. Everything else — legend, scale,
    // synth — shares the space underneath, one tab at a time. The header floats
    // over the lot, so the top padding is the room it needs.
    <main className="mx-auto flex h-full w-full max-w-[1600px] flex-col px-4 pt-20 pb-8 sm:px-8">
      <header className="pointer-events-none fixed inset-x-0 top-0 z-20 flex justify-center p-4">
        <div className="pointer-events-auto flex items-center gap-2.5 rounded-full border border-ink-edge bg-ink-raised/80 py-1.5 pr-4 pl-3 shadow-[0_8px_32px_rgba(0,0,0,0.45)] backdrop-blur">
          <span aria-hidden className="size-1.5 rounded-full bg-accent-soft shadow-[0_0_10px_var(--color-accent)]" />
          <h1 className="font-mono text-[0.7rem] font-bold tracking-[0.35em] text-bone uppercase">
            Chord Board
          </h1>
        </div>
      </header>

      <ChordBoard />
    </main>
  );
}
