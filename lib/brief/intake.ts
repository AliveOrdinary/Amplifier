import "server-only";
import { createHash } from "node:crypto";
import { cacheLife, cacheTag } from "next/cache";
import { createAdminClient } from "@/lib/supabase/admin";
import { MEDIUM_FOR_TYPE, type Question } from "@/lib/brief/types";

/**
 * Briefs started by visitors on the public site ("Start a brief"). There's
 * no sign-in, so the server guards it:
 *
 * - two hidden traps for bots: a field people never see (it must stay
 *   empty) and a time check (a person takes a few seconds to fill the form,
 *   and the page has to have run its script);
 * - limits: per visitor (by a hash of their network address), one open
 *   brief per email address, and a cap across the whole site per day.
 *
 * A started brief goes straight to the visitor and shows up in Studio ›
 * Briefs marked "From the site".
 */
export const INTAKE_LIMITS = {
  /** Briefs one visitor (network address) may start in 24 hours. */
  perVisitorPerDay: 2,
  /** Briefs the whole site may start in 24 hours. */
  perSitePerDay: 20,
  /** A form sent faster than this after the page loaded is treated as a bot. */
  minSeconds: 3,
  /** A form older than this asks them to reload (stale or replayed). */
  maxHours: 6,
} as const;

const SITE_STUDIO = "amplifier";

export type IntakeProjectType = { value: string; label: string };

/** The project types a visitor can pick: the studio's active question templates, in the studio's order. */
export async function intakeProjectTypes(): Promise<IntakeProjectType[]> {
  "use cache";
  cacheTag("question-templates");
  cacheLife("hours");
  const db = createAdminClient();
  const studio = await siteStudio(db);
  if (!studio) return [];
  const { data, error } = await db
    .from("question_templates")
    .select("project_type, name")
    .eq("studio_id", studio)
    .is("retired_at", null)
    .order("sort");
  if (error) throw new Error(error.message);
  return (data ?? []).map((t) => ({ value: t.project_type as string, label: t.name as string }));
}

/** The studio the public site belongs to. */
async function siteStudio(db: ReturnType<typeof createAdminClient>): Promise<string | null> {
  const { data } = await db.from("studios").select("id").eq("slug", SITE_STUDIO).maybeSingle();
  return (data?.id as string | undefined) ?? null;
}

export type IntakeInput = {
  name: string;
  email: string;
  projectType: string;
  /** The honeypot: hidden from people, so anything in it means a bot. */
  website: string;
  /** When the form's page ran its script (ms since 1970), from the browser. */
  startedAt: number;
  /** The visitor's network address, as Vercel reports it. */
  address: string | null;
};

export type IntakeResult =
  | { ok: true; token: string }
  | { ok: false; reason: "invalid" | "too-fast" | "stale" | "visitor-limit" | "email-open" | "site-limit" | "unavailable"; field?: string };

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const DAY = 24 * 60 * 60 * 1000;

/** A one-way hash of the address: enough to count, never stored in the clear. */
function visitorHash(address: string | null, studioId: string) {
  return createHash("sha256").update(`${studioId}:${address ?? "unknown"}`).digest("hex").slice(0, 32);
}

export async function startSiteBrief(input: IntakeInput): Promise<IntakeResult> {
  // Bots: the hidden field filled, or no script ran (no start time). Answer as if
  // it were a typo, so they learn nothing.
  if (input.website.trim()) return { ok: false, reason: "invalid" };
  const age = Date.now() - input.startedAt;
  if (!Number.isFinite(input.startedAt) || input.startedAt <= 0) return { ok: false, reason: "invalid" };
  if (age < INTAKE_LIMITS.minSeconds * 1000) return { ok: false, reason: "too-fast" };
  if (age > INTAKE_LIMITS.maxHours * 60 * 60 * 1000) return { ok: false, reason: "stale" };

  const name = input.name.trim().replace(/\s+/g, " ");
  const email = input.email.trim().toLowerCase();
  if (name.length < 1 || name.length > 120) return { ok: false, reason: "invalid", field: "name" };
  if (!EMAIL.test(email) || email.length > 254) return { ok: false, reason: "invalid", field: "email" };

  const db = createAdminClient();
  const studioId = await siteStudio(db);
  if (!studioId) return { ok: false, reason: "unavailable" };
  const studio = { id: studioId };

  const { data: template } = await db
    .from("question_templates")
    .select("project_type, questions")
    .eq("studio_id", studio.id)
    .eq("project_type", input.projectType)
    .is("retired_at", null)
    .maybeSingle();
  if (!template) return { ok: false, reason: "invalid", field: "projectType" };

  const since = new Date(Date.now() - DAY).toISOString();
  const requester = visitorHash(input.address, studio.id);
  const now = new Date().toISOString();

  const [visitor, site, open] = await Promise.all([
    db.from("briefs").select("id", { count: "exact", head: true }).eq("requester_hash", requester).gte("created_at", since),
    db.from("briefs").select("id", { count: "exact", head: true }).eq("source", "site").gte("created_at", since),
    // An open brief for this email: not finished, not archived, not expired.
    db
      .from("briefs")
      .select("id", { count: "exact", head: true })
      .eq("studio_id", studio.id)
      .ilike("client_email", email)
      .in("status", ["draft", "sent", "in_progress"])
      .or(`expires_at.is.null,expires_at.gt.${now}`),
  ]);
  if ((site.count ?? 0) >= INTAKE_LIMITS.perSitePerDay) return { ok: false, reason: "site-limit" };
  if ((visitor.count ?? 0) >= INTAKE_LIMITS.perVisitorPerDay) return { ok: false, reason: "visitor-limit" };
  // Never hand out an existing link: anyone can type anyone's email.
  if ((open.count ?? 0) > 0) return { ok: false, reason: "email-open" };

  const { data, error } = await db
    .from("briefs")
    .insert({
      studio_id: studio.id,
      client_name: name,
      client_email: email,
      project_type: template.project_type,
      medium: MEDIUM_FOR_TYPE[template.project_type as string] ?? null,
      questions: template.questions as Question[],
      status: "sent",
      sent_at: now,
      source: "site",
      requester_hash: requester,
    })
    .select("token")
    .single();
  if (error || !data) {
    console.error("Couldn't start a brief from the site:", error?.message);
    return { ok: false, reason: "unavailable" };
  }
  return { ok: true, token: data.token as string };
}
