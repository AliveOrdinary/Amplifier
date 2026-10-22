import type { Metadata } from "next";
import { getMember } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { Mono, PageContainer, PageHeader } from "@/components/ui/primitives";
import { NewBriefForm } from "./new-brief-form";

export const metadata: Metadata = { title: "New brief" };

export default async function NewBriefPage() {
  const member = await getMember();
  const db = await createClient();
  const [{ data: templates }, { count: approved }] = await Promise.all([
    db.from("question_templates").select("project_type, name").eq("studio_id", member.studioId).order("sort"),
    db.from("images").select("id", { count: "exact", head: true }).eq("studio_id", member.studioId).eq("status", "approved"),
  ]);
  return (
    <PageContainer>
      <PageHeader eyebrow={<Mono>Briefs</Mono>} title="New brief" />
      <NewBriefForm
        templates={(templates ?? []).map((t) => ({ value: t.project_type as string, label: t.name as string }))}
        approved={approved ?? 0}
      />
    </PageContainer>
  );
}
