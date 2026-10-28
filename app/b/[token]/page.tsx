import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { createAdminClient } from "@/lib/supabase/admin";
import { briefByToken, currentStep } from "@/lib/brief/store";
import { Wordmark } from "@/components/ui/primitives";
import { BriefFlow } from "./brief-flow";

// The last answer also writes the prep page's report, in the background.
export const maxDuration = 120;

export const metadata: Metadata = {
  title: "Visual brief",
  robots: { index: false, follow: false },
};

export default function BriefPage({ params }: PageProps<"/b/[token]">) {
  return (
    <div className="flex min-h-dvh flex-1 flex-col">
      <Suspense
        fallback={
          <header className="mx-auto flex h-14 w-full max-w-5xl items-center px-4 sm:px-6">
            <Wordmark className="text-[19px]" />
          </header>
        }
      >
        <Brief params={params} />
      </Suspense>
    </div>
  );
}

async function Brief({ params }: Pick<PageProps<"/b/[token]">, "params">) {
  const { token } = await params;
  const db = createAdminClient();
  const brief = await briefByToken(db, token);
  if (!brief) notFound();
  const { step, progress } = await currentStep(db, brief);
  return <BriefFlow token={token} initialStep={step} initialProgress={progress} />;
}
