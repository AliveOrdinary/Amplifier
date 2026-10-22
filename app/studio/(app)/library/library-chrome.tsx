"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { useEffect, useId, useRef, useState } from "react";
import { ACCEPTED_TYPES } from "@/lib/library/constants";
import { Button, Mono, cn } from "@/components/ui/primitives";
import { useLibrary } from "./library-provider";

/** Tabs on the left, adding images on the right. */
export function LibraryBar() {
  const pathname = usePathname();
  const { images } = useLibrary();

  const toReview = images.filter((i) => i.ready && i.status === "pending").length;
  const approved = images.filter((i) => i.status === "approved").length;
  const tabs = [
    { href: "/studio/library", label: "Review", count: toReview },
    { href: "/studio/library/browse", label: "Browse", count: approved },
    { href: "/studio/library/coverage", label: "Coverage", count: null },
  ];

  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-3 border-b border-rule px-4 py-2.5 sm:px-6">
      <nav aria-label="Library" className="flex gap-1">
        {tabs.map((tab) => {
          const active = pathname === tab.href;
          return (
            <Link
              key={tab.href}
              href={tab.href}
              aria-current={active ? "page" : undefined}
              className={cn(
                "flex h-8 items-center px-3 text-sm",
                active ? "bg-ink text-paper" : "text-muted hover:text-ink",
              )}
            >
              {tab.label}
              {tab.count !== null ? <span className="ml-1.5 font-mono text-xs opacity-80">{tab.count}</span> : null}
            </Link>
          );
        })}
      </nav>

      <div className="ml-auto flex min-w-0 flex-[1_1_420px] items-center justify-end gap-2">
        <UploadStatus />
        <Mono className="hidden xl:inline">Drop or paste anywhere</Mono>
        <AddControls />
      </div>
    </div>
  );
}

/**
 * Upload button and link field. Compact in the library bar; large in the
 * centre of an empty screen.
 */
export function AddControls({ large = false }: { large?: boolean }) {
  const { addFiles, addLink } = useLibrary();
  const input = useRef<HTMLInputElement>(null);
  const [link, setLink] = useState("");
  const id = useId();

  return (
    <div className={cn("flex min-w-0 items-center gap-2", large ? "w-full flex-col sm:flex-row" : "max-w-[460px] flex-1")}>
      <form
        className="flex w-full min-w-0 flex-1"
        onSubmit={(e) => {
          e.preventDefault();
          if (!link.trim()) return;
          addLink(link.trim());
          setLink("");
        }}
      >
        <label htmlFor={id} className="sr-only">
          Add an image or page link
        </label>
        <input
          id={id}
          type="url"
          inputMode="url"
          placeholder="Paste an image or Pinterest link"
          value={link}
          onChange={(e) => setLink(e.target.value)}
          className={cn(
            "w-full min-w-0 border border-rule-strong bg-transparent text-ink placeholder:text-muted focus:border-ink focus:outline-none",
            large ? "h-12 px-3.5 text-[15px]" : "h-9 px-2.5 text-sm",
          )}
        />
        {large ? (
          <Button type="submit" className="ml-2 h-12">
            Add
          </Button>
        ) : null}
      </form>
      <Button
        variant="primary"
        size={large ? "md" : "sm"}
        className={large ? "h-12 w-full px-6 sm:w-auto" : undefined}
        onClick={() => input.current?.click()}
      >
        {large ? "Upload images" : "Upload"}
      </Button>
      <input
        ref={input}
        type="file"
        accept={ACCEPTED_TYPES.join(",")}
        multiple
        hidden
        onChange={(e) => {
          addFiles(Array.from(e.target.files ?? []));
          e.target.value = "";
        }}
      />
    </div>
  );
}

const JOB_LABEL = {
  uploading: "Uploading",
  scoring: "Scoring",
  done: "Added",
  duplicate: "Skipped",
  error: "Failed",
} as const;

/** "Adding 3…" in the library bar; opens the list of recent additions. */
function UploadStatus() {
  const { jobs, clearJobs } = useLibrary();
  const [open, setOpen] = useState(false);
  if (!jobs.length) return null;

  const active = jobs.filter((j) => j.state === "uploading" || j.state === "scoring").length;
  const failed = jobs.filter((j) => j.state === "error").length;
  const label = active ? `Adding ${active}…` : failed ? `${failed} failed` : "All added";

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        className={cn(
          "flex h-9 items-center gap-2 border px-3 text-sm",
          failed && !active ? "border-danger text-danger" : "border-rule-strong",
        )}
      >
        {active ? <span aria-hidden className="size-1.5 animate-pulse rounded-full bg-signal" /> : null}
        {label}
      </button>
      {open ? (
        <section
          aria-label="Recent additions"
          className="absolute top-[calc(100%+6px)] right-0 z-40 w-[min(400px,calc(100vw-32px))] border border-rule-strong bg-paper shadow-[0_8px_24px_rgba(0,0,0,0.3)]"
        >
          <div className="flex items-center justify-between border-b border-rule px-3 py-2">
            <Mono>Recent additions</Mono>
            {!active ? (
              <Button size="sm" variant="ghost" onClick={() => (clearJobs(), setOpen(false))}>
                Clear
              </Button>
            ) : null}
          </div>
          <ul className="max-h-72 overflow-y-auto">
            {jobs.map((job) => (
              <li key={job.key} className="border-b border-rule px-3 py-2 last:border-b-0">
                <div className="flex items-baseline gap-3 text-sm">
                  <Mono className={cn("w-[70px] shrink-0", job.state === "error" && "text-danger", job.state === "done" && "text-ink")}>
                    {JOB_LABEL[job.state]}
                  </Mono>
                  <span className="min-w-0 flex-1 truncate">{job.name}</span>
                </div>
                {job.message ? <p className="mt-0.5 pl-[82px] text-xs text-muted">{job.message}</p> : null}
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  );
}

/** Bottom-centre confirmation with an optional Undo. */
export function NoticeToast() {
  const { notice, dismissNotice, holdNotice } = useLibrary();
  return (
    <div aria-live="polite" className="pointer-events-none fixed inset-x-0 bottom-6 z-50 flex justify-center px-4">
      {notice ? (
        <div
          key={notice.id}
          role="status"
          onMouseEnter={() => holdNotice(true)}
          onMouseLeave={() => holdNotice(false)}
          className={cn(
            "pointer-events-auto flex items-center gap-4 px-4 py-2.5 text-sm shadow-[0_8px_24px_rgba(0,0,0,0.3)]",
            notice.tone === "error" ? "bg-danger text-paper" : "bg-ink text-paper",
          )}
        >
          <span>{notice.message}</span>
          {notice.action ? (
            <button type="button" onClick={notice.action.run} className="font-medium text-signal underline-offset-2 hover:underline">
              {notice.action.label} <span className="font-mono text-xs opacity-70">U</span>
            </button>
          ) : (
            <button type="button" onClick={dismissNotice} aria-label="Dismiss" className="opacity-60 hover:opacity-100">
              ×
            </button>
          )}
        </div>
      ) : null}
    </div>
  );
}

const SHARE_NOTICES: Record<string, string> = {
  added: "Added from your phone. It joins the review queue once scored.",
  nothing: "Nothing to add: share an image or a link.",
  error: "Couldn't add what you shared. Try uploading it here instead.",
};

/** Confirms an image shared from the phone's share sheet. */
export function ShareResult() {
  const params = useSearchParams();
  const { notify } = useLibrary();
  const shared = params.get("shared");
  useEffect(() => {
    if (shared && SHARE_NOTICES[shared]) notify(SHARE_NOTICES[shared], shared === "error" ? { tone: "error" } : undefined);
  }, [shared, notify]);
  return null;
}
