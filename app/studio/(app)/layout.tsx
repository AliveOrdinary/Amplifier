import Link from "next/link";
import { Suspense, type ReactNode } from "react";
import { getMember } from "@/lib/auth";
import { Mono, Wordmark } from "@/components/ui/primitives";
import { signOut } from "../auth/actions";
import { StudioNav } from "./studio-nav";

export default function StudioLayout({ children }: LayoutProps<"/studio">) {
  return (
    <div className="flex min-h-full flex-1 flex-col">
      <header className="sticky top-0 z-40 border-b border-rule bg-paper">
        <div className="mx-auto flex min-h-14 w-full max-w-[1360px] flex-wrap items-center gap-x-8 px-4 sm:px-10">
          <Link href="/studio/briefs" className="flex items-baseline gap-2.5">
            <Wordmark className="text-[19px]" />
            <Mono>Studio</Mono>
          </Link>
          <StudioNav />
          <div className="ml-auto">
            <Suspense fallback={<span className="block size-[30px]" />}>
              <Account />
            </Suspense>
          </div>
        </div>
      </header>

      <main className="flex min-h-0 flex-1 flex-col">
        <Suspense fallback={<PageSkeleton />}>
          <RequireMember>{children}</RequireMember>
        </Suspense>
      </main>
    </div>
  );
}

async function RequireMember({ children }: { children: ReactNode }) {
  await getMember();
  return children;
}

async function Account() {
  const member = await getMember();
  const name = member.displayName ?? member.email ?? "Member";
  const initials = name
    .split(/[\s@.]+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]!.toUpperCase())
    .join("");

  return (
    <div className="flex items-center gap-4">
      <form action={signOut}>
        <button type="submit" className="text-sm text-muted hover:text-ink">
          Sign out
        </button>
      </form>
      <span
        title={name}
        aria-label={`Signed in as ${name}`}
        className="flex size-[30px] items-center justify-center rounded-full bg-ink font-mono text-[11px] text-paper"
      >
        {initials}
      </span>
    </div>
  );
}

function PageSkeleton() {
  return (
    <div aria-hidden className="mx-auto w-full max-w-[1360px] animate-pulse px-4 pt-8 sm:px-10">
      <div className="h-3 w-40 bg-panel" />
      <div className="mt-4 h-12 w-72 bg-panel" />
      <div className="mt-6 h-px bg-rule" />
    </div>
  );
}
