import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import { getMember } from "@/lib/auth";
import { EmptyState, Mono, PageContainer, PageHeader, Section } from "@/components/ui/primitives";
import { ExtensionKeys, type MemberKey } from "./extension-keys";

export const metadata: Metadata = { title: "Settings" };

export default async function SettingsPage() {
  const member = await getMember();
  const db = await createClient();
  const { data: keys } = await db
    .from("member_keys")
    .select("id, label, key_prefix, created_at, last_used_at")
    .is("revoked_at", null)
    .order("created_at", { ascending: false });

  return (
    <PageContainer>
      <PageHeader eyebrow={<Mono>{member.studioName}</Mono>} title="Settings" />

      <Section
        number="01"
        title="Adding from the web"
        description="Right-click any image in Chrome, or share from your phone, straight into the library."
      >
        <ExtensionKeys keys={(keys ?? []) as MemberKey[]} />
      </Section>

      <Section number="02" title="Members" description="Who can sign in to the studio." className="border-b-0">
        <EmptyState title="Invites are coming next">
          Inviting studio members by email arrives after the library, sent through Resend from amplifier.studio.
        </EmptyState>
      </Section>
    </PageContainer>
  );
}
