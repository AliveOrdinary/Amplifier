import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import { EmptyState, Mono, PageHeader, Section } from "@/components/ui/primitives";

export const metadata: Metadata = { title: "Portfolio" };

export default async function PortfolioPage() {
  const supabase = await createClient();
  const { count } = await supabase.from("projects").select("id", { count: "exact", head: true });

  return (
    <>
      <PageHeader eyebrow={<Mono>{count ?? 0} projects</Mono>} title="Portfolio" />
      <Section number="01" title="Projects" description="Case studies shown on amplifier.studio.">
        <EmptyState title="No projects yet">
          Editing projects here, and moving Crums over from the current site, arrives in phase 5.
        </EmptyState>
      </Section>
    </>
  );
}
