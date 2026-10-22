import "server-only";
import { createHash } from "node:crypto";
import { NextResponse, type NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * The browser extension signs in with a member's personal key
 * (Authorization: Bearer amp_…), created in Studio > Library.
 */
export async function authenticateKey(request: NextRequest) {
  const header = request.headers.get("authorization") ?? "";
  const key = header.startsWith("Bearer ") ? header.slice(7).trim() : "";
  if (!/^amp_[A-Za-z0-9_-]{20,}$/.test(key)) return null;

  const admin = createAdminClient();
  const { data: row } = await admin
    .from("member_keys")
    .select("id, user_id, studio_id")
    .eq("key_hash", createHash("sha256").update(key).digest("hex"))
    .is("revoked_at", null)
    .maybeSingle();
  if (!row) return null;

  // The key only works while its owner is still a member of that studio.
  const { data: member } = await admin
    .from("members")
    .select("studio_id, display_name, studios ( name )")
    .eq("user_id", row.user_id)
    .eq("studio_id", row.studio_id)
    .maybeSingle();
  if (!member) return null;

  await admin.from("member_keys").update({ last_used_at: new Date().toISOString() }).eq("id", row.id);
  const studio = member.studios as unknown as { name: string } | null;
  return {
    userId: row.user_id as string,
    studioId: row.studio_id as string,
    studioName: studio?.name ?? "Studio",
    name: ((member.display_name as string | null) ?? "").trim() || (await emailName(admin, row.user_id as string)),
  };
}

/** "ana" from ana@studio.com, for members without a display name. */
async function emailName(admin: ReturnType<typeof createAdminClient>, userId: string) {
  const { data } = await admin.auth.admin.getUserById(userId);
  const local = data.user?.email?.split("@")[0] ?? "";
  return local ? local.charAt(0).toUpperCase() + local.slice(1) : "Studio";
}

export function unauthorized() {
  return NextResponse.json(
    { ok: false, error: "That key isn't valid. Create a new one in Studio > Library." },
    { status: 401 },
  );
}
