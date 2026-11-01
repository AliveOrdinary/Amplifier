"use client";

import { useActionState, useEffect, useState } from "react";
import { startBrief, type StartState } from "@/app/start/actions";
import { Button, Field, Input, Select } from "@/components/ui/primitives";
import type { StartCopy } from "@/lib/i18n/start";

export function StartForm({ copy, types }: { copy: StartCopy; types: { value: string; label: string }[] }) {
  const [state, action, pending] = useActionState<StartState, FormData>(startBrief, undefined);
  // When the page's script ran: a person takes a few seconds, a bot without scripts sends nothing.
  const [startedAt, setStartedAt] = useState("");
  useEffect(() => {
    const id = requestAnimationFrame(() => setStartedAt(String(Date.now())));
    return () => cancelAnimationFrame(id);
  }, []);

  const field = state?.field;
  const message = state?.error ? copy.errors[state.error as keyof StartCopy["errors"]] ?? copy.errors.invalid : null;
  const v = state?.values;

  return (
    <form action={action} className="mt-14 flex flex-col gap-6 border-t border-rule pt-8" noValidate>
      <input type="hidden" name="startedAt" value={startedAt} />
      {/* For bots only: people never see or fill this. */}
      <div aria-hidden className="absolute -left-[9999px] h-px w-px overflow-hidden">
        <label htmlFor="website">Website</label>
        <input id="website" name="website" type="text" tabIndex={-1} autoComplete="off" defaultValue="" />
      </div>

      <Field label={copy.name} htmlFor="name" error={field === "name" ? message ?? undefined : undefined}>
        <Input id="name" name="name" autoComplete="name" required maxLength={120} defaultValue={v?.name} aria-invalid={field === "name" || undefined} />
      </Field>
      <Field label={copy.email} htmlFor="email" hint={copy.emailHint} error={field === "email" ? message ?? undefined : undefined}>
        <Input
          id="email"
          name="email"
          type="email"
          autoComplete="email"
          required
          maxLength={254}
          defaultValue={v?.email}
          aria-invalid={field === "email" || undefined}
        />
      </Field>
      <Field label={copy.type} htmlFor="projectType" hint={copy.typeHint} error={field === "projectType" ? message ?? undefined : undefined}>
        <Select id="projectType" name="projectType" required defaultValue={v?.projectType ?? ""} aria-invalid={field === "projectType" || undefined}>
          <option value="" disabled>
            {copy.choose}
          </option>
          {types.map((t) => (
            <option key={t.value} value={t.value}>
              {t.label}
            </option>
          ))}
        </Select>
      </Field>

      {message && !field ? (
        <p role="alert" className="rounded-xl border border-danger px-4 py-3 text-[15px] text-danger">
          {message}
        </p>
      ) : null}

      <div className="flex flex-col gap-4 pt-2">
        <Button type="submit" variant="primary" disabled={pending || !startedAt} className="h-14 self-start px-8 text-base">
          {pending ? copy.starting : copy.submit}
        </Button>
        <p className="max-w-[56ch] text-sm leading-relaxed text-muted">{copy.privacy}</p>
      </div>
    </form>
  );
}
