"use client";

import { useActionState } from "react";
import { signIn, type SignInState } from "../auth/actions";
import { Button, Field, Input } from "@/components/ui/primitives";

export function LoginForm({ next, notice }: { next: string; notice?: string }) {
  const [state, action, pending] = useActionState<SignInState, FormData>(signIn, {});

  return (
    <form action={action} className="flex flex-col gap-5" noValidate>
      <input type="hidden" name="next" value={next} />

      {notice && !state.error ? (
        <p className="rounded-xl border border-rule-strong px-3.5 py-2.5 text-sm text-ink-soft" role="status">
          {notice}
        </p>
      ) : null}

      <Field label="Email" htmlFor="email">
        <Input
          id="email"
          name="email"
          type="email"
          autoComplete="email"
          defaultValue={state.email}
          required
          aria-invalid={state.error ? true : undefined}
        />
      </Field>

      <Field label="Password" htmlFor="password" error={state.error}>
        <Input
          id="password"
          name="password"
          type="password"
          autoComplete="current-password"
          required
          aria-invalid={state.error ? true : undefined}
        />
      </Field>

      <Button type="submit" variant="primary" disabled={pending} className="mt-1 w-full">
        {pending ? "Signing in…" : "Sign in"}
      </Button>
    </form>
  );
}
