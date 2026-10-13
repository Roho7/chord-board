'use client';

import type { ReactNode } from 'react';
import {
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerHeader,
  DrawerTitle,
  DrawerTrigger,
} from '@/components/ui/drawer';
import { useAppStore } from '@/state/store';
import { noteName } from '@/theory/notes';
import { accidentalForKey, MODE_LABELS } from '@/theory/scales';
import { INSTRUMENTS, KeyWheel, ModeWheel, SoundWheel, WheelHost } from './WheelRack';

/**
 * Phones have no room for the wheels beside the pads, so each one waits in a
 * drawer behind a round button in the header. The button shows the current
 * value, so a glance tells you where you are without opening anything.
 */
export function SelectorDrawers() {
  const root = useAppStore((s) => s.root);
  const mode = useAppStore((s) => s.mode);
  const instrument = useAppStore((s) => s.instrument);

  const instrumentLabel = INSTRUMENTS.find((i) => i.name === instrument)?.label ?? instrument;

  return (
    <div className="flex items-center gap-1.5">
      <SelectorDrawer title="Key" face={noteName(root, accidentalForKey(root, mode))}>
        <KeyWheel />
      </SelectorDrawer>
      <SelectorDrawer title="Mode" face={MODE_LABELS[mode].slice(0, 3)}>
        <ModeWheel />
      </SelectorDrawer>
      <SelectorDrawer title="Sound" face={instrumentLabel.slice(0, 3)}>
        <SoundWheel />
      </SelectorDrawer>
    </div>
  );
}

function SelectorDrawer({ title, face, children }: { title: string; face: string; children: ReactNode }) {
  return (
    <Drawer>
      <DrawerTrigger
        aria-label={`${title}: ${face}. Change ${title.toLowerCase()}`}
        className="flex size-8 items-center justify-center rounded-full border border-white/10 bg-ink/60 font-mono text-[0.6rem] font-bold text-bone uppercase transition-colors active:bg-accent"
      >
        {face}
      </DrawerTrigger>
      <DrawerContent className="mx-auto max-w-md border-white/10 pb-[max(1.5rem,env(safe-area-inset-bottom))]">
        <DrawerHeader className="pb-2">
          <DrawerTitle className="font-mono text-[0.65rem] font-normal tracking-[0.3em] text-bone-dim uppercase">
            {title}
          </DrawerTitle>
          <DrawerDescription className="sr-only">Drag or scroll the wheel to choose.</DrawerDescription>
        </DrawerHeader>
        {/* No-drag: swiping the wheel turns it rather than pulling the drawer down. */}
        <div data-vaul-no-drag className="mx-auto w-48">
          <WheelHost rows={5}>{children}</WheelHost>
        </div>
      </DrawerContent>
    </Drawer>
  );
}
