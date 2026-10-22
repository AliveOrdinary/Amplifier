import type { Metadata } from "next";
import { headers } from "next/headers";
import { notFound } from "next/navigation";
import { getMember } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { getImages, libraryCoverage } from "@/lib/library/queries";
import { listDimensions } from "@/lib/library/rubric";
import { briefResults } from "@/lib/brief/results";
import type { Plan } from "@/lib/brief/engine";
import type { Question } from "@/lib/brief/types";
import { ButtonLink, Mono, PageContainer, PageHeader, Section } from "@/components/ui/primitives";
import { StatusLabel } from "../status";
import { LinkPanel } from "./link-panel";
import { DetailsForm } from "./details-form";
import { QuestionsEditor } from "./questions-editor";
import { PinsPanel } from "./pins-panel";
import { Results } from "./results";

export const metadata: Metadata = { title: "Brief" };

const isPast = (iso: string | null) => (iso ? Date.parse(iso) < Date.now() : false);

export default async function BriefPage({ params }: PageProps<"/studio/briefs/[id]">) {
  const { id } = await params;
  const member = await getMember();
  const db = await createClient();

  const { data, error } = await db
    .from("briefs")
    .select(
      "id, client_name, client_email, project_name, project_type, medium, questions, token, status, note, plan, expires_at, meeting_at, sent_at, started_at, completed_at, created_at",
    )
    .eq("id", id)
    .eq("studio_id", member.studioId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) notFound();
  const brief = data as typeof data & { questions: Question[]; plan: Plan | null };

  const h = await headers();
  const origin = `${h.get("x-forwarded-proto") ?? "https"}://${h.get("x-forwarded-host") ?? h.get("host")}`;

  const [{ data: template }, { data: pinRows }, coverage, dimensions] = await Promise.all([
    db.from("question_templates").select("name").eq("studio_id", member.studioId).eq("project_type", brief.project_type).maybeSingle(),
    db.from("brief_pins").select("image_id, created_at").eq("brief_id", brief.id).order("created_at"),
    brief.started_at ? Promise.resolve(null) : libraryCoverage(db, member.studioId),
    listDimensions(db, member.studioId),
  ]);
  const pinIds = (pinRows ?? []).map((r) => r.image_id as string);
  const pins = await getImages(db, pinIds);
  const results = brief.started_at ? await briefResults(db, brief) : null;

  // Is the library ready for this brief? (Counted in the database.)
  const approved = coverage?.approved ?? 0;
  const inMedium = brief.medium ? (coverage?.media[brief.medium] ?? 0) : null;
  const untestable = dimensions.filter((d) => {
    const bins = coverage?.bins[d.key] ?? [0, 0, 0, 0, 0];
    return bins[0] + bins[1] < 2 || bins[3] + bins[4] < 2;
  });

  const locked = Boolean(brief.started_at);

  return (
    <PageContainer>
      <PageHeader
        eyebrow={
          <>
            <Mono>{template?.name ?? brief.project_type}</Mono>
            <StatusLabel status={brief.status} />
          </>
        }
        title={brief.client_name}
        actions={
          brief.started_at ? (
            <ButtonLink href={`/studio/briefs/${brief.id}/prep`} variant={brief.completed_at ? "primary" : "secondary"}>
              Open prep page
            </ButtonLink>
          ) : undefined
        }
      />

      <Section number="01" title="Link" description="Private to this client. Anyone with it can fill in the brief, so send it only to them.">
        <LinkPanel
          briefId={brief.id}
          url={`${origin}/b/${brief.token}`}
          status={brief.status}
          expiresAt={brief.expires_at}
          expired={isPast(brief.expires_at)}
          readiness={
            locked
              ? null
              : { approved, inMedium, untestable: untestable.map((d) => `${d.left} ↔ ${d.right}`) }
          }
          timeline={[
            ["Made", brief.created_at],
            ["Sent", brief.sent_at],
            ["Started", brief.started_at],
            ["Completed", brief.completed_at],
          ]}
        />
      </Section>

      {results ? (
        <Section number="02" title="Results" description="What they chose and wrote. The prep page, comparing the two, comes next.">
          <Results results={results} completed={Boolean(brief.completed_at)} />
        </Section>
      ) : null}

      <Section number={results ? "03" : "02"} title="Details" description="The project name and note appear on the client's welcome screen.">
        <DetailsForm
          briefId={brief.id}
          initial={{
            client_name: brief.client_name,
            client_email: brief.client_email ?? "",
            project_name: brief.project_name ?? "",
            medium: brief.medium ?? "",
            meeting_at: brief.meeting_at,
            note: brief.note ?? "",
          }}
        />
      </Section>

      <Section
        number={results ? "04" : "03"}
        title="Questions"
        description={locked ? "Locked: the client has started." : "One before the images, the rest after. Keep it short; every question costs attention."}
      >
        <QuestionsEditor briefId={brief.id} initial={brief.questions ?? []} locked={locked} />
      </Section>

      <Section
        number={results ? "05" : "04"}
        title="Pins"
        description={
          locked
            ? "Locked: the client has started."
            : "Images you want this client to see, such as references they sent. Pins always appear in the warm-up."
        }
        className="border-b-0"
      >
        <PinsPanel
          briefId={brief.id}
          locked={locked}
          pins={pins.map((p) => ({ id: p.id, thumb: p.thumbUrl, description: p.description }))}
        />
      </Section>
    </PageContainer>
  );
}
