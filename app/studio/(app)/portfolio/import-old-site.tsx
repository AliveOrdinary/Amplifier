"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { CRUMS } from "@/lib/portfolio/legacy";
import { Button } from "@/components/ui/primitives";
import { finishCrumsImport, startCrumsImport } from "./actions";
import { uploadFile } from "./upload";

/**
 * Brings Crums over from the old site: its text as a draft, then its six
 * files, fetched from this site and uploaded like any other.
 */
export function ImportOldSite() {
  const router = useRouter();
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function run() {
    setBusy(true);
    setError(null);
    try {
      setStatus("Creating the project…");
      const started = await startCrumsImport();
      if (!started.ok) throw new Error(started.error);

      let cover: string | null = null;
      const withSound: string[] = [];
      const blocks: string[] = [];
      for (const [i, f] of CRUMS.files.entries()) {
        setStatus(`Copying file ${i + 1} of ${CRUMS.files.length}: ${f.file}`);
        const response = await fetch(`${CRUMS.folder}${f.file}`);
        if (!response.ok) throw new Error(`Couldn't read ${f.file} from the old site (${response.status}).`);
        const blob = new Blob([await response.blob()], { type: f.type });
        const id = await uploadFile(started.id, blob);
        if (f.role === "cover") cover = id;
        else blocks.push(id);
        if (f.hasAudio) withSound.push(id);
      }

      setStatus("Laying out the case study…");
      const finished = await finishCrumsImport(started.id, { cover, withSound, blocks });
      if (!finished.ok) throw new Error(finished.error);
      router.push(`/studio/portfolio/${started.id}`);
    } catch (e) {
      setError(
        `${e instanceof Error ? e.message : "The import stopped."} If Crums now shows above, open it to finish by hand, or delete it and try again.`,
      );
      setStatus(null);
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-col items-start gap-3">
      <div className="flex w-full flex-wrap items-center gap-x-6 gap-y-3 border-b border-rule pb-4">
        <div className="min-w-0 flex-1 basis-64">
          <p className="text-[16px]">Crums</p>
          <p className="text-sm text-muted">
            {CRUMS.year} · {CRUMS.services.length} services · its write-up, 3 images and 3 videos
          </p>
        </div>
        <Button onClick={run} disabled={busy}>
          {busy ? "Bringing it over…" : "Bring Crums over"}
        </Button>
      </div>
      <p role="status" className="text-sm text-ink-soft">
        {status ?? "Arrives as a draft, featured, at the top of the list. About 55 MB of files: give it a minute."}
      </p>
      {error ? (
        <p role="alert" className="text-sm text-danger">
          {error}
        </p>
      ) : null}
    </div>
  );
}
