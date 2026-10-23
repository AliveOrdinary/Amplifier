import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getMember } from "@/lib/auth";
import { monthBounds, spending, type Spending } from "@/lib/usage";
import { Section } from "@/components/ui/primitives";
import { ExtensionKeys, type MemberKey } from "./extension-keys";
import { MembersPanel, type MemberRow } from "./members-panel";
import { SpendingPanel, type MonthSpending } from "./spending-panel";

export const metadata: Metadata = { title: "Settings" };

export default async function SettingsPage() {
  const member = await getMember();
  const db = await createClient();
  const thisMonth = monthBounds(0);
  const lastMonth = monthBounds(-1);

  const [{ data: keys }, members, now, before, { data: studio }] = await Promise.all([
    db
      .from("member_keys")
      .select("id, label, key_prefix, created_at, last_used_at")
      .is("revoked_at", null)
      .order("created_at", { ascending: false }),
    loadMembers(member.studioId, member.userId),
    spending(db, member.studioId, thisMonth.from, thisMonth.to),
    spending(db, member.studioId, lastMonth.from, lastMonth.to),
    db.from("studios").select("monthly_alert_usd").eq("id", member.studioId).maybeSingle(),
  ]);
  const alert = studio?.monthly_alert_usd == null ? null : Number(studio.monthly_alert_usd);

  return (
    <>
      <Section
        number="01"
        title="Adding from the web"
        description="Right-click any image in Chrome, or share from your phone, straight into the library."
      >
        <ExtensionKeys keys={(keys ?? []) as MemberKey[]} />
      </Section>

      <Section id="members" number="02" title="Members" description="Who can sign in. Everyone can do everything, including inviting and removing.">
        <MembersPanel members={members} />
      </Section>

      <Section
        id="spending"
        number="03"
        title="Spending"
        description="What scoring, prep reports and search have cost on Claude and Voyage."
        className="border-b-0"
      >
        <SpendingPanel thisMonth={month(thisMonth.from, now)} lastMonth={month(lastMonth.from, before)} alert={alert} />
      </Section>
    </>
  );
}

async function loadMembers(studioId: string, you: string): Promise<MemberRow[]> {
  const admin = createAdminClient();
  const { data: rows, error } = await admin
    .from("members")
    .select("user_id, display_name, created_at")
    .eq("studio_id", studioId)
    .order("created_at");
  if (error) throw new Error(error.message);

  return Promise.all(
    (rows ?? []).map(async (row) => {
      const { data } = await admin.auth.admin.getUserById(row.user_id);
      const user = data.user;
      const email = user?.email ?? null;
      return {
        userId: row.user_id,
        name: row.display_name ?? email?.split("@")[0] ?? "Member",
        email,
        joined: Boolean(user?.last_sign_in_at),
        you: row.user_id === you,
      };
    }),
  );
}

const plural = (count: number, one: string, many = `${one}s`) => `${count.toLocaleString("en")} ${count === 1 ? one : many}`;

/** The month's spending as lines people recognise, biggest first. */
function month(from: Date, s: Spending): MonthSpending {
  const k = (kind: string) => s.byKind[kind] ?? { calls: 0, images: 0, cost: 0 };
  const lines = [
    { label: "Scoring in batches", detail: `${plural(k("score_batch").images, "image")}, half price`, cost: k("score_batch").cost },
    { label: "Scoring right away", detail: plural(k("score").images, "image"), cost: k("score").cost },
    { label: "Prep reports", detail: plural(k("report").calls, "report"), cost: k("report").cost },
    {
      label: "Search and matching",
      detail: `${plural(k("embed_image").images, "image")}, ${plural(k("embed_text").calls, "search", "searches")}`,
      cost: k("embed_image").cost + k("embed_text").cost,
    },
  ]
    .filter((l) => l.cost > 0)
    .sort((a, b) => b.cost - a.cost);

  return {
    name: from.toLocaleDateString("en-GB", { month: "long", year: "numeric", timeZone: "UTC" }),
    total: s.total,
    lines,
  };
}
