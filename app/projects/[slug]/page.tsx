import type { Metadata } from "next";
import { Suspense } from "react";
import { ProjectPage, projectMetadata } from "@/components/site/project-page";

export async function generateMetadata({ params }: PageProps<"/projects/[slug]">): Promise<Metadata> {
  return projectMetadata((await params).slug, "en");
}

export default function Project({ params }: PageProps<"/projects/[slug]">) {
  return (
    <Suspense fallback={<main className="flex-1" />}>
      <Resolved params={params} />
    </Suspense>
  );
}

async function Resolved({ params }: Pick<PageProps<"/projects/[slug]">, "params">) {
  return <ProjectPage slug={(await params).slug} locale="en" />;
}
