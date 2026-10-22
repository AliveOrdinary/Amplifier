"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/primitives";
import { prepareReport } from "../../actions";

/** Writes the report the first time the prep page is opened (if it wasn't ready already). */
export function PrepareReport({ briefId, partial }: { briefId: string; partial: boolean }) {
  const router = useRouter();
  const [state, setState] = useState<"idle" | "working" | "error">(partial ? "idle" : "working");
  const [error, setError] = useState<string | null>(null);
  const started = useRef(false);

  const run = async () => {
    setState("working");
    const r = await prepareReport(briefId);
    if (!r.ok) {
      setError(r.error);
      return setState("error");
    }
    router.refresh();
  };

  useEffect(() => {
    if (partial || started.current) return;
    started.current = true;
    void run();
    // Runs once on open; `run` is stable enough for that.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="mt-10 max-w-xl">
      {state === "working" ? (
        <p className="flex items-center gap-3 text-[17px] text-ink-soft" aria-live="polite">
          <span aria-hidden className="size-2 animate-pulse rounded-full bg-signal" />
          Reading their answers against their choices. This takes about half a minute.
        </p>
      ) : (
        <>
          <p className="text-[17px] text-ink-soft">
            {state === "error"
              ? `Couldn't write the prep page: ${error}`
              : "The client hasn't finished, but there's enough to go on. Prepare the page from what they've done so far?"}
          </p>
          <Button variant="primary" className="mt-5" onClick={run}>
            {state === "error" ? "Try again" : "Prepare from what's done"}
          </Button>
        </>
      )}
    </div>
  );
}
