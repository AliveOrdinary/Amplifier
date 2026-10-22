"use client";

import { MEDIA, THIN_BIN } from "@/lib/library/constants";
import { Mono, PageContainer, Section } from "@/components/ui/primitives";
import { useLibrary } from "../library-provider";

const BIN_LABELS = ["−2", "−1", "0", "+1", "+2"];

export function CoverageScreen() {
  const { images, dimensions: rubric } = useLibrary();
  const approved = images.filter((i) => i.status === "approved");

  const dimensions = rubric.map((d) => {
    const bins = [0, 0, 0, 0, 0];
    for (const image of approved) {
      const value = image.scores[d.key]?.score;
      if (value === undefined) continue;
      bins[Math.max(0, Math.min(4, Math.round(value) + 2))] += 1;
    }
    return { ...d, bins };
  });
  const max = Math.max(1, ...dimensions.flatMap((d) => d.bins));
  const thin = dimensions.flatMap((d) =>
    d.bins.flatMap((count, i) =>
      i !== 2 && count < THIN_BIN ? [[`very ${d.left}`, d.left, "", d.right, `very ${d.right}`][i].toLowerCase()] : [],
    ),
  );
  const media = MEDIA.map((m) => ({ ...m, count: approved.filter((i) => i.medium === m.key).length }));

  return (
    <div className="min-h-0 flex-1 overflow-y-auto">
      <PageContainer className="pt-2">
        <Section
          number="01"
          title="Dimensions"
          description={`How the ${approved.length} approved images spread across each dimension. Briefs need every bin filled.`}
        >
          {approved.length === 0 ? (
            <p className="text-[15px] text-ink-soft">Coverage appears once images are approved.</p>
          ) : (
            <>
              <p className="flex items-start gap-2 text-[15px]">
                <span aria-hidden className="mt-1.5 size-2 shrink-0 bg-signal" />
                {thin.length
                  ? `Under ${THIN_BIN} images: ${[...new Set(thin)].slice(0, 8).join(", ")}${thin.length > 8 ? ", and more" : ""}.`
                  : "Every bin has enough images."}
              </p>
              <div className="mt-6 grid grid-cols-[repeat(auto-fit,minmax(180px,1fr))] gap-x-8 gap-y-8">
                {dimensions.map((d) => (
                  <figure key={d.key} className="m-0">
                    <div
                      className="flex h-24 items-end gap-1 border-b border-ink"
                      role="img"
                      aria-label={`${d.left} to ${d.right}: ${d.bins.join(", ")} approved images`}
                    >
                      {d.bins.map((count, i) => (
                        <div key={i} className="flex flex-1 flex-col items-center justify-end gap-1">
                          <span className="font-mono text-[10px] text-muted">{count}</span>
                          <div
                            className={count < THIN_BIN && i !== 2 ? "w-full bg-signal" : "w-full bg-ink"}
                            style={{ height: `${Math.max(3, Math.round((count / max) * 72))}px` }}
                          />
                        </div>
                      ))}
                    </div>
                    <div className="mt-1 grid grid-cols-5 text-center">
                      {BIN_LABELS.map((label) => (
                        <span key={label} className="font-mono text-[10px] text-muted">
                          {label}
                        </span>
                      ))}
                    </div>
                    <figcaption className="mt-1.5 flex justify-between">
                      <Mono>{d.left}</Mono>
                      <Mono>{d.right}</Mono>
                    </figcaption>
                  </figure>
                ))}
              </div>
            </>
          )}
        </Section>

        <Section number="02" title="Media" description="Approved images by medium." className="border-b-0">
          <ul className="border-t border-rule">
            {media.map((m) => (
              <li key={m.key} className="grid grid-cols-[minmax(0,1fr)_64px] items-center gap-4 border-b border-rule py-2.5">
                <span className="text-[15px]">{m.label}</span>
                <span className="text-right font-mono text-sm">{m.count}</span>
              </li>
            ))}
          </ul>
        </Section>
      </PageContainer>
    </div>
  );
}
