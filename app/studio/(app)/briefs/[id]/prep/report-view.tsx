"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition, type ReactNode } from "react";
import type { Report, ReportContent } from "@/lib/brief/report-types";
import { Button, Mono, Section, cn } from "@/components/ui/primitives";
import { prepareReport, saveReport } from "../../actions";

export type Thumb = { id: string; url: string | null; description: string | null };

type Editable = Pick<ReportContent, "headline" | "contradictions" | "directions">;

const field =
  "w-full resize-y border border-rule-strong bg-transparent px-3 py-2 text-[16px] leading-snug text-ink focus:border-ink focus:outline-none";

/** The written parts of the prep page, editable in place. */
export function ReportView({
  briefId,
  report,
  labels,
  chose,
  rejected,
  profile,
  hesitations,
  moodboard,
}: {
  briefId: string;
  report: Report;
  labels: Record<string, string>;
  chose: Thumb[];
  rejected: Thumb[];
  profile: ReactNode;
  hesitations: ReactNode;
  moodboard?: ReactNode;
}) {
  const router = useRouter();
  const saved: Editable = {
    headline: report.content.headline,
    contradictions: report.content.contradictions,
    directions: report.content.directions,
  };
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState<Editable>(saved);
  const [confirmRedo, setConfirmRedo] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const content = editing ? draft : saved;

  const save = () =>
    start(async () => {
      const r = await saveReport(briefId, draft);
      if (!r.ok) return setError(r.error);
      setError(null);
      setEditing(false);
      router.refresh();
    });

  const regenerate = () =>
    start(async () => {
      setConfirmRedo(false);
      const r = await prepareReport(briefId);
      if (!r.ok) return setError(r.error);
      setError(null);
      router.refresh();
    });

  const setLine = (i: number, change: Partial<Editable["contradictions"][number]>) =>
    setDraft((d) => ({ ...d, contradictions: d.contradictions.map((c, j) => (j === i ? { ...c, ...change } : c)) }));
  const setDirection = (side: "chose" | "rejected", i: number, value: string) =>
    setDraft((d) => ({ ...d, directions: { ...d.directions, [side]: d.directions[side].map((l, j) => (j === i ? value : l)) } }));

  return (
    <>
      <div className="flex flex-wrap items-start gap-x-10 gap-y-4 py-8">
        <div className="min-w-0 flex-[999_1_480px]">
          {editing ? (
            <textarea
              aria-label="Headline"
              rows={3}
              value={draft.headline}
              onChange={(e) => setDraft((d) => ({ ...d, headline: e.target.value }))}
              className={cn(field, "text-[22px]")}
            />
          ) : (
            <p className="max-w-3xl text-[24px] leading-snug tracking-[-0.01em]">{content.headline}</p>
          )}
          {report.content.partial ? (
            <p className="mt-3 text-sm text-muted">Prepared before the client finished. Regenerate once they have.</p>
          ) : null}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {editing ? (
            <>
              <Button variant="primary" onClick={save} disabled={pending}>
                {pending ? "Saving…" : "Save wording"}
              </Button>
              <Button variant="ghost" onClick={() => (setEditing(false), setDraft(saved))} disabled={pending}>
                Cancel
              </Button>
            </>
          ) : confirmRedo ? (
            <>
              <span className="text-sm text-ink-soft">Rewrite everything? Your edits will be lost.</span>
              <Button size="sm" onClick={regenerate} disabled={pending}>
                Rewrite
              </Button>
              <Button size="sm" variant="ghost" onClick={() => setConfirmRedo(false)}>
                Cancel
              </Button>
            </>
          ) : (
            <>
              <Button size="sm" onClick={() => (setDraft(saved), setEditing(true))} disabled={pending}>
                Edit wording
              </Button>
              <Button
                size="sm"
                variant="ghost"
                disabled={pending}
                onClick={() => (report.content.editedAt ? setConfirmRedo(true) : regenerate())}
              >
                {pending ? "Rewriting…" : "Regenerate"}
              </Button>
            </>
          )}
        </div>
        {error ? (
          <p role="alert" className="w-full text-sm text-danger">
            {error}
          </p>
        ) : null}
      </div>

      <Section number="01" title="Contradictions" description="Where their words and their choices disagree. Raise these first.">
        {content.contradictions.length ? (
          <ol className="flex flex-col">
            {content.contradictions.map((c, i) => (
              <li key={`${c.key}-${i}`} className="flex flex-wrap gap-x-6 gap-y-2 border-b border-rule py-5 first:pt-0 last:border-b-0">
                <Mono className="w-40 shrink-0 pt-1.5 text-ink">{labels[c.key] ?? c.key}</Mono>
                <div className="min-w-0 flex-[1_1_380px]">
                  {editing ? (
                    <div className="flex flex-col gap-2">
                      <textarea aria-label="Contradiction" rows={2} value={c.line} onChange={(e) => setLine(i, { line: e.target.value })} className={field} />
                      <textarea aria-label="Question to ask" rows={2} value={c.ask} onChange={(e) => setLine(i, { ask: e.target.value })} className={field} />
                      <button
                        type="button"
                        className="self-start text-sm text-muted underline-offset-2 hover:text-ink hover:underline"
                        onClick={() => setDraft((d) => ({ ...d, contradictions: d.contradictions.filter((_, j) => j !== i) }))}
                      >
                        Remove
                      </button>
                    </div>
                  ) : (
                    <>
                      <p className="text-[20px] leading-snug">{c.line}</p>
                      {c.ask ? (
                        <p className="mt-3 flex items-baseline gap-2.5 text-[16px]">
                          <span aria-hidden className="size-2 shrink-0 translate-y-[-1px] bg-signal" />
                          <span>
                            <span className="font-medium">Ask:</span> {c.ask}
                          </span>
                        </p>
                      ) : null}
                    </>
                  )}
                </div>
              </li>
            ))}
          </ol>
        ) : (
          <p className="text-[16px] text-ink-soft">
            None worth raising: what they said and what they chose point the same way. Use the profile below to confirm it in the meeting.
          </p>
        )}
      </Section>

      <Section number="02" title="Taste profile" description="Their words against their choices, on each dimension of the rubric.">
        {profile}
      </Section>

      <Section number="03" title="Confident directions" description="What they kept choosing, and what they kept passing over.">
        <div className="grid gap-10 sm:grid-cols-2">
          {(["chose", "rejected"] as const).map((side) => (
            <div key={side}>
              <Mono className="block border-b border-ink pb-2.5 text-ink">{side === "chose" ? "Consistently chose" : "Consistently passed over"}</Mono>
              {editing ? (
                <div className="mt-3 flex flex-col gap-2">
                  {draft.directions[side].map((line, i) => (
                    <input key={i} aria-label="Direction" value={line} onChange={(e) => setDirection(side, i, e.target.value)} className={cn(field, "h-10")} />
                  ))}
                </div>
              ) : (
                <ul className="mt-3 list-disc space-y-1 pl-5 text-[17px] leading-relaxed">
                  {content.directions[side].map((line, i) => (
                    <li key={i}>{line}</li>
                  ))}
                </ul>
              )}
              <div className="mt-4 grid grid-cols-4 gap-1.5">
                {(side === "chose" ? chose : rejected).map((t) => (
                  <span key={t.id} className={cn("block aspect-square overflow-hidden bg-panel", side === "rejected" && "opacity-55")}>
                    {t.url ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={t.url} alt={t.description ?? ""} title={t.description ?? ""} className="h-full w-full object-cover" />
                    ) : null}
                  </span>
                ))}
              </div>
            </div>
          ))}
        </div>
      </Section>

      <Section number="04" title="Hesitations" description="Where they slowed down or changed their mind. Worth a gentle question.">
        {hesitations}
      </Section>

      {moodboard ? (
        <Section number="05" title="Starter moodboard" description="Their picks and close matches. Shape it here, then take it into FigJam or Claude Design.">
          {moodboard}
        </Section>
      ) : null}
    </>
  );
}
