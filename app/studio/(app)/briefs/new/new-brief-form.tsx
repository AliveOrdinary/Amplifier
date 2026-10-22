"use client";

import { useActionState } from "react";
import { Button, Field, Input } from "@/components/ui/primitives";
import { createBrief, type NewBriefState } from "../actions";

/** Below this many approved images, briefs repeat images and skip dimensions. */
const ENOUGH_IMAGES = 60;

export function NewBriefForm({ templates, approved }: { templates: { value: string; label: string }[]; approved: number }) {
  const [state, action, pending] = useActionState<NewBriefState, FormData>(createBrief, undefined);
  const v = state?.values ?? {};
  return (
    <form action={action} className="mt-8 flex max-w-xl flex-col gap-6">
      <Field label="Client's name" htmlFor="client_name" hint="Their first name is used to greet them.">
        <Input id="client_name" name="client_name" required defaultValue={v.client_name} autoFocus />
      </Field>
      <Field label="Client's email (optional)" htmlFor="client_email" hint="For sending the link from the studio later.">
        <Input id="client_email" name="client_email" type="email" defaultValue={v.client_email} />
      </Field>
      <Field label="Project name (optional)" htmlFor="project_name" hint="Shown to them: “what you're drawn to for …”.">
        <Input id="project_name" name="project_name" defaultValue={v.project_name} />
      </Field>
      <Field label="Project type" htmlFor="project_type" hint="Sets the starting questions and the medium the images favour.">
        <select
          id="project_type"
          name="project_type"
          required
          defaultValue={v.project_type ?? ""}
          className="h-11 w-full border border-rule-strong bg-paper px-2.5 text-[15px] text-ink focus:border-ink focus:outline-none"
        >
          <option value="" disabled>
            Choose…
          </option>
          {templates.map((t) => (
            <option key={t.value} value={t.value}>
              {t.label}
            </option>
          ))}
        </select>
      </Field>

      {approved < ENOUGH_IMAGES ? (
        <p className="flex items-start gap-2 text-sm text-ink-soft">
          <span aria-hidden className="mt-1.5 size-2 shrink-0 bg-signal" />
          The library has {approved} approved {approved === 1 ? "image" : "images"}. Briefs work best with {ENOUGH_IMAGES} or
          more; with fewer, some images repeat and some dimensions can&apos;t be tested.
        </p>
      ) : null}

      {state?.error ? (
        <p role="alert" className="text-sm text-danger">
          {state.error}
        </p>
      ) : null}
      <div>
        <Button type="submit" variant="primary" disabled={pending}>
          {pending ? "Creating…" : "Create brief"}
        </Button>
      </div>
    </form>
  );
}
