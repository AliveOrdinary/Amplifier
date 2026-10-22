import type { BriefResults, ResultImage } from "@/lib/brief/results";
import type { AnswerValue } from "@/lib/brief/types";
import { Mono, cn } from "@/components/ui/primitives";

const seconds = (ms: number | null) => (ms === null ? "–" : `${(ms / 1000).toFixed(1)} s`);

function answerText(value: AnswerValue | null) {
  if (!value) return null;
  if ("skipped" in value) return "Skipped";
  if ("words" in value) return value.words.join(", ");
  if ("chips" in value) return value.chips.join(", ");
  return value.why ? `${value.text} — ${value.why}` : value.text;
}

function Thumb({ image, chosen, dim, size = "size-14" }: { image: ResultImage; chosen?: boolean; dim?: boolean; size?: string }) {
  return (
    <span className={cn("block shrink-0 overflow-hidden bg-panel", size, chosen && "outline outline-2 outline-offset-1 outline-signal", dim && "opacity-35")}>
      {image.thumb ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={image.thumb} alt={image.description ?? ""} title={image.description ?? ""} className="h-full w-full object-cover" />
      ) : null}
    </span>
  );
}

export function Results({ results, completed }: { results: BriefResults; completed: boolean }) {
  const kept = results.warmup.filter((w) => w.choice === "keep");
  const skipped = results.warmup.filter((w) => w.choice === "skip");
  const answered = results.answers.filter((a) => a.value && !("skipped" in a.value)).length;
  const label = new Map(results.lean.map((d) => [d.key, d]));

  return (
    <div className="flex flex-col gap-10">
      <dl className="grid grid-cols-2 gap-x-6 gap-y-3 sm:grid-cols-5">
        {[
          ["Status", completed ? "Completed" : "In progress"],
          ["Answered", `${answered} of ${results.answers.length}`],
          ["Kept", `${kept.length} of ${results.warmup.length}`],
          ["Pairs", String(results.pairs.length)],
          ["Typical pick", seconds(results.medianMs)],
        ].map(([k, v]) => (
          <div key={k}>
            <dt>
              <Mono>{k}</Mono>
            </dt>
            <dd className="mt-0.5 text-[15px]">{v}</dd>
          </div>
        ))}
      </dl>

      {results.lean.length && results.pairs.length ? (
        <div>
          <h3 className="text-[15px] font-medium">Early read: where their choices lean</h3>
          <p className="mt-1 text-sm text-muted">
            The dot is our best guess; the band is how unsure we still are.
            {results.consistency.probes
              ? ` ${results.consistency.same} of ${results.consistency.probes} repeated pairs got the same answer.`
              : ""}
          </p>
          <ul className="mt-3 border-t border-rule">
            {results.lean.map((d) => {
              const pct = (v: number) => `${((Math.max(-2, Math.min(2, v)) + 2) / 4) * 100}%`;
              return (
                <li
                  key={d.key}
                  className="grid h-12 grid-cols-[96px_minmax(0,1fr)_96px] items-center gap-3 border-b border-rule sm:grid-cols-[120px_minmax(0,1fr)_120px_80px]"
                >
                  <span className="truncate text-[14px]">{d.left}</span>
                  <span className="relative h-4" role="img" aria-label={`${d.left} to ${d.right}: ${d.mean.toFixed(1)}, give or take ${d.sd.toFixed(1)}`}>
                    <span className="absolute inset-x-0 top-2 h-px bg-rule-strong" />
                    <span className="absolute top-0.5 left-1/2 h-3 w-px bg-rule-strong" />
                    <span
                      className="absolute top-1 h-2 bg-ink/15"
                      style={{ left: pct(d.mean - d.sd), width: `calc(${pct(d.mean + d.sd)} - ${pct(d.mean - d.sd)})` }}
                    />
                    <span className="absolute top-0.5 size-3 -translate-x-1/2 rounded-full bg-ink" style={{ left: pct(d.mean) }} />
                  </span>
                  <span className="truncate text-right text-[14px]">{d.right}</span>
                  <Mono className="hidden text-right sm:inline">{d.asked} pairs</Mono>
                </li>
              );
            })}
          </ul>
        </div>
      ) : null}

      <div>
        <h3 className="text-[15px] font-medium">In their words</h3>
        <ul className="mt-3 border-t border-rule">
          {results.answers.map(({ question, value }) => (
            <li key={question.id} className="grid gap-x-6 gap-y-1 border-b border-rule py-3 sm:grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)]">
              <span className="text-[14px] text-muted">{question.prompt}</span>
              <span className={cn("text-[15px]", !value && "text-muted")}>{answerText(value) ?? "Not yet"}</span>
            </li>
          ))}
        </ul>
      </div>

      {results.warmup.length ? (
        <div>
          <h3 className="text-[15px] font-medium">Warm-up</h3>
          <div className="mt-3 grid gap-4 sm:grid-cols-2">
            <div>
              <Mono>Kept · {kept.length}</Mono>
              <div className="mt-2 flex flex-wrap gap-2">
                {kept.map((w) => (
                  <Thumb key={w.image.id} image={w.image} />
                ))}
              </div>
            </div>
            <div>
              <Mono>Skipped · {skipped.length}</Mono>
              <div className="mt-2 flex flex-wrap gap-2">
                {skipped.map((w) => (
                  <Thumb key={w.image.id} image={w.image} dim />
                ))}
              </div>
            </div>
          </div>
        </div>
      ) : null}

      {results.pairs.length ? (
        <div>
          <h3 className="text-[15px] font-medium">This or that</h3>
          <ol className="mt-3 border-t border-rule">
            {results.pairs.map((p) => {
              const d = p.target ? label.get(p.target) : null;
              return (
                <li key={p.index} className="flex flex-wrap items-center gap-x-4 gap-y-2 border-b border-rule py-2.5">
                  <Mono className="w-14">{p.probe ? "Repeat" : `Pair ${p.index + 1}`}</Mono>
                  <span className="flex gap-2">
                    <Thumb image={p.a} chosen={p.choice === "a" || p.choice === "both"} dim={p.choice === "b" || p.choice === "neither"} />
                    <Thumb image={p.b} chosen={p.choice === "b" || p.choice === "both"} dim={p.choice === "a" || p.choice === "neither"} />
                  </span>
                  <span className="min-w-0 flex-1 text-[14px]">
                    {d ? `${d.left} ↔ ${d.right}` : "–"}
                    <span className="text-muted">
                      {" · "}
                      {p.choice === "both" ? "Both" : p.choice === "neither" ? "Neither" : `Picked ${p.choice.toUpperCase()}`}
                      {p.caught.length ? ` · noticed ${p.caught.join(", ").toLowerCase()}` : ""}
                    </span>
                  </span>
                  <Mono>{seconds(p.ms)}</Mono>
                </li>
              );
            })}
          </ol>
        </div>
      ) : null}
    </div>
  );
}
