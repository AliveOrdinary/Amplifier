import type { Metadata } from "next";
import { getMember } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { listImages } from "@/lib/library/queries";
import { listAnchors, listDimensions, rubricRevision } from "@/lib/library/rubric";
import { RubricEditor, type RubricDimension, type PickerImage } from "./rubric-editor";

export const metadata: Metadata = { title: "Settings — Rubric" };

// Rescoring runs from this page, a few images per request.
export const maxDuration = 120;

export default async function RubricPage() {
  const member = await getMember();
  const db = await createClient();

  const all = await listDimensions(db, member.studioId, { retired: true });
  const active = all.filter((d) => !d.retiredAt);
  const revision = rubricRevision(active);

  const [anchors, images, stale, toCheck, corrections] = await Promise.all([
    listAnchors(db, all.map((d) => d.key)),
    listImages(db, member.studioId),
    db
      .from("images")
      .select("id", { count: "exact", head: true })
      .eq("studio_id", member.studioId)
      .neq("status", "rejected")
      .not("display_path", "is", null)
      .lt("scored_at", revision),
    db
      .from("image_scores")
      .select("image_id, images!inner ( studio_id )", { count: "exact", head: true })
      .eq("images.studio_id", member.studioId)
      .eq("source", "human")
      .eq("needs_check", true),
    db
      .from("image_scores")
      .select("dimension, images!inner ( studio_id )")
      .eq("images.studio_id", member.studioId)
      .eq("source", "human")
      .eq("needs_check", false),
  ]);

  const correctionCount = new Map<string, number>();
  for (const row of (corrections.data ?? []) as { dimension: string }[]) {
    correctionCount.set(row.dimension, (correctionCount.get(row.dimension) ?? 0) + 1);
  }

  const dimensions: RubricDimension[] = all.map((d) => ({
    key: d.key,
    left: d.left,
    right: d.right,
    leftDefinition: d.leftDefinition,
    rightDefinition: d.rightDefinition,
    retired: Boolean(d.retiredAt),
    corrections: correctionCount.get(d.key) ?? 0,
  }));

  const pickable: PickerImage[] = images
    .filter((i) => i.ready && i.status !== "rejected" && i.thumbUrl)
    .map((i) => ({
      id: i.id,
      thumbUrl: i.thumbUrl!,
      description: i.description ?? i.name ?? "Untitled",
      approved: i.status === "approved",
      scores: Object.fromEntries(Object.entries(i.scores).map(([k, s]) => [k, s?.score ?? 0])),
    }));

  return (
    <RubricEditor
      dimensions={dimensions}
      anchors={anchors}
      images={pickable}
      stale={stale.count ?? 0}
      toCheck={toCheck.count ?? 0}
    />
  );
}
