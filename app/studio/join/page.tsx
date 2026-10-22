import type { Metadata } from "next";
import { Suspense } from "react";
import { AcceptForm } from "./forms";
import { JoinShell } from "./shell";

export const metadata: Metadata = { title: "Join the studio" };

/** Where invite and sign-in links land. Open to signed-out visitors (see proxy.ts). */
export default function JoinPage({ searchParams }: PageProps<"/studio/join">) {
  return (
    <JoinShell title="Join Amplifier studio" lead="You've been invited to the studio. Continue to set your password.">
      <Suspense fallback={<AcceptForm tokenHash="" type="invite" />}>
        <WithParams searchParams={searchParams} />
      </Suspense>
    </JoinShell>
  );
}

async function WithParams({ searchParams }: { searchParams: PageProps<"/studio/join">["searchParams"] }) {
  const params = await searchParams;
  const tokenHash = typeof params.token_hash === "string" ? params.token_hash : "";
  const type = params.type === "magiclink" ? "magiclink" : "invite";
  return <AcceptForm tokenHash={tokenHash} type={type} />;
}
