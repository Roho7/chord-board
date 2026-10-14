import { ChordBoard } from '@/components/ChordBoard';
import Image from 'next/image';
import { SelectorDrawers } from '@/components/SelectorDrawers';

export default function Page() {
  return (
    // The pads sit at the top and never move. Everything else — legend, scale,
    // synth — shares the space underneath, one tab at a time. The header floats
    // over the lot, so the top padding is the room it needs.
    <main className="mx-auto flex h-full w-full max-w-[1600px] flex-col px-4 pt-20 pb-8 sm:px-8 phone:pb-4 phone-landscape:px-4 phone-landscape:pt-16 phone-landscape:pb-3">
      <header className="pointer-events-none fixed inset-x-0 top-0 z-20 flex justify-center p-4 phone-landscape:p-2.5">
        <div className="pointer-events-auto flex items-center gap-2.5 rounded-full border border-ink-edge bg-ink-raised/80 py-1.5 pr-4 pl-3 shadow-[0_8px_32px_rgba(0,0,0,0.45)] backdrop-blur phone:py-1 phone:pr-1">
          <h1 className="text-sm font-extrabold tracking-[0.08em] text-bone">Jammune</h1>
          {/* Decorative: the name either side of it already says what this is. */}
          <Image src="/logo.png" alt="" width={242} height={446} priority className="h-5 w-auto" />
          <span className="font-mono text-[0.7rem] font-bold tracking-[0.35em] text-bone-dim uppercase phone-portrait:hidden">
            Chord Board
          </span>
          {/* Phones keep key, mode and sound up here, a drawer each. */}
          <div className="hidden items-center gap-2.5 phone:flex">
            <span aria-hidden className="h-4 w-px bg-white/10" />
            <SelectorDrawers />
          </div>
        </div>
      </header>

      <ChordBoard />

      {/* Fixed and tiny, so it costs the playing surface nothing on a phone. */}
      <footer className="pointer-events-none fixed inset-x-0 bottom-0 z-10 flex justify-center pb-1 font-mono text-[0.6rem] tracking-[0.15em] text-bone-dim/50 phone:pb-0.5 phone:text-[0.5rem] phone:tracking-[0.1em] phone:text-bone-dim/30">
        <p>
          Built by{' '}
          <a
            href="https://github.com/Roho7"
            target="_blank"
            rel="noopener noreferrer"
            className="pointer-events-auto text-bone-dim underline-offset-2 phone:text-bone-dim/60 hover:text-bone hover:underline"
          >
            Roho
          </a>
        </p>
      </footer>
    </main>
  );
}
