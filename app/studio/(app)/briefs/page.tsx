import type { Metadata } from "next";
import Link from "next/link";
import { getMember } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { ButtonLink, EmptyState, Mono, PageContainer, PageHeader, Section } from "@/components/ui/primitives";
import type { Question } from "@/lib/brief/types";
import { StatusLabel } from "./status";

export const metadata: Metadata = { title: "Briefs" };

type Row = {
  id: string;
  client_name: string;
  project_name: string | null;
  project_type: string;
  status: string;
  meeting_at: string | null;
  created_at: string;
  pair_count: number | null;
  warmup: string[] | null;
  reactions: { count: number }[];
};

const date = (iso: string) => new Date(iso).toLocaleDateString("en-CA", { day: "numeric", month: "short" });

export default async function BriefsPage() {
  const member = await getMember();
  const db = await createClient();
  const [{ data: briefs }, { data: templates }] = await Promise.all([
    db
      .from("briefs")
      .select(
        "id, client_name, project_name, project_type, status, meeting_at, created_at, pair_count:plan->pairCount, warmup:plan->warmup, reactions(count)",
      )
      .eq("studio_id", member.studioId)
      .order("created_at", { ascending: false }),
    db.from("question_templates").select("project_type, name, questions").order("sort"),
  ]);
  const rows = (briefs ?? []) as unknown as Row[];
  const typeName = new Map((templates ?? []).map((t) => [t.project_type as string, t.name as string]));

  return (
    <PageContainer>
      <PageHeader
        eyebrow={<Mono>{rows.length} briefs</Mono>}
        title="Briefs"
        actions={
          <ButtonLink href="/studio/briefs/new" variant="primary">
            New brief
          </ButtonLink>
        }
      />

      <Section number="01" title="Client briefs" description="One private link per client. Open a brief to edit it, copy its link or see results.">
        {rows.length ? (
          <ul className="border-t border-rule">
            {rows.map((b) => {
              const total = (b.warmup?.length ?? 0) + (b.pair_count ?? 0);
              const done = b.reactions?.[0]?.count ?? 0;
              return (
                <li key={b.id} className="border-b border-rule">
                  <Link
                    href={`/studio/briefs/${b.id}`}
                    className="grid grid-cols-[minmax(0,1fr)_auto] items-baseline gap-x-6 gap-y-1 py-3.5 hover:bg-panel/50 sm:grid-cols-[minmax(0,1fr)_160px_120px_110px]"
                  >
                    <span className="min-w-0">
                      <span className="block truncate text-[16px]">{b.client_name}</span>
                      <span className="block truncate text-sm text-muted">
                        {[b.project_name, typeName.get(b.project_type)].filter(Boolean).join(" · ")}
                      </span>
                    </span>
                    <StatusLabel status={b.status} />
                    <Mono className="max-sm:hidden">
                      {b.status === "in_progress" && total ? `${done} / ${total} images` : ""}
                    </Mono>
                    <Mono className="max-sm:hidden sm:text-right">
                      {b.meeting_at ? `Meet ${date(b.meeting_at)}` : `Made ${date(b.created_at)}`}
                    </Mono>
                  </Link>
                </li>
              );
            })}
          </ul>
        ) : (
          <EmptyState
            title="No briefs yet"
            action={
              <ButtonLink href="/studio/briefs/new" variant="primary">
                New brief
              </ButtonLink>
            }
          >
            Make one for your next client: pick the project type, copy the link, and send it before you meet.
          </EmptyState>
        )}
      </Section>

      <Section
        number="02"
        title="Question templates"
        description="The starting questions for each project type. Edit them per client inside a brief."
        className="border-b-0"
      >
        <ul className="border-t border-rule">
          {(templates ?? []).map((t) => {
            const questions = (t.questions as Question[]) ?? [];
            const required = questions.filter((q) => !q.optional).length;
            return (
              <li key={t.project_type} className="grid grid-cols-[minmax(0,1fr)_auto] gap-4 border-b border-rule py-3.5">
                <details className="group">
                  <summary className="cursor-pointer list-none text-[16px] marker:hidden">{t.name}</summary>
                  <ol className="mt-3 list-decimal space-y-1.5 pl-5 text-[15px] text-ink-soft">
                    {questions.map((q) => (
                      <li key={q.id}>
                        {q.prompt}
                        {q.optional ? <span className="text-muted"> (optional)</span> : null}
                      </li>
                    ))}
                  </ol>
                </details>
                <Mono className="pt-1">
                  {required} required · {questions.length - required} optional
                </Mono>
              </li>
            );
          })}
        </ul>
      </Section>
    </PageContainer>
  );
}
