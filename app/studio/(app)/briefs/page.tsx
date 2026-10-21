import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import { EmptyState, Mono, PageHeader, Section } from "@/components/ui/primitives";

export const metadata: Metadata = { title: "Briefs" };

type Question = { id: string; prompt: string; optional?: boolean };

export default async function BriefsPage() {
  const supabase = await createClient();
  const [{ count }, { data: templates }] = await Promise.all([
    supabase.from("briefs").select("id", { count: "exact", head: true }),
    supabase.from("question_templates").select("project_type, name, questions").order("sort"),
  ]);

  return (
    <>
      <PageHeader eyebrow={<Mono>{count ?? 0} briefs</Mono>} title="Briefs" />

      <Section number="01" title="Client briefs" description="One private link per client. Results arrive here as a prep page.">
        <EmptyState title="No briefs yet">
          Setting up a brief and sending the private link arrives in phase 3. Each completed brief
          will appear here with its status and prep page.
        </EmptyState>
      </Section>

      <Section
        number="02"
        title="Question templates"
        description="Five core questions plus one to three for the project type. Editable per client."
      >
        <ul className="border-t border-rule">
          {(templates ?? []).map((t) => {
            const questions = (t.questions as Question[]) ?? [];
            const required = questions.filter((q) => !q.optional).length;
            return (
              <li key={t.project_type} className="grid grid-cols-[minmax(0,1fr)_auto] gap-4 border-b border-rule py-3.5">
                <details className="group">
                  <summary className="cursor-pointer list-none text-[16px] marker:hidden">
                    {t.name}
                  </summary>
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
    </>
  );
}
