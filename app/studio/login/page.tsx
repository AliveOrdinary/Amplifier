import type { Metadata } from "next";
import { Suspense } from "react";
import { Mono, Wordmark } from "@/components/ui/primitives";
import { safeNext } from "@/lib/auth";
import { LoginForm } from "./login-form";

export const metadata: Metadata = { title: "Sign in" };

const notices: Record<string, string> = {
  "not-member": "That account isn't part of the studio. Ask a studio member to add you.",
};

export default function LoginPage({ searchParams }: PageProps<"/studio/login">) {
  return (
    <main className="flex min-h-full flex-1 flex-col">
      <header className="flex h-14 items-center justify-between px-4 sm:px-10">
        <Wordmark className="text-[17px]" />
        <Mono>Studio</Mono>
      </header>

      <div className="flex flex-1 items-start justify-center px-4 pt-[12vh] pb-16">
        <div className="w-full max-w-[400px]">
          <p className="mb-5 font-mono text-[12px] tracking-[0.08em] text-muted uppercase">00 / Studio</p>
          <h1 className="text-[clamp(44px,7vw,64px)] leading-[0.92] font-medium tracking-[-0.035em]">Sign in</h1>
          <p className="mt-4 text-[17px] text-ink-soft">For Amplifier studio members.</p>
          <div className="mt-10 border-t border-rule pt-8">
            <Suspense fallback={<LoginForm next="/studio" />}>
              <LoginFormWithParams searchParams={searchParams} />
            </Suspense>
          </div>
        </div>
      </div>
    </main>
  );
}

async function LoginFormWithParams({
  searchParams,
}: {
  searchParams: PageProps<"/studio/login">["searchParams"];
}) {
  const params = await searchParams;
  const error = typeof params.error === "string" ? params.error : undefined;
  return <LoginForm next={safeNext(params.next)} notice={error ? notices[error] : undefined} />;
}
