import Link from "next/link";
import { Suspense, type ReactNode } from "react";
import { getMember } from "@/lib/auth";
import { Mono, Wordmark } from "@/components/ui/primitives";
import { signOut } from "../auth/actions";
import { NavLinks, StudioNav } from "./studio-nav";
import { SpendingAlert } from "./spending-alert";
import { RouteSkeleton } from "./skeletons";

export default function StudioLayout({ children }: LayoutProps<"/studio">) {
  return (
    <div className="flex min-h-full flex-1 flex-col">
      <header className="sticky top-0 z-40 border-b border-rule bg-paper/90 backdrop-blur-md">
        {/* Phones: wordmark and account on top, the sections underneath. */}
        <div className="studio-header-row mx-auto flex w-full max-w-[1360px] flex-wrap items-center gap-x-8 px-4 sm:min-h-14 sm:px-10">
          <Link href="/studio/briefs" className="flex items-baseline gap-2.5 py-3.5 sm:py-0">
            <Wordmark className="text-[17px]" />
            <Mono className="text-[11px]">Studio</Mono>
          </Link>
          <div className="order-last -mx-4 w-[calc(100%+2rem)] overflow-x-auto px-4 sm:order-none sm:mx-0 sm:w-auto sm:overflow-visible sm:px-0">
            <Suspense fallback={<NavLinks pathname={null} />}>
              <StudioNav />
            </Suspense>
          </div>
          <div className="ml-auto">
            <Suspense fallback={<span className="block size-[30px]" />}>
              <Account />
            </Suspense>
          </div>
        </div>
      </header>

      <Suspense fallback={null}>
        <SpendingAlert />
      </Suspense>

      <main className="flex min-h-0 flex-1 flex-col">
        <Suspense fallback={<RouteSkeleton />}>
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
