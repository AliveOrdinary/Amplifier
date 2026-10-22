"use server";

import { createAdminClient } from "@/lib/supabase/admin";
import { BriefError, briefByToken, currentStep, record } from "@/lib/brief/store";
import type { BriefInput, Progress, Step } from "@/lib/brief/types";

export type Advance = { ok: true; step: Step; progress: Progress } | { ok: false; error: string };

/**
 * Everything the client does goes through here: save what they did, return
 * the next screen. The private link is the only credential.
 */
export async function advance(token: string, input: BriefInput): Promise<Advance> {
  try {
    const db = createAdminClient();
    const brief = await briefByToken(db, token);
    if (!brief) return { ok: false, error: "This link doesn't work any more. Ask the studio for a new one." };
    // record() updates `brief` in place (start, plan) and hands back the reactions it read.
    const reactions = await record(db, brief, input);
    return { ok: true, ...(await currentStep(db, brief, reactions)) };
  } catch (error) {
    console.error(error);
    return {
      ok: false,
      error: error instanceof BriefError ? error.message : "Something went wrong saving that. Please try again.",
    };
  }
}
