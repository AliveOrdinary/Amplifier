"use server";

import { redirect } from "next/navigation";
import { refresh } from "next/cache";
import { z } from "zod";
import { getMember } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { MEDIUM_KEYS } from "@/lib/library/constants";
import { MAX_PINS, MEDIUM_FOR_TYPE, type Question } from "@/lib/brief/types";

type Fail = { ok: false; error: string };
const fail = (error: unknown): Fail => ({
  ok: false,
  error:
    error instanceof z.ZodError
      ? (error.issues[0]?.message ?? "Check the form.")
      : error instanceof Error
        ? error.message
        : "Something went wrong.",
});

const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .transform((v) => v || null);

const optionalDate = z
  .string()
  .trim()
  .transform((v, ctx) => {
    if (!v) return null;
    const time = Date.parse(v);
    if (Number.isNaN(time)) {
      ctx.addIssue({ code: "custom", message: "That date doesn't look right." });
      return z.NEVER;
    }
    return new Date(time).toISOString();
  });

const NewBrief = z.object({
  client_name: z.string().trim().min(1, "Add the client's name.").max(120),
  client_email: z.union([z.literal(""), z.email("That email doesn't look right.")]).transform((v) => v || null),
  project_name: optionalText(120),
  project_type: z.string().min(1, "Choose a project type."),
});

export type NewBriefState = { error?: string; values?: Record<string, string> } | undefined;

/** Create a brief from a template and open it. */
export async function createBrief(_: NewBriefState, form: FormData): Promise<NewBriefState> {
  const member = await getMember();
  const values = Object.fromEntries(
    ["client_name", "client_email", "project_name", "project_type"].map((k) => [k, String(form.get(k) ?? "")]),
  );
  let id: string;
  try {
    const input = NewBrief.parse(values);
    const db = await createClient();
    const { data: template } = await db
      .from("question_templates")
      .select("questions")
      .eq("studio_id", member.studioId)
      .eq("project_type", input.project_type)
      .maybeSingle();
    if (!template) throw new Error("Choose a project type.");

    const { data, error } = await db
      .from("briefs")
      .insert({
        ...input,
        studio_id: member.studioId,
        medium: MEDIUM_FOR_TYPE[input.project_type] ?? null,
        questions: template.questions,
      })
      .select("id")
      .single();
    if (error) throw new Error(error.message);
    id = data.id;
  } catch (error) {
    return { error: fail(error).error, values };
  }
  redirect(`/studio/briefs/${id}`);
}

const Details = z.object({
  client_name: z.string().trim().min(1, "Add the client's name.").max(120),
  client_email: z.union([z.literal(""), z.email("That email doesn't look right.")]).transform((v) => v || null),
  project_name: optionalText(120),
  medium: z
    .string()
    .transform((v) => v || null)
    .refine((v) => v === null || (MEDIUM_KEYS as string[]).includes(v), "Unknown medium."),
  meeting_at: optionalDate,
  note: optionalText(400),
});

export async function saveDetails(briefId: string, input: z.input<typeof Details>): Promise<{ ok: true } | Fail> {
  await getMember();
  try {
    const values = Details.parse(input);
    const db = await createClient();
    const { error } = await db.from("briefs").update(values).eq("id", briefId);
    if (error) throw new Error(error.message);
    refresh();
    return { ok: true };
  } catch (error) {
    return fail(error);
  }
}

const QuestionSchema = z.object({
  id: z.string().min(1).max(60),
  prompt: z.string().trim().min(1, "A question can't be empty.").max(300),
  help: z.string().trim().max(300).optional(),
  format: z.enum(["long", "short", "three_words", "chips", "link"]),
  options: z.array(z.string().trim().min(1).max(60)).max(20).optional(),
  optional: z.boolean().optional(),
});

/** Replace a brief's questions. Locked once the client has started. */
export async function saveQuestions(briefId: string, questions: Question[]): Promise<{ ok: true } | Fail> {
  await getMember();
  try {
    const list = z.array(QuestionSchema).min(1, "Keep at least one question.").max(15).parse(questions);
    if (new Set(list.map((q) => q.id)).size !== list.length) throw new Error("Two questions share an id.");
    const db = await createClient();
    const { data: brief } = await db.from("briefs").select("started_at").eq("id", briefId).single();
    if (brief?.started_at) throw new Error("The client has started, so the questions can't change now.");
    const { error } = await db.from("briefs").update({ questions: list }).eq("id", briefId);
    if (error) throw new Error(error.message);
    refresh();
    return { ok: true };
  } catch (error) {
    return fail(error);
  }
}

export async function setPin(briefId: string, imageId: string, pinned: boolean): Promise<{ ok: true } | Fail> {
  await getMember();
  try {
    const db = await createClient();
    const { data: brief } = await db.from("briefs").select("started_at").eq("id", briefId).single();
    if (brief?.started_at) throw new Error("The client has started, so pins can't change now.");
    if (pinned) {
      const { count } = await db.from("brief_pins").select("image_id", { count: "exact", head: true }).eq("brief_id", briefId);
      if ((count ?? 0) >= MAX_PINS) throw new Error(`Up to ${MAX_PINS} pins.`);
      const { error } = await db.from("brief_pins").upsert({ brief_id: briefId, image_id: imageId });
      if (error) throw new Error(error.message);
    } else {
      const { error } = await db.from("brief_pins").delete().eq("brief_id", briefId).eq("image_id", imageId);
      if (error) throw new Error(error.message);
    }
    refresh();
    return { ok: true };
  } catch (error) {
    return fail(error);
  }
}

/** Copying the link counts as sending it. */
export async function markSent(briefId: string): Promise<{ ok: true } | Fail> {
  await getMember();
  try {
    const db = await createClient();
    await db
      .from("briefs")
      .update({ status: "sent", sent_at: new Date().toISOString() })
      .eq("id", briefId)
      .eq("status", "draft");
    refresh();
    return { ok: true };
  } catch (error) {
    return fail(error);
  }
}

/** Another 30 days from today. */
export async function extendLink(briefId: string): Promise<{ ok: true } | Fail> {
  await getMember();
  try {
    const db = await createClient();
    const expires = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();
    const { error } = await db.from("briefs").update({ expires_at: expires }).eq("id", briefId);
    if (error) throw new Error(error.message);
    refresh();
    return { ok: true };
  } catch (error) {
    return fail(error);
  }
}

export async function archiveBrief(briefId: string, archived: boolean): Promise<{ ok: true } | Fail> {
  await getMember();
  try {
    const db = await createClient();
    const { data: brief } = await db.from("briefs").select("started_at, completed_at, sent_at").eq("id", briefId).single();
    const status = archived
      ? "archived"
      : brief?.completed_at
        ? "completed"
        : brief?.started_at
          ? "in_progress"
          : brief?.sent_at
            ? "sent"
            : "draft";
    const { error } = await db.from("briefs").update({ status }).eq("id", briefId);
    if (error) throw new Error(error.message);
    refresh();
    return { ok: true };
  } catch (error) {
    return fail(error);
  }
}

export async function deleteBrief(briefId: string): Promise<Fail | never> {
  await getMember();
  try {
    const db = await createClient();
    const { error } = await db.from("briefs").delete().eq("id", briefId);
    if (error) throw new Error(error.message);
  } catch (error) {
    return fail(error);
  }
  redirect("/studio/briefs");
}
