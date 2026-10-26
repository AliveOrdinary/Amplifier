"use client";

import type { StudioMedia } from "@/lib/portfolio/studio";
import type { ProjectFrench, StoredBlock } from "@/lib/portfolio/types";
import { Field, Input, Mono, cn } from "@/components/ui/primitives";
import { Thumb } from "./media-panel";

type English = { title: string; services: string; summary: string };

/**
 * The French version of a project, beside the English it translates.
 * Anything left empty shows in English on the French site, so a project
 * can go live in French a piece at a time.
 */
export function FrenchEditor({
  english,
  blocks,
  media,
  fr,
  onChange,
  areaClass,
}: {
  english: English;
  blocks: StoredBlock[];
  media: StudioMedia[];
  fr: ProjectFrench;
  onChange: (fr: ProjectFrench) => void;
  areaClass: string;
}) {
  const byId = new Map(media.map((m) => [m.id, m]));
  const setBlock = (id: string, value: { text?: string; caption?: string }) =>
    onChange({ ...fr, blocks: { ...fr.blocks, [id]: value } });

  // How much is written: the details, each text block and caption, and alt text for each file.
  const parts: boolean[] = [
    Boolean(fr.title?.trim()),
    ...(english.summary.trim() ? [Boolean(fr.summary?.trim())] : []),
    ...(english.services.trim() ? [Boolean(fr.services?.some(Boolean))] : []),
    ...blocks.flatMap((b) =>
      b.type === "text"
        ? b.text.trim()
          ? [Boolean(fr.blocks?.[b.id]?.text?.trim())]
          : []
        : b.caption?.trim()
          ? [Boolean(fr.blocks?.[b.id]?.caption?.trim())]
          : [],
    ),
    ...media.filter((m) => m.alt.trim()).map((m) => Boolean(fr.alt?.[m.id]?.trim())),
  ];
  const done = parts.filter(Boolean).length;

  return (
    <div className="flex max-w-3xl flex-col gap-8">
      <p className="text-[15px] text-ink-soft">
        <Mono className="mr-2 text-ink">
          {done} / {parts.length}
        </Mono>
        written. Anything left empty shows in English on the French site.
      </p>

      <div className="flex flex-col gap-6">
        <Field label="Name" htmlFor="fr-title" hint={english.title ? `English: ${english.title}` : undefined}>
          <Input id="fr-title" lang="fr" value={fr.title ?? ""} placeholder={english.title} onChange={(e) => onChange({ ...fr, title: e.target.value })} />
        </Field>
        <Field label="Services" htmlFor="fr-services" hint={english.services ? `English: ${english.services}` : "Separated by commas."}>
          <Input
            id="fr-services"
            lang="fr"
            value={(fr.services ?? []).join(", ")}
            placeholder="Nom, Identité, Emballage"
            onChange={(e) => onChange({ ...fr, services: e.target.value.split(",").map((s) => s.trimStart()) })}
          />
        </Field>
        <Field label="Summary" htmlFor="fr-summary">
          <English text={english.summary} />
          <textarea id="fr-summary" lang="fr" rows={3} value={fr.summary ?? ""} onChange={(e) => onChange({ ...fr, summary: e.target.value })} className={areaClass} />
        </Field>
      </div>

      {blocks.length ? (
        <div className="flex flex-col gap-4">
          <Mono>Case study</Mono>
          <ol className="flex flex-col gap-4">
            {blocks.map((b, i) => (
              <li key={b.id} className="border border-rule-strong p-4">
                <Mono className="mb-3 block">
                  {String(i + 1).padStart(2, "0")} · {b.type === "text" ? "Text" : "Caption"}
                </Mono>
                {b.type === "text" ? (
                  <>
                    <English text={b.text} markdown />
                    <label htmlFor={`fr-b-${b.id}`} className="sr-only">
                      French text
                    </label>
                    <textarea
                      id={`fr-b-${b.id}`}
                      lang="fr"
                      rows={Math.min(18, Math.max(4, (fr.blocks?.[b.id]?.text ?? b.text).split("\n").length + 1))}
                      value={fr.blocks?.[b.id]?.text ?? ""}
                      onChange={(e) => setBlock(b.id, { text: e.target.value })}
                      className={areaClass}
                    />
                  </>
                ) : (
                  <div className="flex items-start gap-4">
                    <div className="w-28 shrink-0">{byId.get(b.media[0]) ? <Thumb media={byId.get(b.media[0])!} className="h-20" /> : null}</div>
                    <div className="min-w-0 flex-1">
                      <English text={b.caption ?? ""} empty="No English caption." />
                      <label htmlFor={`fr-c-${b.id}`} className="sr-only">
                        French caption
                      </label>
                      <Input
                        id={`fr-c-${b.id}`}
                        lang="fr"
                        className="h-9"
                        value={fr.blocks?.[b.id]?.caption ?? ""}
                        placeholder="Légende (facultatif)"
                        onChange={(e) => setBlock(b.id, { caption: e.target.value })}
                      />
                    </div>
                  </div>
                )}
              </li>
            ))}
          </ol>
        </div>
      ) : null}

      {media.length ? (
        <div className="flex flex-col gap-4">
          <div>
            <Mono>Alt text</Mono>
            <p className="mt-1 text-sm text-muted">What each image shows, read aloud to people who can’t see it.</p>
          </div>
          <ul className="flex flex-col gap-3">
            {media.map((m) => (
              <li key={m.id} className="flex items-start gap-4">
                <div className="w-28 shrink-0">
                  <Thumb media={m} className="h-20" />
                </div>
                <div className="min-w-0 flex-1">
                  <English text={m.alt} empty="No English alt text yet (set it under Images and video)." />
                  <label htmlFor={`fr-alt-${m.id}`} className="sr-only">
                    French alt text
                  </label>
                  <Input
                    id={`fr-alt-${m.id}`}
                    lang="fr"
                    className="h-9"
                    value={fr.alt?.[m.id] ?? ""}
                    onChange={(e) => onChange({ ...fr, alt: { ...fr.alt, [m.id]: e.target.value } })}
                  />
                </div>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  );
}

/** The English being translated, quiet and above its French field. */
function English({ text, markdown, empty }: { text: string; markdown?: boolean; empty?: string }) {
  if (!text.trim()) return empty ? <p className="mb-2 text-sm text-muted italic">{empty}</p> : null;
  return (
    <p
      lang="en"
      className={cn(
        "mb-2 max-h-48 overflow-auto border-l-2 border-rule-strong pl-3 text-sm leading-relaxed text-muted",
        markdown && "whitespace-pre-wrap",
      )}
    >
      {text}
    </p>
  );
}
