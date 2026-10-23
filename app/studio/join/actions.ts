"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";

export type JoinState = { error?: string };

/**
 * Use the one-time code from an invite or sign-in link. Done on a button
 * press, not when the page opens: link previews in chat apps open pages
 * too, and would use up the code before the person clicks.
 */
export async function acceptLink(_prev: JoinState, form: FormData): Promise<JoinState> {
  const tokenHash = String(form.get("token_hash") ?? "");
  const type = form.get("type") === "invite" ? "invite" : "magiclink";
  if (!tokenHash) return { error: "This link is incomplete. Ask for a new one." };

  const supabase = await createClient();
  const { error } = await supabase.auth.verifyOtp({ token_hash: tokenHash, type });
  if (error) {
    return {
      error: /expired|invalid/i.test(error.message)
        ? "This link has expired or was already used. Ask a studio member for a new one (Settings › Members › Copy sign-in link)."
        : error.message,
    };
  }
  redirect("/studio/join/password");
}

export type PasswordState = { error?: string };

const Password = z
  .object({ password: z.string().min(10, "Use at least 10 characters.").max(256), confirm: z.string() })
  .refine((v) => v.password === v.confirm, { message: "The two passwords don't match.", path: ["confirm"] });

export async function choosePassword(_prev: PasswordState, form: FormData): Promise<PasswordState> {
  const parsed = Password.safeParse({ password: form.get("password"), confirm: form.get("confirm") });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Check the password." };

  const supabase = await createClient();
  const { error } = await supabase.auth.updateUser({ password: parsed.data.password });
  if (error) {
    return {
      error: /should be different/i.test(error.message) ? "That's your current password. Choose a new one, or go to the studio." : error.message,
    };
  }
  redirect("/studio/library");
}
