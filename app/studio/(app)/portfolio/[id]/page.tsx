import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { getMember } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { editorProject } from "@/lib/portfolio/studio";
import { PageSkeleton } from "../../skeletons";
import { ProjectEditor } from "./project-editor";

export const metadata: Metadata = { title: "Project" };

export default function ProjectPage({ params }: PageProps<"/studio/portfolio/[id]">) {
  return (
    <Suspense fallback={<PageSkeleton sections={3} />}>
      <Editor params={params} />
    </Suspense>
  );
}

async function Editor({ params }: Pick<PageProps<"/studio/portfolio/[id]">, "params">) {
  const { id } = await params;
  await getMember();
  if (!/^[0-9a-f-]{36}$/.test(id)) notFound();
  const db = await createClient();
  const project = await editorProject(db, id);
  if (!project) notFound();
  // Keyed by id: opening another project starts fresh.
  return <ProjectEditor key={project.id} project={project} />;
}
