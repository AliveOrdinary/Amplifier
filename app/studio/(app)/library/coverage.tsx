import { Mono } from "@/components/ui/primitives";
import { THIN_BIN } from "@/lib/library/constants";

type Dimension = { key: string; left: string; right: string; bins: number[] };

export function Coverage({
  dimensions,
  media,
  approvedCount,
}: {
  dimensions: Dimension[];
  media: { key: string; label: string; count: number }[];
  approvedCount: number;
}) {
  if (approvedCount === 0) {
    return (
      <p className="text-[15px] text-ink-soft">
        Coverage appears once images are approved. Aim for at least {THIN_BIN} approved images in every bin.
      </p>
    );
  }

  const max = Math.max(1, ...dimensions.flatMap((d) => d.bins));
  // Bins run −2, −1, 0, +1, +2. The middle (balanced) bin isn't flagged.
  const binName = (d: Dimension, i: number) =>
    [`very ${d.left}`, d.left, "", d.right, `very ${d.right}`][i].toLowerCase();
  const thin = dimensions.flatMap((d) =>
    d.bins.flatMap((count, i) => (i !== 2 && count < THIN_BIN ? [binName(d, i)] : [])),
  );

  return (
    <div className="flex flex-col gap-6">
      <p className="flex items-start gap-2 text-[15px]">
        <span aria-hidden className="mt-1.5 size-2 shrink-0 bg-signal" />
        {thin.length
          ? `Thin, under ${THIN_BIN} images: ${[...new Set(thin)].slice(0, 6).join(", ")}${thin.length > 6 ? " and more" : ""}.`
          : "Every bin has enough images."}
      </p>

      <div className="grid grid-cols-[repeat(auto-fit,minmax(150px,1fr))] gap-6">
        {dimensions.map((d) => (
          <figure key={d.key} className="m-0">
            <div
              className="flex h-16 items-end gap-[3px] border-b border-ink"
              role="img"
              aria-label={`${d.left} to ${d.right}: ${d.bins.join(", ")} images`}
            >
              {d.bins.map((count, i) => (
                <div
                  key={i}
                  title={`${count} images`}
                  className={count < THIN_BIN ? "flex-1 bg-signal" : "flex-1 bg-ink"}
                  style={{ height: `${Math.max(4, Math.round((count / max) * 64))}px` }}
                />
              ))}
            </div>
            <figcaption className="mt-1.5 flex justify-between">
              <Mono>{d.left}</Mono>
              <Mono>{d.right}</Mono>
            </figcaption>
          </figure>
        ))}
      </div>

      <div className="flex flex-wrap gap-x-5 gap-y-2">
        {media.map((m) => (
          <span key={m.key} className="text-sm text-ink-soft">
            {m.label} <span className="font-mono text-muted">{m.count}</span>
          </span>
        ))}
      </div>
    </div>
  );
}
