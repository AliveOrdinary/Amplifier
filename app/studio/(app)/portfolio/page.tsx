import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import { getMember } from "@/lib/auth";
import { studioProjects } from "@/lib/portfolio/studio";
import { Mono, PageContainer, PageHeader, Section } from "@/components/ui/primitives";
import { NewProject, ProjectList } from "./project-list";
import { ImportOldSite } from "./import-old-site";

export const metadata: Metadata = { title: "Portfolio" };

export default async function PortfolioPage() {
  await getMember();
  const db = await createClient();
  const projects = await studioProjects(db);
  const live = projects.filter((p) => p.published).length;
  // Hidden once Crums has arrived with its files (it has more than its text block).
  const hasCrums = projects.some((p) => p.slug === "crums" && p.blocks > 1);

  return (
    <PageContainer>
      <PageHeader
        eyebrow={
          <>
            <Mono>{live} published</Mono>
            <Mono>{projects.length - live} drafts</Mono>
          </>
        }
        title="Portfolio"
        actions={<NewProject />}
      />

      <Section
        number="01"
        title="Projects"
        description="Case studies on the site, in this order. Featured ones are meant for the home page."
        className={hasCrums ? "border-b-0" : undefined}
      >
        <ProjectList projects={projects} />
      </Section>

      {hasCrums ? null : (
        <Section
          number="02"
          title="From the old site"
          description="Projects still on the current amplifier.studio."
          className="border-b-0"
        >
          <ImportOldSite />
        </Section>
      )}
    </PageContainer>
  );
}
