import type { Project } from "@/lib/portfolio/types";

/** Shown while a member previews a project: whether it's live, and the way out. */
export function PreviewBanner({ project }: { project: Project }) {
  return (
    <div role="status" className="sticky top-0 z-50 border-b border-ink bg-signal text-on-signal">
      <div className="mx-auto flex max-w-[1360px] flex-wrap items-center gap-x-6 gap-y-1 px-4 py-2 text-sm sm:px-10">
        <p className="flex-1">
          Preview · {project.draft ? "This project is a draft. Only studio members can see it." : "This project is live."}
        </p>
        <a href={`/studio/portfolio/${project.id}`} className="underline underline-offset-4">
          Back to the editor
        </a>
        {/* A plain link: prefetching it would end the preview. */}
        <a href={`/api/portfolio/preview/exit?slug=${project.slug}`} className="underline underline-offset-4">
          Exit preview
        </a>
      </div>
    </div>
  );
}
