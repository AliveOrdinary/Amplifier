import Link from "next/link";
import { Mono, Wordmark } from "@/components/ui/primitives";

// Holding page for the v2 preview. The public portfolio is rebuilt in phase 5;
// amplifier.studio keeps serving the current site until then.
export default function Home() {
  return (
    <main className="mx-auto flex w-full max-w-[1360px] flex-1 flex-col px-4 sm:px-10">
      <header className="flex h-16 items-center justify-between">
        <Wordmark className="text-2xl" />
        <nav className="flex gap-6 text-[15px]">
          <Link href="/projects" className="hover:text-muted">
            Works
          </Link>
          <Link href="/studio" className="hover:text-muted">
            Studio
          </Link>
        </nav>
      </header>
      <section className="border-b border-ink py-24">
        <Mono className="normal-case tracking-[0.04em]">
          Hello · Bonjour · नमस्ते · നമസ്ക്കാരം · வணக்கம் · హలో · مرحبًا
        </Mono>
        <h1 className="mt-6 max-w-[1100px] text-[clamp(44px,8vw,88px)] font-medium leading-[0.95] tracking-[-0.04em]">
          Branding, typography and illustration.
        </h1>
        <p className="mt-7 max-w-[620px] text-[19px] leading-relaxed text-ink-soft">
          A new site is on the way.
        </p>
      </section>
    </main>
  );
}
