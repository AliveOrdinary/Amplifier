import { getMember } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { monthBounds, spending } from "@/lib/usage";
import { AlertBanner } from "./alert-banner";

/** Shown across the studio once this month's estimate passes the alert set in Settings. */
export async function SpendingAlert() {
  const member = await getMember();
  const db = await createClient();
  const { data: studio } = await db.from("studios").select("monthly_alert_usd").eq("id", member.studioId).maybeSingle();
  if (studio?.monthly_alert_usd == null) return null;
  const limit = Number(studio.monthly_alert_usd);

  const { from, to } = monthBounds(0);
  let total: number;
  try {
    total = (await spending(db, member.studioId, from, to)).total;
  } catch {
    return null;
  }
  if (total < limit) return null;

  const month = from.toISOString().slice(0, 7);
  return <AlertBanner storageKey={`amp-spend-alert:${month}:${limit}`} total={total} limit={limit} />;
}
