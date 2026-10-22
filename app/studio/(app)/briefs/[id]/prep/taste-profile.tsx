import type { DimensionEvidence } from "@/lib/brief/evidence";
import { GAP, type SaidPosition } from "@/lib/brief/report-types";
import { Mono } from "@/components/ui/primitives";

const pct = (v: number) => `${((Math.max(-2, Math.min(2, v)) + 2) / 4) * 100}%`;

/** Where their words put them (ring) against where their choices did (square), per dimension. */
export function TasteProfile({ dimensions, said }: { dimensions: DimensionEvidence[]; said: SaidPosition[] }) {
  const saidBy = new Map(said.map((s) => [s.key, s]));
  return (
    <div>
      <div className="mb-3 flex flex-wrap gap-x-6 gap-y-2 text-sm text-muted">
        <span className="flex items-center gap-2">
          <span aria-hidden className="size-2.5 rounded-full border-[1.5px] border-ink" /> Said, from their answers
        </span>
        <span className="flex items-center gap-2">
          <span aria-hidden className="size-2.5 bg-ink" /> Showed, from their choices
        </span>
        <span className="flex items-center gap-2">
          <span aria-hidden className="h-[3px] w-4 bg-signal" /> Gap worth asking about
        </span>
      </div>
      <ul className="border-t border-rule">
        {dimensions.map((d) => {
          const s = saidBy.get(d.key);
          const position = s?.position ?? null;
          const gap = position === null ? 0 : Math.abs(position - d.mean);
          const flagged = position !== null && gap >= GAP && d.confidence !== "low";
          const lo = position === null ? d.mean : Math.min(position, d.mean);
          const description = `${d.left} to ${d.right}. Showed ${d.mean.toFixed(1)}, ${d.confidence} confidence.${
            position === null ? " Their words didn't say." : ` Said ${position.toFixed(1)}${s?.evidence ? ` (“${s.evidence}”)` : ""}.`
          }`;
          return (
            <li
              key={d.key}
              className="grid min-h-[52px] grid-cols-[88px_minmax(0,1fr)_88px] items-center gap-3 border-b border-rule py-2 sm:grid-cols-[120px_minmax(0,1fr)_120px_90px]"
            >
              <span className="truncate text-[15px]">{d.left}</span>
              <span className="relative h-5" role="img" aria-label={description} title={description}>
                <span className="absolute inset-x-0 top-2.5 h-px bg-rule-strong" />
                <span className="absolute top-1 left-1/2 h-3 w-px bg-rule-strong" />
                {flagged ? (
                  <span className="absolute top-[9px] h-[3px] bg-signal" style={{ left: pct(lo), width: `${(gap / 4) * 100}%` }} />
                ) : null}
                {position !== null ? (
                  <span
                    className="absolute top-1 size-3 -translate-x-1/2 rounded-full border-[1.5px] border-ink bg-paper"
                    style={{ left: pct(position) }}
                  />
                ) : null}
                <span className="absolute top-[3px] size-3.5 -translate-x-1/2 bg-ink" style={{ left: pct(d.mean) }} />
              </span>
              <span className="truncate text-right text-[15px]">{d.right}</span>
              <Mono className="hidden text-right sm:inline">{d.confidence}</Mono>
            </li>
          );
        })}
      </ul>
      <p className="mt-2 text-sm text-muted">Hover a row for the words and numbers behind it. No ring means their words didn&apos;t say.</p>
    </div>
  );
}
