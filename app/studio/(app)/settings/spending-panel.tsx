"use client";

import { useState, useTransition } from "react";
import { Button, Input, Mono } from "@/components/ui/primitives";
import { setSpendingAlert } from "./actions";

export type SpendingLine = { label: string; detail: string; cost: number };
export type MonthSpending = { name: string; total: number; lines: SpendingLine[] };

const usd = (n: number) => (n > 0 && n < 0.01 ? "< $0.01" : `$${n.toFixed(2)}`);

export function SpendingPanel({ thisMonth, lastMonth, alert }: { thisMonth: MonthSpending; lastMonth: MonthSpending; alert: number | null }) {
  const [value, setValue] = useState(alert === null ? "" : String(alert));
  const [message, setMessage] = useState<{ text: string; error?: boolean } | null>(null);
  const [pending, start] = useTransition();
  const over = alert !== null && thisMonth.total >= alert;

  return (
    <div className="flex flex-col gap-8">
      <div className="grid gap-6 sm:grid-cols-2">
        <Month month={thisMonth} highlight={over} />
        <Month month={lastMonth} muted />
      </div>
      <p className="-mt-3 text-sm text-muted">
        Estimates from the token counts Claude and Voyage report, at list prices, by calendar month (UTC). Your Anthropic and
        Voyage dashboards show the actual bills.
      </p>

      <form
        className="flex flex-col gap-2.5"
        onSubmit={(e) => {
          e.preventDefault();
          start(async () => {
            const r = await setSpendingAlert(value);
            setMessage(
              r.ok
                ? { text: value.trim() ? `Saved. Everyone sees an alert once this month passes $${Number(value.replace(/^\$/, "")).toFixed(2)}.` : "Alert turned off." }
                : { text: r.error, error: true },
            );
          });
        }}
      >
        <label htmlFor="alert" className="font-mono text-label uppercase tracking-[0.08em] text-muted">
          Monthly alert
        </label>
        <div className="flex items-center gap-2">
          <div className="relative w-36">
            <span aria-hidden className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-[15px] text-muted">
              $
            </span>
            <Input
              id="alert"
              inputMode="decimal"
              placeholder="25"
              value={value}
              onChange={(e) => setValue(e.target.value)}
              aria-describedby="alert-hint"
              className="pl-7"
            />
          </div>
          <Button type="submit" disabled={pending} className="h-11">
            {pending ? "Saving…" : "Save"}
          </Button>
        </div>
        <p id="alert-hint" className="-mt-1 max-w-[60ch] text-sm text-muted">
          Everyone sees an alert across the studio once the month passes this. Leave it empty for no alert.
        </p>
        {message ? (
          <p role={message.error ? "alert" : "status"} className={message.error ? "text-sm text-danger" : "text-sm text-ink-soft"}>
            {message.text}
          </p>
        ) : null}
      </form>
    </div>
  );
}

function Month({ month, highlight, muted }: { month: MonthSpending; highlight?: boolean; muted?: boolean }) {
  return (
    <div className={muted ? "text-ink-soft" : undefined}>
      <Mono>{month.name}</Mono>
      <p className="mt-1 flex items-center gap-2 text-[32px] font-medium leading-none tracking-[-0.02em]">
        {highlight ? <span aria-hidden className="size-2 bg-signal" /> : null}≈ {usd(month.total)}
      </p>
      <ul className="mt-3 border-t border-rule">
        {month.lines.length ? (
          month.lines.map((l) => (
            <li key={l.label} className="grid grid-cols-[minmax(0,1fr)_auto] gap-3 border-b border-rule py-2 text-sm">
              <span>
                {l.label} <span className="text-muted">· {l.detail}</span>
              </span>
              <span className="font-mono">{usd(l.cost)}</span>
            </li>
          ))
        ) : (
          <li className="py-2 text-sm text-muted">Nothing yet.</li>
        )}
      </ul>
    </div>
  );
}
