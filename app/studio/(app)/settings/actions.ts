"use server";

import { createHash, randomBytes } from "node:crypto";
import { refresh } from "next/cache";
import { getMember } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

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
