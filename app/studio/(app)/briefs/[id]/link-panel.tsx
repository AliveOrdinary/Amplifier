"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Button, Mono } from "@/components/ui/primitives";
import { archiveBrief, deleteBrief, extendLink, markSent } from "../actions";

const day = (iso: string) => new Date(iso).toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" });

export function LinkPanel({
  briefId,
  url,
  status,
  expiresAt,
  expired,
  readiness,
  timeline,
}: {
  briefId: string;
  url: string;
  status: string;
  expiresAt: string | null;
  expired: boolean;
  readiness: { approved: number; inMedium: number | null; untestable: string[] } | null;
  timeline: [string, string | null][];
}) {
  const [copied, setCopied] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const router = useRouter();

  const run = (fn: () => Promise<{ ok: boolean; error?: string } | void>) =>
    start(async () => {
      const r = await fn();
      setError(r && !r.ok ? (r.error ?? "Something went wrong.") : null);
      if (r?.ok) router.refresh();
    });

  async function copy() {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
      if (status === "draft") run(() => markSent(briefId));
    } catch {
      setError("Couldn't copy. Select the link and copy it by hand.");
    }
  }

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap gap-2">
        <label htmlFor="brief-link" className="sr-only">
          Brief link
        </label>
        <input
          id="brief-link"
          readOnly
          value={url}
          onFocus={(e) => e.currentTarget.select()}
          className="h-11 min-w-0 flex-[1_1_320px] border border-rule-strong bg-transparent px-3 font-mono text-[13px] text-ink-soft focus:border-ink focus:outline-none"
        />
        <Button variant="primary" onClick={copy}>
          {copied ? "Copied" : "Copy link"}
        </Button>
        <a href={url} target="_blank" rel="noreferrer" className="inline-flex h-11 items-center px-3 text-[15px] underline-offset-2 hover:underline">
          Open
        </a>
      </div>
      <p className="-mt-2 text-sm text-muted">
        Opening it yourself starts the brief as if you were the client. Use it to try a brief out, then delete that one.
      </p>

      {readiness && (readiness.approved < 60 || readiness.untestable.length) ? (
        <div className="flex items-start gap-2 text-sm text-ink-soft">
          <span aria-hidden className="mt-1.5 size-2 shrink-0 bg-signal" />
          <p>
            The library has {readiness.approved} approved images
            {readiness.inMedium !== null ? `, ${readiness.inMedium} in this project's medium` : ""}.
            {readiness.untestable.length
              ? ` Too few clear examples at both ends to test: ${readiness.untestable.join(", ")}.`
              : ""}{" "}
            The brief still works, with fewer pairs. Approving more images before the client starts helps.
          </p>
        </div>
      ) : null}

      <dl className="grid grid-cols-2 gap-x-6 gap-y-3 sm:grid-cols-5">
        {timeline.map(([label, at]) => (
          <div key={label}>
            <dt>
              <Mono>{label}</Mono>
            </dt>
            <dd className="mt-0.5 text-[15px]">{at ? day(at) : "–"}</dd>
          </div>
        ))}
        <div>
          <dt>
            <Mono>{expired ? "Expired" : "Expires"}</Mono>
          </dt>
          <dd className="mt-0.5 text-[15px]">{expiresAt ? day(expiresAt) : "Never"}</dd>
        </div>
      </dl>

      <div className="flex flex-wrap items-center gap-2 border-t border-rule pt-4">
        <Button size="sm" variant="ghost" disabled={pending} onClick={() => run(() => extendLink(briefId))}>
          Extend 30 days
        </Button>
        <Button size="sm" variant="ghost" disabled={pending} onClick={() => run(() => archiveBrief(briefId, status !== "archived"))}>
          {status === "archived" ? "Reopen" : "Archive"}
        </Button>
        {confirmDelete ? (
          <>
            <span className="text-sm text-danger">Delete the brief and everything the client did?</span>
            <Button size="sm" className="border-danger text-danger" disabled={pending} onClick={() => run(() => deleteBrief(briefId))}>
              Delete
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setConfirmDelete(false)}>
              Cancel
            </Button>
          </>
        ) : (
          <Button size="sm" variant="ghost" onClick={() => setConfirmDelete(true)}>
            Delete…
          </Button>
        )}
      </div>
      {error ? (
        <p role="alert" className="text-sm text-danger">
          {error}
        </p>
      ) : null}
    </div>
  );
}
