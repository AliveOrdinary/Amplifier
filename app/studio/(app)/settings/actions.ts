"use server";

import { createHash, randomBytes } from "node:crypto";
import { headers } from "next/headers";
import { refresh } from "next/cache";
import { z } from "zod";
import { getMember } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

type Fail = { ok: false; error: string };
const fail = (error: unknown): Fail => ({
  ok: false,
  error: error instanceof Error ? error.message : "Something went wrong.",
});

/** Creates a personal key for the browser extension. Shown once. */
export async function createExtensionKey(): Promise<{ ok: true; key: string } | Fail> {
  await getMember();
  try {
    const key = `amp_${randomBytes(24).toString("base64url")}`;
    const db = await createClient();
    const { error } = await db.from("member_keys").insert({
      key_hash: createHash("sha256").update(key).digest("hex"),
      key_prefix: key.slice(0, 8),
    });
    if (error) throw new Error(error.message);
    refresh();
    return { ok: true, key };
  } catch (error) {
    return fail(error);
  }
}

export async function revokeExtensionKey(keyId: string): Promise<{ ok: true } | Fail> {
  await getMember();
  try {
    const db = await createClient();
    const { error } = await db.from("member_keys").update({ revoked_at: new Date().toISOString() }).eq("id", keyId);
    if (error) throw new Error(error.message);
    refresh();
    return { ok: true };
  } catch (error) {
    return fail(error);
  }
}

/* ---------------------------------------------------------------- members */

/**
 * Members join by a one-time link the studio sends them itself (WhatsApp,
 * email, anything). Everyone has the same rights: anyone can invite, rename
 * or remove anyone but themselves.
 */

const Invite = z.object({
  name: z.string().trim().min(1, "Add their name.").max(60, "Keep the name under 60 characters."),
  email: z.email("That email doesn't look right.").max(254),
});

/** The address members open: our own page, which asks before using the one-time code. */
async function joinLink(hashedToken: string, type: "invite" | "magiclink") {
  const h = await headers();
  const origin = `${h.get("x-forwarded-proto") ?? "https"}://${h.get("x-forwarded-host") ?? h.get("host")}`;
  return `${origin}/studio/join?token_hash=${encodeURIComponent(hashedToken)}&type=${type}`;
}

export async function inviteMember(input: { name: string; email: string }): Promise<{ ok: true; link: string } | Fail> {
  const member = await getMember();
  try {
    const { name, email } = Invite.parse({ name: input.name, email: input.email.trim().toLowerCase() });
    const admin = createAdminClient();

    let generated = await admin.auth.admin.generateLink({ type: "invite", email });
    let type: "invite" | "magiclink" = "invite";
    if (generated.error) {
      // They already have an account (invited before, or removed and re-added): a sign-in link instead.
      generated = await admin.auth.admin.generateLink({ type: "magiclink", email });
      type = "magiclink";
    }
    if (generated.error || !generated.data.user) throw new Error(generated.error?.message ?? "Couldn't create the invite.");
    const userId = generated.data.user.id;

    const { data: existing } = await admin.from("members").select("studio_id").eq("user_id", userId).maybeSingle();
    if (existing && existing.studio_id !== member.studioId) throw new Error("That person belongs to another studio.");
    if (existing) throw new Error("They're already a member. Use Copy sign-in link to get them a new link.");

    const { error } = await admin
      .from("members")
      .insert({ user_id: userId, studio_id: member.studioId, display_name: name, role: "member" });
    if (error) throw new Error(error.message);
    refresh();
    return { ok: true, link: await joinLink(generated.data.properties.hashed_token, type) };
  } catch (error) {
    return fail(error instanceof z.ZodError ? new Error(error.issues[0]?.message ?? "Check the form.") : error);
  }
}

/** A fresh one-time link for a member: for an invite that expired, or a forgotten password. */
export async function signInLink(userId: string): Promise<{ ok: true; link: string } | Fail> {
  const member = await getMember();
  try {
    const admin = createAdminClient();
    const { data: row } = await admin.from("members").select("user_id").eq("user_id", userId).eq("studio_id", member.studioId).maybeSingle();
    if (!row) throw new Error("That person isn't a member any more.");
    const { data: user, error: userError } = await admin.auth.admin.getUserById(userId);
    if (userError || !user.user?.email) throw new Error("Couldn't find their account.");
    const generated = await admin.auth.admin.generateLink({ type: "magiclink", email: user.user.email });
    if (generated.error) throw new Error(generated.error.message);
    return { ok: true, link: await joinLink(generated.data.properties.hashed_token, "magiclink") };
  } catch (error) {
    return fail(error);
  }
}

export async function renameMember(userId: string, name: string): Promise<{ ok: true } | Fail> {
  const member = await getMember();
  try {
    const clean = name.trim();
    if (!clean || clean.length > 60) throw new Error("Names are 1 to 60 characters.");
    const admin = createAdminClient();
    const { error } = await admin
      .from("members")
      .update({ display_name: clean })
      .eq("user_id", userId)
      .eq("studio_id", member.studioId);
    if (error) throw new Error(error.message);
    refresh();
    return { ok: true };
  } catch (error) {
    return fail(error);
  }
}

/**
 * Remove someone: their account is deleted, so they can't sign in and their
 * extension keys stop working. What they added (images, briefs) stays.
 */
export async function removeMember(userId: string): Promise<{ ok: true } | Fail> {
  const member = await getMember();
  try {
    if (userId === member.userId) throw new Error("You can't remove yourself. Ask another member.");
    const admin = createAdminClient();
    const { data: row } = await admin.from("members").select("user_id").eq("user_id", userId).eq("studio_id", member.studioId).maybeSingle();
    if (!row) throw new Error("That person isn't a member any more.");
    const { error } = await admin.auth.admin.deleteUser(userId);
    if (error) throw new Error(error.message);
    refresh();
    return { ok: true };
  } catch (error) {
    return fail(error);
  }
}

/* --------------------------------------------------------------- spending */

/** The monthly amount that shows an alert across the studio once passed. Empty turns it off. */
export async function setSpendingAlert(amount: string): Promise<{ ok: true } | Fail> {
  const member = await getMember();
  try {
    const trimmed = amount.trim().replace(/^\$/, "");
    const value = trimmed === "" ? null : Number(trimmed);
    if (value !== null && (!Number.isFinite(value) || value <= 0 || value > 100000)) {
      throw new Error("Enter an amount in dollars, like 25, or leave it empty to turn the alert off.");
    }
    const admin = createAdminClient();
    const { error } = await admin
      .from("studios")
      .update({ monthly_alert_usd: value === null ? null : Math.round(value * 100) / 100 })
      .eq("id", member.studioId);
    if (error) throw new Error(error.message);
    refresh();
    return { ok: true };
  } catch (error) {
    return fail(error);
  }
}
