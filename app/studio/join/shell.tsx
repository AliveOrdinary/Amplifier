import type { ReactNode } from "react";
import { Mono, Wordmark } from "@/components/ui/primitives";

/** The same quiet frame as the sign-in page. */
export function JoinShell({ title, lead, children }: { title: string; lead: string; children: ReactNode }) {
  return (
    <main className="flex min-h-full flex-1 flex-col">
      <header className="flex h-14 items-center justify-between px-4 sm:px-10">
        <Wordmark className="text-[19px]" />
        <Mono>Studio</Mono>
      </header>
      <div className="flex flex-1 items-start justify-center px-4 pt-[12vh] pb-16">
        <div className="w-full max-w-[380px]">
          <h1 className="text-[32px] font-medium leading-tight tracking-[-0.02em]">{title}</h1>
          <p className="mt-2 text-[15px] text-muted">{lead}</p>
          <div className="mt-8 border-t border-ink pt-8">{children}</div>
        </div>
      </div>
    </main>
  );
}
