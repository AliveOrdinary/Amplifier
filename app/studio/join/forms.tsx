"use client";

import Link from "next/link";
import { useActionState } from "react";
import { Button, Field, Input } from "@/components/ui/primitives";
import { acceptLink, choosePassword, type JoinState, type PasswordState } from "./actions";

export function AcceptForm({ tokenHash, type }: { tokenHash: string; type: string }) {
  const [state, action, pending] = useActionState<JoinState, FormData>(acceptLink, {});
  return (
    <form action={action} className="flex flex-col gap-4">
      <input type="hidden" name="token_hash" value={tokenHash} />
      <input type="hidden" name="type" value={type} />
      {state.error ? (
        <p role="alert" className="text-sm text-danger">
          {state.error}
        </p>
      ) : null}
      <Button type="submit" variant="primary" disabled={pending || !tokenHash} className="w-full">
        {pending ? "Checking the link…" : "Continue"}
      </Button>
    </form>
  );
}

export function PasswordForm() {
  const [state, action, pending] = useActionState<PasswordState, FormData>(choosePassword, {});
  return (
    <form action={action} className="flex flex-col gap-5" noValidate>
      <Field label="New password" htmlFor="password" hint="At least 10 characters.">
        <Input id="password" name="password" type="password" autoComplete="new-password" required />
      </Field>
      <Field label="Type it again" htmlFor="confirm" error={state.error}>
        <Input id="confirm" name="confirm" type="password" autoComplete="new-password" required aria-invalid={state.error ? true : undefined} />
      </Field>
      <Button type="submit" variant="primary" disabled={pending} className="mt-1 w-full">
        {pending ? "Saving…" : "Save and open the studio"}
      </Button>
      <Link href="/studio/library" className="text-center text-sm text-muted underline-offset-2 hover:text-ink hover:underline">
        Keep my current password
      </Link>
    </form>
  );
}
