"use client";

import { useEffect } from "react";
import { Button, PageContainer } from "@/components/ui/primitives";

/** Keeps the studio header and explains what to try when a page fails. */
export default function StudioError({ error, retry }: { error: unknown; retry: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <PageContainer>
      <div className="max-w-xl rounded-[28px] border border-rule-strong p-8">
        <h1 className="text-2xl font-medium">This page couldn&apos;t load</h1>
        <p className="mt-3 text-[15px] leading-relaxed text-ink-soft">
          Try again in a moment. If it keeps happening after an update, check that every file in{" "}
          <code className="font-mono text-sm">supabase/migrations</code> has been run in Supabase.
        </p>
        <Button className="mt-6" onClick={() => retry()}>
          Try again
        </Button>
      </div>
    </PageContainer>
  );
}
