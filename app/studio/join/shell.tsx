import type { ReactNode } from "react";
import { Mono, Wordmark } from "@/components/ui/primitives";

/** The same quiet frame as the sign-in page. */
export function JoinShell({ title, lead, children }: { title: string; lead: string; children: ReactNode }) {
  return (
    <main className="flex min-h-full flex-1 flex-col">
      <header className="flex h-14 items-center justify-between px-4 sm:px-10">
        <Wordmark className="text-[17px]" />
        <Mono>Studio</Mono>
      </header>
      <div className="flex flex-1 items-start justify-center px-4 pt-[12vh] pb-16">
        <div className="w-full max-w-[400px]">
          <p className="mb-5 font-mono text-[12px] tracking-[0.08em] text-muted uppercase">00 / Studio</p>
          <h1 className="text-[clamp(44px,7vw,64px)] leading-[0.92] font-medium tracking-[-0.035em]">{title}</h1>
          <p className="mt-4 text-[17px] text-ink-soft">{lead}</p>
          <div className="mt-10 border-t border-rule pt-8">{children}</div>
        </div>
      </div>
    </main>
  );
}
