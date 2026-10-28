import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getMember } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { getImages } from "@/lib/library/queries";
import type { Plan } from "@/lib/brief/engine";
import { evidence } from "@/lib/brief/evidence";
import { loadReport } from "@/lib/brief/report";
import { loadReactions } from "@/lib/brief/store";
import type { AnswerValue, Question } from "@/lib/brief/types";
import { Mono, PageContainer, Section } from "@/components/ui/primitives";
import { ReportView, type Thumb } from "./report-view";
import { TasteProfile } from "./taste-profile";
import { PrepareReport } from "./prepare-report";
import { Board } from "./board";
import { boardImages, ensureBoard } from "@/lib/brief/board";

export const metadata: Metadata = { title: "Prep" };

// Writing the report with Claude takes a few seconds.
export const maxDuration = 120;

/** Enough of the brief done to say something useful. */
const ENOUGH_PAIRS = 8;

const day = (iso: string) => new Date(iso).toLocaleDateString("en-CA", { weekday: "short", day: "numeric", month: "short" });
const minutes = (from: string, to: string) => Math.max(1, Math.round((Date.parse(to) - Date.parse(from)) / 60000));
const seconds = (ms: number) => `${(ms / 1000).toFixed(1)} s`;

function answerText(value: AnswerValue | undefined) {
  if (!value) return null;
  if ("skipped" in value) return "Skipped";
  if ("words" in value) return value.words.join(", ");
  if ("chips" in value) return value.chips.join(", ");
  return value.why ? `${value.text} — ${value.why}` : value.text;
}

export default async function PrepPage({ params }: PageProps<"/studio/briefs/[id]/prep">) {
  const { id } = await params;
  const member = await getMember();
  const db = await createClient();

  const { data: brief, error } = await db
    .from("briefs")
    .select("id, client_name, project_name, project_type, questions, plan, started_at, completed_at, meeting_at")
    .eq("id", id)
    .eq("studio_id", member.studioId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!brief) notFound();
  const plan = brief.plan as Plan | null;
  const questions = (brief.questions as Question[]) ?? [];

  const [{ data: template }, reactions, report, { data: answerRows }] = await Promise.all([
    db.from("question_templates").select("name").eq("studio_id", member.studioId).eq("project_type", brief.project_type).maybeSingle(),
    plan ? loadReactions(db, brief.id) : Promise.resolve([]),
    loadReport(db, brief.id),
    db.from("answers").select("question_id, value").eq("brief_id", brief.id),
  ]);
  const answers = new Map((answerRows ?? []).map((r) => [r.question_id as string, r.value as AnswerValue]));

  const header = (
    <div className="flex flex-wrap items-end gap-6 border-b border-rule pb-6">
      <div className="min-w-0 flex-[999_1_400px]">
        <div className="flex flex-wrap gap-4">
          <Mono>Prep</Mono>
          <Mono>{template?.name ?? brief.project_type}</Mono>
        </div>
        <h1 className="mt-2.5 text-display font-medium">{brief.client_name}</h1>
        {brief.project_name ? <p className="mt-2 text-lg text-ink-soft">{brief.project_name}</p> : null}
      </div>
      <Link href={`/studio/briefs/${brief.id}`} className="text-sm text-muted underline-offset-2 hover:text-ink hover:underline">
        Brief settings and all choices
      </Link>
    </div>
  );

  const ev = plan ? evidence(plan, reactions) : null;
  const ready = Boolean(plan && ev && (brief.completed_at || ev.pairCount >= ENOUGH_PAIRS));

  if (!plan || !ev || !ready) {
    return (
      <PageContainer>
        {header}
        <p className="mt-10 max-w-xl text-[17px] text-ink-soft">
          {brief.started_at
            ? `The client is part-way through (${ev?.pairCount ?? 0} of ${plan?.pairCount ?? 20} pairs). The prep page appears once they finish, or after ${ENOUGH_PAIRS} pairs if you need it sooner.`
            : "The prep page appears once the client has done the brief."}
        </p>
      </PageContainer>
    );
  }

  if (!report) {
    return (
      <PageContainer>
        {header}
        <PrepareReport briefId={brief.id} partial={!brief.completed_at} />
      </PageContainer>
    );
  }

  // Thumbnails for everything the page shows.
  const ids = [
    ...ev.chosen.slice(0, 4).map((c) => c.id),
    ...ev.rejected.slice(0, 4).map((c) => c.id),
    ...ev.hesitations.flatMap((h) => [h.a, h.b]),
    ...ev.changed.flatMap((c) => [c.first.a, c.first.b]),
  ];
  const [imageList, boardId] = await Promise.all([
    getImages(db, [...new Set(ids)]),
    ensureBoard(db, { id: brief.id, studioId: member.studioId, title: brief.client_name }, ev),
  ]);
  const images = new Map(imageList.map((i) => [i.id, i]));
  const board = await boardImages(db, boardId);
  const thumb = (imageId: string): Thumb => ({
    id: imageId,
    url: images.get(imageId)?.thumbUrl ?? null,
    description: images.get(imageId)?.description ?? null,
  });
  const label = new Map(plan.rubric.map((d) => [d.key, `${d.left} ↔ ${d.right}`]));
  const choiceText = (choice: string) =>
    choice === "both" ? "Both" : choice === "neither" ? "Neither" : `Picked ${choice.toUpperCase()}`;

  const stats = [
    brief.completed_at ? `Completed ${day(brief.completed_at)}` : "Not finished",
    brief.started_at && brief.completed_at ? `${minutes(brief.started_at, brief.completed_at)} min` : null,
    ev.swipeCount === 1 ? "1 swipe" : `${ev.swipeCount} swipes`,
    ev.pairCount === 1 ? "1 pair" : `${ev.pairCount} pairs`,
    ev.medianMs ? `Typical pick ${seconds(ev.medianMs)}` : null,
    brief.meeting_at ? `Meeting ${day(brief.meeting_at)}` : null,
  ].filter(Boolean);

  return (
    <PageContainer>
      {header}
      <div className="flex flex-wrap gap-x-8 gap-y-1 border-b border-rule py-3">
        {stats.map((s) => (
          <Mono key={s}>{s}</Mono>
        ))}
      </div>

      <ReportView
        briefId={brief.id}
        report={report}
        labels={Object.fromEntries(label)}
        chose={ev.chosen.slice(0, 4).map((c) => thumb(c.id))}
        rejected={ev.rejected.slice(0, 4).map((c) => thumb(c.id))}
        profile={<TasteProfile dimensions={ev.dimensions} said={report.said} />}
        moodboard={<Board key={boardId} boardId={boardId} initial={board} clientName={brief.client_name} />}
        hesitations={
          ev.hesitations.length || ev.changed.length ? (
            <div className="flex flex-col">
              {ev.medianMs ? (
                <p className="mb-3 text-sm text-muted">Slowest choices, against a typical pick of {seconds(ev.medianMs)}.</p>
              ) : null}
              {ev.hesitations.map((h) => (
                <PairRow
                  key={h.seq}
                  label={`Pair ${h.index + 1}`}
                  a={thumb(h.a)}
                  b={thumb(h.b)}
                  picked={h.choice}
                  text={`${h.target ? label.get(h.target) : "–"} · ${choiceText(h.choice)}`}
                  aside={seconds(h.ms)}
                />
              ))}
              {ev.changed.map((c) => (
                <PairRow
                  key={`changed-${c.second.seq}`}
                  label="Changed"
                  a={thumb(c.first.a)}
                  b={thumb(c.first.b)}
                  picked={c.first.choice}
                  text={`${c.first.target ? label.get(c.first.target) : "–"} · picked differently when the pair came back swapped`}
                  aside={`Pair ${c.first.index + 1} → ${c.second.index + 1}`}
                />
              ))}
            </div>
          ) : (
            <p className="text-[15px] text-ink-soft">No hesitations: every choice came at their usual pace, and repeated pairs got the same answer.</p>
          )
        }
      />

      <Section number="06" title="In their words" className="border-b-0">
        <ul className="border-t border-rule">
          {questions.map((q) => (
            <li key={q.id} className="grid gap-x-6 gap-y-1 border-b border-rule py-3.5 sm:grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)]">
              <span className="text-[15px] text-muted">{q.prompt}</span>
              <span className="text-[16px]">{answerText(answers.get(q.id)) ?? <span className="text-muted">Not answered</span>}</span>
            </li>
          ))}
        </ul>
      </Section>
    </PageContainer>
  );
}

function PairRow({
  label,
  a,
  b,
  picked,
  text,
  aside,
}: {
  label: string;
  a: Thumb;
  b: Thumb;
  picked: string;
  text: string;
  aside: string;
}) {
  const img = (t: Thumb, on: boolean, off: boolean) => (
    <span className={`block size-14 shrink-0 overflow-hidden rounded-lg bg-panel ${on ? "outline outline-2 outline-offset-1 outline-signal" : ""} ${off ? "opacity-35" : ""}`}>
      {t.url ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={t.url} alt={t.description ?? ""} title={t.description ?? ""} className="h-full w-full object-cover" />
      ) : null}
    </span>
  );
  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-2 border-b border-rule py-2.5 first:border-t">
      <Mono className="w-16">{label}</Mono>
      <span className="flex gap-2">
        {img(a, picked === "a" || picked === "both", picked === "b" || picked === "neither")}
        {img(b, picked === "b" || picked === "both", picked === "a" || picked === "neither")}
      </span>
      <span className="min-w-0 flex-1 text-[15px]">{text}</span>
      <Mono>{aside}</Mono>
    </div>
  );
}
