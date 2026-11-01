"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { startSiteBrief } from "@/lib/brief/intake";

export type StartState = { error?: string; field?: string; values?: { name: string; email: string; projectType: string } } | undefined;

/**
 * A visitor starts their own brief from the site. Errors come back as keys
 * (the page shows them in its language); success opens the brief.
 */
export async function startBrief(_: StartState, form: FormData): Promise<StartState> {
  const values = {
    name: String(form.get("name") ?? ""),
    email: String(form.get("email") ?? ""),
    projectType: String(form.get("projectType") ?? ""),
  };
  const h = await headers();
  // Vercel puts the visitor's address first in x-forwarded-for.
  const address = (h.get("x-forwarded-for") ?? "").split(",")[0]?.trim() || h.get("x-real-ip") || null;

  const result = await startSiteBrief({
    ...values,
    website: String(form.get("website") ?? ""),
    startedAt: Number(form.get("startedAt") ?? 0),
    address,
  });
  if (!result.ok) return { error: result.field ?? result.reason, field: result.field, values };
  redirect(`/b/${result.token}`);
}
