"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { MEDIA } from "@/lib/library/constants";
import { Button, Field, Input, Select } from "@/components/ui/primitives";
import { saveDetails } from "../actions";

type Values = {
  client_name: string;
  client_email: string;
  project_name: string;
  medium: string;
  meeting_at: string | null;
  note: string;
};

/** ISO time to the value a datetime-local input expects, in the viewer's time zone. */
function toLocalInput(iso: string | null) {
  if (!iso) return "";
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function DetailsForm({ briefId, initial }: { briefId: string; initial: Values }) {
  const [form, setForm] = useState({ ...initial, meeting_at: toLocalInput(initial.meeting_at) });
  const [saved, setSaved] = useState(form);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const router = useRouter();
  const dirty = (Object.keys(form) as (keyof typeof form)[]).some((k) => form[k] !== saved[k]);
  const set = (key: keyof typeof form) => (e: { target: { value: string } }) => setForm((f) => ({ ...f, [key]: e.target.value }));

  const save = () =>
    start(async () => {
      const r = await saveDetails(briefId, {
        ...form,
        meeting_at: form.meeting_at ? new Date(form.meeting_at).toISOString() : "",
      });
      if (!r.ok) return setError(r.error);
      setError(null);
      setSaved(form);
      router.refresh();
    });

  return (
    <form
      className="grid max-w-2xl gap-5 sm:grid-cols-2"
      onSubmit={(e) => {
        e.preventDefault();
        save();
      }}
    >
      <Field label="Client's name" htmlFor="d-client">
        <Input id="d-client" value={form.client_name} onChange={set("client_name")} required />
      </Field>
      <Field label="Client's email" htmlFor="d-email">
        <Input id="d-email" type="email" value={form.client_email} onChange={set("client_email")} />
      </Field>
      <Field label="Project name" htmlFor="d-project">
        <Input id="d-project" value={form.project_name} onChange={set("project_name")} />
      </Field>
      <Field label="Medium the images favour" htmlFor="d-medium">
        <Select
          id="d-medium"
          value={form.medium}
          onChange={set("medium")}
        >
          <option value="">Any medium</option>
          {MEDIA.map((m) => (
            <option key={m.key} value={m.key}>
              {m.label}
            </option>
          ))}
        </Select>
      </Field>
      <Field label="First meeting" htmlFor="d-meeting" hint="Shown on the client's thank-you screen.">
        <Input id="d-meeting" type="datetime-local" value={form.meeting_at} onChange={set("meeting_at")} />
      </Field>
      <div className="sm:col-span-2">
        <Field label="Note to the client (optional)" htmlFor="d-note" hint="A line on the welcome screen, in your words.">
          <textarea
            id="d-note"
            rows={2}
            maxLength={400}
            value={form.note}
            onChange={set("note")}
            className="w-full resize-y rounded-xl border border-rule-strong bg-transparent px-3 py-2.5 text-[15px] text-ink focus:border-ink focus:outline-none"
          />
        </Field>
      </div>
      {error ? (
        <p role="alert" className="text-sm text-danger sm:col-span-2">
          {error}
        </p>
      ) : null}
      <div className="sm:col-span-2">
        <Button type="submit" variant={dirty ? "primary" : "secondary"} disabled={!dirty || pending}>
          {pending ? "Saving…" : dirty ? "Save details" : "Saved"}
        </Button>
      </div>
    </form>
  );
}
