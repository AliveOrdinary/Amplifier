import type { Metadata } from "next";
import { PasswordForm } from "../forms";
import { JoinShell } from "../shell";

export const metadata: Metadata = { title: "Choose a password" };

/** After an invite or sign-in link: signed in, now choose a password for next time. */
export default function ChoosePasswordPage() {
  return (
    <JoinShell title="Choose a password" lead="You'll sign in with your email and this password from now on.">
      <PasswordForm />
    </JoinShell>
  );
}
