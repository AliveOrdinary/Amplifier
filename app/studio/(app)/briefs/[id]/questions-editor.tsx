"use client";

import { useState, useTransition } from "react";
import type { Question, QuestionFormat } from "@/lib/brief/types";
import { Button, Mono, cn } from "@/components/ui/primitives";
import { saveQuestions } from "../actions";

const FORMAT_LABEL: Record<QuestionFormat, string> = {
  long: "Longer answer",
  short: "Short answer",
  three_words: "Three words",
  chips: "Pick from options",
  link: "Name or link",
};

export function QuestionsEditor({ briefId, initial, locked }: { briefId: string; initial: Question[]; locked: boolean }) {
  const [list, setList] = useState(initial);
  const [saved, setSaved] = useState(initial);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const dirty = JSON.stringify(list) !== JSON.stringify(saved);
  const firstId = list.find((q) => q.id === "making")?.id ?? list[0]?.id;

  const update = (i: number, change: Partial<Question>) => setList((l) => l.map((q, j) => (j === i ? { ...q, ...change } : q)));
  const move = (i: number, by: -1 | 1) =>
    setList((l) => {
      const next = [...l];
      const j = i + by;
      if (j < 0 || j >= next.length) return l;
      [next[i], next[j]] = [next[j], next[i]];
      return next;
    });
  const add = (format: QuestionFormat) =>
    setList((l) => [...l, { id: `custom_${Math.random().toString(36).slice(2, 8)}`, prompt: "", format, optional: true }]);

  const save = () =>
    start(async () => {
      const r = await saveQuestions(briefId, list);
      if (!r.ok) return setError(r.error);
      setError(null);
      setSaved(list);
    });

  if (locked) {
    return (
      <ol className="border-t border-rule">
        {list.map((q, i) => (
          <li key={q.id} className="grid grid-cols-[28px_minmax(0,1fr)] gap-3 border-b border-rule py-3">
            <Mono className="pt-0.5">{i + 1}</Mono>
            <span className="text-[15px]">
              {q.prompt}
              {q.optional ? <span className="text-muted"> (optional)</span> : null}
            </span>
          </li>
        ))}
      </ol>
    );
  }

  return (
    <div>
      <ol className="border-t border-rule">
        {list.map((q, i) => (
          <li key={q.id} className="grid grid-cols-[28px_minmax(0,1fr)] gap-3 border-b border-rule py-3">
            <Mono className="pt-3">{i + 1}</Mono>
            <div className="flex min-w-0 flex-col gap-2">
              <label htmlFor={`q-${q.id}`} className="sr-only">
                Question {i + 1}
              </label>
              <input
                id={`q-${q.id}`}
                value={q.prompt}
                maxLength={300}
                placeholder="Write the question"
                onChange={(e) => update(i, { prompt: e.target.value })}
                className="h-11 w-full border border-rule-strong bg-transparent px-3 text-[15px] text-ink focus:border-ink focus:outline-none"
              />
              <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
                <Mono>{FORMAT_LABEL[q.format]}</Mono>
                {q.id === firstId ? <Mono className="text-ink">Asked before the images</Mono> : null}
                <label className="flex items-center gap-1.5 text-sm text-muted">
                  <input type="checkbox" checked={Boolean(q.optional)} onChange={(e) => update(i, { optional: e.target.checked })} />
                  Optional
                </label>
                <span className="ml-auto flex gap-1">
                  <Button size="sm" variant="ghost" aria-label="Move up" disabled={i === 0} onClick={() => move(i, -1)}>
                    ↑
                  </Button>
                  <Button size="sm" variant="ghost" aria-label="Move down" disabled={i === list.length - 1} onClick={() => move(i, 1)}>
                    ↓
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => setList((l) => l.filter((_, j) => j !== i))}>
                    Remove
                  </Button>
                </span>
              </div>
            </div>
          </li>
        ))}
      </ol>
      <div className="mt-4 flex flex-wrap items-center gap-2">
        <Button size="sm" onClick={() => add("short")} disabled={list.length >= 15}>
          Add a short question
        </Button>
        <Button size="sm" onClick={() => add("long")} disabled={list.length >= 15}>
          Add a longer question
        </Button>
        <span className={cn("ml-auto text-sm", list.length > 8 ? "text-danger" : "text-muted")}>
          {list.length} questions{list.length > 8 ? ": that's a lot to ask" : ""}
        </span>
      </div>
      {error ? (
        <p role="alert" className="mt-3 text-sm text-danger">
          {error}
        </p>
      ) : null}
      {dirty ? (
        <div className="mt-4 flex gap-2">
          <Button variant="primary" onClick={save} disabled={pending}>
            {pending ? "Saving…" : "Save questions"}
          </Button>
          <Button variant="ghost" onClick={() => setList(saved)} disabled={pending}>
            Undo changes
          </Button>
        </div>
      ) : null}
    </div>
  );
}
