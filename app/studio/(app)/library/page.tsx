import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import { getMember } from "@/lib/auth";
import { Mono, PageHeader, Section } from "@/components/ui/primitives";
import { DIMENSIONS, MEDIA, type DimensionKey } from "@/lib/library/constants";
import { Coverage } from "./coverage";
import { LibraryWorkspace, type LibraryImage } from "./workspace";
import { ExtensionKeys, type MemberKey } from "./extension-keys";

export const metadata: Metadata = { title: "Library" };

// Uploads are resized and scored inside server actions on this page.
export const maxDuration = 120;

type ScoreRow = { dimension: string; score: number; source: "ai" | "human"; confidence: number | null };

const shareNotices: Record<string, string> = {
  added: "Added from your phone. It's in the review queue.",
  nothing: "Nothing to add: share an image or a link.",
  error: "Couldn't add what you shared. Try uploading it here instead.",
};

export default async function LibraryPage({ searchParams }: PageProps<"/studio/library">) {
  const shared = (await searchParams).shared;
  const shareNotice = typeof shared === "string" ? shareNotices[shared] : undefined;
  const member = await getMember();
  const db = await createClient();

  const [{ data: rows }, { data: keys }] = await Promise.all([
    db
      .from("images")
      .select(
        "id, status, medium, description, width, height, thumb_path, display_path, source_url, page_url, original_name, score_error, scored_at, created_at, image_scores ( dimension, score, source, confidence )",
      )
      .eq("studio_id", member.studioId)
      .order("created_at", { ascending: false }),
    db
      .from("member_keys")
      .select("id, label, key_prefix, created_at, last_used_at, revoked_at")
      .is("revoked_at", null)
      .order("created_at", { ascending: false }),
  ]);

  const paths = (rows ?? []).flatMap((r) => [r.thumb_path, r.display_path]).filter(Boolean) as string[];
  const signed = paths.length ? (await db.storage.from("library").createSignedUrls(paths, 60 * 60 * 6)).data ?? [] : [];
  const urlFor = new Map(signed.map((s) => [s.path, s.signedUrl]));

  const images: LibraryImage[] = (rows ?? []).map((r) => {
    const scores = Object.fromEntries(
      ((r.image_scores ?? []) as ScoreRow[]).map((s) => [
        s.dimension,
        { score: Number(s.score), source: s.source, confidence: s.confidence === null ? null : Number(s.confidence) },
      ]),
    ) as LibraryImage["scores"];
    return {
      id: r.id,
      status: r.status,
      medium: r.medium,
      description: r.description,
      name: r.original_name,
      width: r.width,
      height: r.height,
      thumbUrl: r.thumb_path ? (urlFor.get(r.thumb_path) ?? null) : null,
      displayUrl: r.display_path ? (urlFor.get(r.display_path) ?? null) : null,
      sourceUrl: r.page_url ?? r.source_url,
      scoreError: r.score_error,
      scored: Boolean(r.scored_at),
      scores,
    };
  });

  const approved = images.filter((i) => i.status === "approved");
  const pending = images.filter((i) => i.status === "pending").length;

  const coverage = DIMENSIONS.map((d) => {
    const bins = [0, 0, 0, 0, 0];
    for (const image of approved) {
      const value = image.scores[d.key as DimensionKey]?.score;
      if (value === undefined) continue;
      bins[Math.max(0, Math.min(4, Math.round(value) + 2))] += 1;
    }
    return { key: d.key, left: d.left, right: d.right, bins };
  });
  const media = MEDIA.map((m) => ({ ...m, count: approved.filter((i) => i.medium === m.key).length }));

  return (
    <>
      <PageHeader
        eyebrow={
          <>
            <Mono>{approved.length} approved</Mono>
            <Mono>{pending} to review</Mono>
          </>
        }
        title="Library"
      />

      {shareNotice ? (
        <p role="status" className="mt-6 border border-rule-strong px-4 py-3 text-[15px]">
          {shareNotice}
        </p>
      ) : null}

      <Section
        number="01"
        title="Coverage"
        description="How approved images spread across each dimension. Briefs need every bin filled."
      >
        <Coverage dimensions={coverage} media={media} approvedCount={approved.length} />
      </Section>

      <Section
        number="02"
        title="Images"
        description="Add images, then check Claude's scores. Keyboard: J/K move, 1–8 pick a dimension, ←/→ adjust, Enter approve, X reject."
      >
        <LibraryWorkspace images={images} />
      </Section>

      <Section
        number="03"
        title="Adding from the web"
        description="Right-click any image in Chrome, or share from your phone."
        className="border-b-0"
      >
        <ExtensionKeys keys={(keys ?? []) as MemberKey[]} />
      </Section>
    </>
  );
}
