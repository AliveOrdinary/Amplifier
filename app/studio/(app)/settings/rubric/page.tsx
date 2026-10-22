import type { Metadata } from "next";
import { after } from "next/server";
import { getMember } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { processQueue } from "@/lib/library/score-queue";
import { listAnchors, listDimensions } from "@/lib/library/rubric";
import { RubricEditor, type RubricDimension } from "./rubric-editor";

export const metadata: Metadata = { title: "Settings — Rubric" };

// Rescoring runs from this page, a few images per request.
export const maxDuration = 120;

export default async function RubricPage() {
  const member = await getMember();
  const db = await createClient();
  // Read back any background rescoring that has finished.
  after(() => processQueue(createAdminClient(), member.studioId).catch((err) => console.error("queue processing failed", err)));

  const all = await listDimensions(db, member.studioId, { retired: true });

  const [anchors, stale, rescoring, toCheck, corrections] = await Promise.all([
    listAnchors(db, all.map((d) => d.key)),
    db.rpc("stale_score_count", { p_studio: member.studioId }),
    db
      .from("score_queue")
      .select("image_id", { count: "exact", head: true })
      .eq("studio_id", member.studioId)
      .not("dimensions", "is", null),
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

  return (
    <RubricEditor
      dimensions={dimensions}
      anchors={anchors}
      stale={Number(stale.data ?? 0)}
      rescoring={rescoring.count ?? 0}
      toCheck={toCheck.count ?? 0}
    />
  );
}
