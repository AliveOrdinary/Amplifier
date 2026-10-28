"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { Button, Mono, Wordmark, cn } from "@/components/ui/primitives";
import { CAUGHT, type AnswerValue, type BriefInput, type Progress, type Question, type ShownImage, type Step } from "@/lib/brief/types";
import { advance, type Advance } from "./actions";

type Intro = "warmup" | "pairs" | "words" | null;

/** A short explainer before each part, shown once when the part starts. */
function introFor(next: Step, previous?: Step): Intro {
  if (next.kind === "swipe" && next.index === 0) return "warmup";
  if (next.kind === "pair" && next.index === 0) return "pairs";
  if (next.kind === "question" && next.part === "last" && next.index === 0 && previous?.kind !== "question") return "words";
  return null;
}

export function BriefFlow({ token, initialStep, initialProgress }: { token: string; initialStep: Step; initialProgress: Progress }) {
  const [step, setStep] = useState(initialStep);
  const [progress, setProgress] = useState(initialProgress);
  const [intro, setIntro] = useState<Intro>(() => introFor(initialStep));
  const [waiting, setWaiting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Everything the client does is saved in order through one queue. Warm-up
  // swipes move on at once (the images are known ahead); everything else
  // waits for the server to say what comes next.
  const queue = useRef<BriefInput[]>([]);
  const running = useRef<Promise<void> | null>(null);
  const failed = useRef(false);
  const waitingFor = useRef(false);
  const shownStep = useRef(step);
  useEffect(() => {
    shownStep.current = step;
  }, [step]);

  const pump = (): Promise<void> => {
    running.current ??= (async () => {
      failed.current = false;
      let latest: Extract<Advance, { ok: true }> | null = null;
      while (queue.current.length) {
        const r = await advance(token, queue.current[0]);
        if (!r.ok) {
          failed.current = true;
          setError(r.error);
          return;
        }
        queue.current.shift();
        latest = r;
      }
      if (waitingFor.current && latest) {
        waitingFor.current = false;
        setWaiting(false);
        setIntro(introFor(latest.step, shownStep.current));
        setStep(latest.step);
        setProgress(latest.progress);
        window.scrollTo({ top: 0 });
      }
    })().finally(() => {
      running.current = null;
      // Something arrived while the last request was finishing.
      if (queue.current.length && !failed.current) void pump();
    });
    return running.current;
  };

  function submit(input: BriefInput, next?: Step) {
    setError(null);
    queue.current.push(input);
    if (next) {
      setStep(next);
      setProgress((p) => ({ ...p, done: Math.min(p.total, p.done + 1) }));
    } else {
      waitingFor.current = true;
      setWaiting(true);
    }
    void pump();
  }

  const fullScreen = !intro && (step.kind === "swipe" || step.kind === "pair");

  return (
    <div className={cn("mx-auto flex w-full max-w-5xl flex-col", fullScreen ? "h-dvh min-h-[560px] flex-none" : "flex-1")}>
      <Header step={step} progress={progress} intro={intro} />
      <main className="flex min-h-0 flex-1 flex-col px-4 pb-5 sm:px-6">
        {intro ? (
          <Interlude kind={intro} step={step} onContinue={() => setIntro(null)} />
        ) : (
          <Screen step={step} pending={waiting} submit={submit} />
        )}
        {error ? (
          <div role="alert" className="mt-3 flex flex-wrap items-center gap-3 rounded-xl border border-danger px-3.5 py-2.5 text-sm text-danger">
            <span className="min-w-0 flex-1">{error}</span>
            <button
              type="button"
              className="underline underline-offset-2"
              onClick={() => {
                setError(null);
                void pump();
              }}
            >
              Try again
            </button>
          </div>
        ) : null}
      </main>
    </div>
  );
}

function Header({ step, progress, intro }: { step: Step; progress: Progress; intro: Intro }) {
  const pad = (n: number) => String(n).padStart(2, "0");
  const label = intro
    ? null
    : step.kind === "swipe"
      ? `Warm-up ${pad(step.index + 1)} / ${pad(step.total)}`
      : step.kind === "pair"
        ? `Pair ${pad(step.index + 1)} / ${pad(step.total)}`
        : step.kind === "question" && step.part === "last"
          ? `Question ${step.index + 1} / ${step.total}`
          : null;
  const showBar = step.kind !== "welcome" && step.kind !== "closed";
  return (
    <header className="shrink-0 px-4 sm:px-6">
      <div className="flex h-14 items-center justify-between">
        <Wordmark className="text-[19px]" />
        {label ? <Mono>{label}</Mono> : null}
      </div>
      {showBar ? (
        <div
          role="progressbar"
          aria-label="Progress"
          aria-valuemin={0}
          aria-valuemax={progress.total}
          aria-valuenow={progress.done}
          className="h-0.5 bg-rule"
        >
          <div className="h-0.5 bg-signal transition-[width] duration-300" style={{ width: `${(100 * progress.done) / Math.max(1, progress.total)}%` }} />
        </div>
      ) : null}
    </header>
  );
}

function Screen({ step, pending, submit }: { step: Step; pending: boolean; submit: (input: BriefInput, next?: Step) => void }) {
  const send = (input: BriefInput) => submit(input);
  switch (step.kind) {
    case "welcome":
      return <Welcome step={step} pending={pending} onStart={() => send({ kind: "start" })} />;
    case "question":
      return (
        <QuestionScreen
          key={step.question.id}
          question={step.question}
          pending={pending}
          onAnswer={(value) => send({ kind: "answer", questionId: step.question.id, value })}
        />
      );
    case "swipe":
      return (
        <SwipeScreen
          key={step.seq}
          step={step}
          pending={pending}
          onChoose={(choice, ms) =>
            submit(
              { kind: "swipe", seq: step.seq, imageId: step.image.id, choice, ms },
              step.upcoming.length
                ? { ...step, seq: step.seq + 1, image: step.upcoming[0], upcoming: step.upcoming.slice(1), index: step.index + 1 }
                : undefined,
            )
          }
        />
      );
    case "pair":
      return (
        <PairScreen
          key={step.seq}
          step={step}
          pending={pending}
          onChoose={(choice, caught, ms) => send({ kind: "pair", seq: step.seq, choice, caught, ms })}
        />
      );
    case "done":
      return <Done meetingAt={step.meetingAt} />;
    case "closed":
      return <Closed reason={step.reason} />;
  }
}

/* --------------------------------------------------------------- screens */

/** A screen of words: a small numbered label, a big headline (as on the site), then the text. */
function Prose({ label, title, children, action }: { label?: string; title: ReactNode; children?: ReactNode; action?: ReactNode }) {
  return (
    <div className="flex flex-1 flex-col pt-12 sm:pt-20">
      <div className="max-w-2xl">
        {label ? <p className="mb-5 font-mono text-[12px] tracking-[0.08em] text-muted uppercase">{label}</p> : null}
        <h1 className="text-[clamp(44px,8vw,80px)] leading-[0.92] font-medium tracking-[-0.035em]">{title}</h1>
        <div className="mt-7 max-w-xl space-y-4 text-[18px] leading-relaxed text-ink-soft">{children}</div>
      </div>
      {action ? <div className="mt-auto pt-10 sm:mt-10">{action}</div> : null}
    </div>
  );
}

function Welcome({ step, pending, onStart }: { step: Extract<Step, { kind: "welcome" }>; pending: boolean; onStart: () => void }) {
  const first = step.client.trim().split(/\s+/)[0];
  return (
    <Prose
      label="00 / Visual brief"
      title={`Hi ${first}.`}
      action={
        <div className="flex flex-col gap-3 sm:max-w-xs">
          <Button variant="primary" className="h-14 text-base" onClick={onStart} disabled={pending}>
            {pending ? "Getting ready…" : "Start"}
          </Button>
          <p className="text-sm text-muted">Only the Amplifier studio sees your answers. You can stop and come back to this link.</p>
        </div>
      }
    >
      <p>
        Before we meet, we&apos;d like to see what you&apos;re drawn to{step.project ? ` for ${step.project}` : ""}.
      </p>
      <p>
        It takes about {step.minutes} minutes: one question, a run of images, then a few questions in words. There are no
        right or wrong answers, and it isn&apos;t a test of taste. Go with your first reaction.
      </p>
      {step.note ? <p className="border-l-2 border-signal pl-4 text-ink">{step.note}</p> : null}
    </Prose>
  );
}

function Interlude({ kind, step, onContinue }: { kind: Exclude<Intro, null>; step: Step; onContinue: () => void }) {
  const total = step.kind === "swipe" || step.kind === "pair" ? step.total : 0;
  const copy = {
    warmup: {
      label: "01 / Warm-up",
      title: "First, a warm-up.",
      body: `${total} images, one at a time. Keep the ones you'd want around your project and skip the rest. Don't think too long.`,
    },
    pairs: {
      label: "02 / This or that",
      title: "Now, this or that.",
      body: `${total} pairs. Tap the one that feels closer to what you want. If both or neither fit, say so.`,
    },
    words: { label: "03 / In words", title: "Last part.", body: "A few questions in words. Short answers are fine." },
  }[kind];
  return (
    <Prose
      label={copy.label}
      title={copy.title}
      action={
        <Button variant="primary" className="h-14 w-full text-base sm:w-auto sm:px-10" onClick={onContinue} autoFocus>
          Continue
        </Button>
      }
    >
      <p>{copy.body}</p>
    </Prose>
  );
}

function Done({ meetingAt }: { meetingAt: string | null }) {
  const when = meetingAt
    ? new Date(meetingAt).toLocaleDateString(undefined, { weekday: "long", day: "numeric", month: "long" })
    : null;
  return (
    <Prose label="04 / Done" title="Thank you.">
      <p>That&apos;s everything. We&apos;ll go through it before we meet{when ? ` on ${when}` : ""}.</p>
      <p>You can close this page.</p>
    </Prose>
  );
}

function Closed({ reason }: { reason: Extract<Step, { kind: "closed" }>["reason"] }) {
  const body =
    reason === "expired"
      ? "This link has expired. Ask the studio for a new one."
      : reason === "archived"
        ? "This brief is closed. Thanks for your time."
        : "This brief isn't ready yet. Try again later.";
  return (
    <Prose label="Visual brief" title="This link is closed.">
      <p>{body}</p>
    </Prose>
  );
}

/* ------------------------------------------------------------- questions */

function QuestionScreen({ question, pending, onAnswer }: { question: Question; pending: boolean; onAnswer: (value: AnswerValue) => void }) {
  const [text, setText] = useState("");
  const [why, setWhy] = useState("");
  const [words, setWords] = useState(["", "", ""]);
  const [chips, setChips] = useState<string[]>([]);

  const value: AnswerValue | null =
    question.format === "three_words"
      ? words.every((w) => w.trim())
        ? { words: words.map((w) => w.trim()) }
        : null
      : question.format === "chips"
        ? chips.length
          ? { chips }
          : null
        : text.trim()
          ? question.format === "link" && why.trim()
            ? { text: text.trim(), why: why.trim() }
            : { text: text.trim() }
          : null;

  const submit = () => value && !pending && onAnswer(value);
  const field = "w-full rounded-2xl border border-rule-strong bg-transparent px-4 text-[17px] text-ink placeholder:text-muted focus:border-ink focus:outline-none";

  return (
    <form
      className="flex flex-1 flex-col pt-10 sm:pt-16"
      onSubmit={(e) => {
        e.preventDefault();
        submit();
      }}
    >
      <div className="max-w-xl">
        <label htmlFor="answer" className="block text-[clamp(30px,5vw,48px)] leading-[1.02] font-medium tracking-[-0.03em]">
          {question.prompt}
        </label>
        {question.help ? <p className="mt-3 text-[16px] text-muted">{question.help}</p> : null}

        <div className="mt-7">
          {question.format === "long" ? (
            <textarea
              id="answer"
              rows={5}
              value={text}
              autoFocus
              maxLength={2000}
              onChange={(e) => setText(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) submit();
              }}
              className={cn(field, "resize-y py-3 leading-relaxed")}
            />
          ) : question.format === "three_words" ? (
            <div className="grid gap-2 sm:grid-cols-3">
              {words.map((word, i) => (
                <input
                  key={i}
                  id={i === 0 ? "answer" : undefined}
                  aria-label={`Word ${i + 1}`}
                  placeholder={`Word ${i + 1}`}
                  value={word}
                  maxLength={40}
                  autoFocus={i === 0}
                  onChange={(e) => setWords((list) => list.map((w, j) => (j === i ? e.target.value : w)))}
                  className={cn(field, "h-14")}
                />
              ))}
            </div>
          ) : question.format === "chips" ? (
            <div id="answer" role="group" aria-label={question.prompt} className="flex flex-wrap gap-2">
              {(question.options ?? []).map((option) => {
                const on = chips.includes(option);
                return (
                  <button
                    key={option}
                    type="button"
                    aria-pressed={on}
                    onClick={() => setChips((list) => (on ? list.filter((c) => c !== option) : [...list, option]))}
                    className={cn("h-11 rounded-full border px-5 text-[16px] transition-colors", on ? "border-ink bg-ink text-paper" : "border-rule-strong hover:border-ink")}
                  >
                    {option}
                  </button>
                );
              })}
            </div>
          ) : (
            <div className="flex flex-col gap-3">
              <input
                id="answer"
                value={text}
                autoFocus
                maxLength={500}
                placeholder={question.format === "link" ? "A name or a link" : undefined}
                onChange={(e) => setText(e.target.value)}
                className={cn(field, "h-14")}
              />
              {question.format === "link" ? (
                <>
                  <label htmlFor="why" className="sr-only">
                    Why? (optional)
                  </label>
                  <textarea
                    id="why"
                    rows={3}
                    value={why}
                    maxLength={1000}
                    placeholder="Why? (optional)"
                    onChange={(e) => setWhy(e.target.value)}
                    className={cn(field, "resize-y py-3 leading-relaxed")}
                  />
                </>
              ) : null}
            </div>
          )}
        </div>
      </div>

      <div className="mt-auto flex flex-col gap-2 pt-10 sm:mt-10 sm:flex-row">
        <Button type="submit" variant="primary" className="h-14 text-base sm:px-10" disabled={!value || pending}>
          {pending ? "Saving…" : "Continue"}
        </Button>
        {question.optional ? (
          <Button variant="ghost" className="h-14 text-base" disabled={pending} onClick={() => onAnswer({ skipped: true })}>
            Skip this one
          </Button>
        ) : null}
      </div>
    </form>
  );
}

/* ---------------------------------------------------------------- images */

/** Thumbnail first, sharp image fading in over it; reports when it's ready to judge. */
function BriefImage({ image, onReady, className }: { image: ShownImage; onReady?: () => void; className?: string }) {
  const [loaded, setLoaded] = useState(false);
  const ready = useRef(onReady);
  useEffect(() => {
    ready.current = onReady;
  });
  const done = () => {
    if (loaded) return;
    setLoaded(true);
    ready.current?.();
  };
  return (
    <span className={cn("relative flex items-center justify-center overflow-hidden rounded-[24px] bg-panel", className)}>
      {image.thumb ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={image.thumb} alt="" aria-hidden className="absolute inset-0 h-full w-full scale-110 object-cover opacity-50 blur-2xl" />
      ) : null}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={image.url}
        alt=""
        draggable={false}
        onLoad={done}
        ref={(el) => {
          if (el?.complete && el.naturalWidth) done();
        }}
        className={cn("relative max-h-full max-w-full object-contain transition-opacity duration-200", loaded ? "opacity-100" : "opacity-0")}
      />
    </span>
  );
}

/** Times a choice from the moment the images are on screen. */
function useTimer(count: number) {
  const ready = useRef(0);
  const started = useRef<number | null>(null);
  const mounted = useRef(0);
  useEffect(() => {
    mounted.current = performance.now();
  }, []);
  return {
    onReady: () => {
      ready.current += 1;
      if (ready.current >= count) started.current = performance.now();
    },
    elapsed: () => performance.now() - (started.current ?? mounted.current),
  };
}

const isTyping = (target: EventTarget | null) => target instanceof HTMLElement && target.closest("input, textarea");

function SwipeScreen({
  step,
  pending,
  onChoose,
}: {
  step: Extract<Step, { kind: "swipe" }>;
  pending: boolean;
  onChoose: (choice: "keep" | "skip", ms: number) => void;
}) {
  const timer = useTimer(1);
  const [dx, setDx] = useState(0);
  const [leaving, setLeaving] = useState<"keep" | "skip" | null>(null);
  const drag = useRef<{ x: number; id: number } | null>(null);
  const [dragging, setDragging] = useState(false);

  // Warm the next two so they appear instantly.
  const following = step.upcoming
    .slice(0, 2)
    .map((i) => i.url)
    .join(" ");
  useEffect(() => {
    for (const url of following.split(" ").filter(Boolean)) new Image().src = url;
  }, [following]);

  const choose = (choice: "keep" | "skip") => {
    if (pending || leaving) return;
    setLeaving(choice);
    onChoose(choice, timer.elapsed());
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (isTyping(e.target)) return;
      if (e.key === "ArrowRight") choose("keep");
      if (e.key === "ArrowLeft") choose("skip");
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  const offset = leaving ? (leaving === "keep" ? 600 : -600) : dx;

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="shrink-0 pt-5 pb-4">
        <h1 className="text-[28px] leading-[1.05] font-medium tracking-[-0.025em]">Keep or skip?</h1>
        <p className="mt-1 text-[15px] text-muted">
          {step.index < 2 ? "Swipe right to keep, left to skip. Or use the buttons." : "First instinct counts."}
        </p>
      </div>
      <div
        className="relative min-h-0 flex-1 touch-pan-y select-none"
        onPointerDown={(e) => {
          drag.current = { x: e.clientX, id: e.pointerId };
          setDragging(true);
          e.currentTarget.setPointerCapture(e.pointerId);
        }}
        onPointerMove={(e) => drag.current && setDx(e.clientX - drag.current.x)}
        onPointerUp={() => {
          drag.current = null;
          setDragging(false);
          if (dx > 90) choose("keep");
          else if (dx < -90) choose("skip");
          else setDx(0);
        }}
        onPointerCancel={() => {
          drag.current = null;
          setDragging(false);
          setDx(0);
        }}
      >
        <div
          className={cn("absolute inset-0", !dragging && "transition-transform duration-200")}
          style={{ transform: `translateX(${offset}px) rotate(${offset / 28}deg)`, opacity: leaving ? 0 : 1 }}
        >
          <BriefImage image={step.image} onReady={timer.onReady} className="h-full w-full" />
          <SwipeLabel show={offset > 30} side="right">
            Keep
          </SwipeLabel>
          <SwipeLabel show={offset < -30} side="left">
            Skip
          </SwipeLabel>
        </div>
      </div>
      <div className="grid shrink-0 grid-cols-2 gap-2 pt-4">
        <Button className="h-14 text-base" onClick={() => choose("skip")} disabled={pending}>
          Skip
        </Button>
        <Button variant="primary" className="h-14 text-base" onClick={() => choose("keep")} disabled={pending}>
          Keep
        </Button>
      </div>
    </div>
  );
}

function SwipeLabel({ show, side, children }: { show: boolean; side: "left" | "right"; children: ReactNode }) {
  return (
    <span
      aria-hidden
      className={cn(
        "absolute top-4 rounded-full bg-paper px-3.5 py-1.5 font-mono text-sm tracking-[0.08em] uppercase transition-opacity",
        side === "right" ? "left-4 text-ink" : "right-4 text-ink",
        show ? "opacity-100" : "opacity-0",
      )}
    >
      {children}
    </span>
  );
}

function PairScreen({
  step,
  pending,
  onChoose,
}: {
  step: Extract<Step, { kind: "pair" }>;
  pending: boolean;
  onChoose: (choice: "a" | "b" | "both" | "neither", caught: string[], ms: number) => void;
}) {
  const timer = useTimer(2);
  const [picked, setPicked] = useState<{ choice: "a" | "b" | "both" | "neither"; ms: number } | null>(null);
  const [caught, setCaught] = useState<string[]>([]);

  const choose = (choice: "a" | "b" | "both" | "neither") => {
    if (pending || picked) return;
    const ms = timer.elapsed();
    // Only ask what caught their eye when they actually picked one.
    if (step.askCaught && (choice === "a" || choice === "b")) setPicked({ choice, ms });
    else {
      setPicked({ choice, ms });
      onChoose(choice, [], ms);
    }
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (isTyping(e.target) || picked) return;
      if (e.key === "ArrowLeft" || e.key === "ArrowUp") choose("a");
      if (e.key === "ArrowRight" || e.key === "ArrowDown") choose("b");
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  const asking = picked && step.askCaught && (picked.choice === "a" || picked.choice === "b") && !pending;

  return (
    <div className="relative flex min-h-0 flex-1 flex-col">
      <div className="shrink-0 pt-5 pb-4">
        <h1 className="text-[28px] leading-[1.05] font-medium tracking-[-0.025em]">Which feels closer?</h1>
        <p className="mt-1 text-[15px] text-muted">Tap one. First instinct counts.</p>
      </div>
      <div className="grid min-h-0 flex-1 grid-rows-[minmax(0,1fr)_minmax(0,1fr)] gap-2 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] sm:grid-rows-[minmax(0,1fr)]">
        {(["a", "b"] as const).map((side) => (
          <button
            key={side}
            type="button"
            aria-label={`Choose image ${side.toUpperCase()}`}
            disabled={pending || Boolean(picked)}
            onClick={() => choose(side)}
            className={cn(
              "relative min-h-0 overflow-hidden rounded-[24px] outline-offset-2 disabled:cursor-default",
              picked?.choice === side && "outline outline-3 outline-signal",
              picked && picked.choice !== side && "opacity-40",
            )}
          >
            <BriefImage image={step[side]} onReady={timer.onReady} className="h-full w-full" />
            <span className="absolute top-3 left-3 flex size-8 items-center justify-center rounded-full bg-paper font-mono text-xs">
              {side.toUpperCase()}
            </span>
          </button>
        ))}
      </div>
      <div className="grid shrink-0 grid-cols-2 gap-2 pt-4">
        <Button className="h-13 text-base" disabled={pending || Boolean(picked)} onClick={() => choose("both")}>
          Both
        </Button>
        <Button className="h-13 text-base" disabled={pending || Boolean(picked)} onClick={() => choose("neither")}>
          Neither
        </Button>
      </div>

      {asking ? (
        <div role="dialog" aria-labelledby="caught-title" className="absolute inset-x-0 bottom-0 rounded-[28px] border border-rule-strong bg-panel p-5 shadow-[0_-12px_40px_rgba(0,0,0,0.6)]">
          <h2 id="caught-title" className="text-lg font-medium">
            What caught your eye?
          </h2>
          <p className="text-sm text-muted">Pick any. Optional.</p>
          <div className="mt-3 flex flex-wrap gap-2">
            {CAUGHT.map((c) => {
              const on = caught.includes(c);
              return (
                <button
                  key={c}
                  type="button"
                  aria-pressed={on}
                  onClick={() => setCaught((list) => (on ? list.filter((x) => x !== c) : [...list, c]))}
                  className={cn("h-11 rounded-full border px-5 text-[16px] transition-colors", on ? "border-ink bg-ink text-paper" : "border-rule-strong")}
                >
                  {c}
                </button>
              );
            })}
          </div>
          <div className="mt-4 grid grid-cols-2 gap-2">
            <Button className="h-12" onClick={() => onChoose(picked.choice, [], picked.ms)}>
              Skip
            </Button>
            <Button variant="primary" className="h-12" onClick={() => onChoose(picked.choice, caught, picked.ms)}>
              Continue
            </Button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
