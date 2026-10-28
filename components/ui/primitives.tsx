import Link from "next/link";
import type { ComponentProps, ReactNode } from "react";
import { extendTailwindMerge } from "tailwind-merge";
import { Logo } from "./logo";

/** Our own text sizes, so they aren't mistaken for colours when classes merge. */
const merge = extendTailwindMerge({ extend: { theme: { text: ["display", "title", "label"] } } });

/** Join classes; a later class wins over an earlier one for the same property (h-9 over h-11). */
export function cn(...parts: Array<string | false | null | undefined>) {
  return merge(parts.filter(Boolean).join(" "));
}

/* ---------------------------------------------------------------- Wordmark */

/** The Amplifier logo, sized by the text size it's given (text-2xl, text-[19px]…) and drawn in the text colour. */
export function Wordmark({ className }: { className?: string }) {
  return (
    <span className={cn("inline-flex items-center leading-none", className)}>
      <Logo className="h-[1.05em] w-auto" />
    </span>
  );
}

/* -------------------------------------------------------------- Mono label */

export function Mono({ className, ...props }: ComponentProps<"span">) {
  return (
    <span
      className={cn("font-mono text-label uppercase tracking-[0.08em] text-muted", className)}
      {...props}
    />
  );
}

/* ---------------------------------------------------------------- Layout */

/** The standard studio page width and padding (full-bleed screens skip it). */
export function PageContainer({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cn("mx-auto w-full max-w-[1360px] px-4 pt-8 pb-24 sm:px-10", className)}>{children}</div>;
}

/* ----------------------------------------------------------------- Buttons */

type Variant = "primary" | "secondary" | "ghost";
type Size = "md" | "sm";

/** Pills, as on the public site. */
const base =
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-full font-sans transition-colors disabled:opacity-50 disabled:cursor-not-allowed";

const variants: Record<Variant, string> = {
  primary: "bg-signal text-on-signal border border-signal font-medium hover:brightness-105",
  secondary: "bg-transparent text-ink border border-rule-strong hover:border-ink",
  ghost: "bg-transparent text-ink border border-transparent hover:bg-panel",
};

const sizes: Record<Size, string> = {
  md: "h-11 px-5 text-[15px]",
  sm: "h-9 px-3.5 text-sm",
};

export function buttonClass(variant: Variant = "secondary", size: Size = "md", className?: string) {
  return cn(base, variants[variant], sizes[size], className);
}

export function Button({
  variant = "secondary",
  size = "md",
  className,
  type = "button",
  ...props
}: ComponentProps<"button"> & { variant?: Variant; size?: Size }) {
  return <button type={type} className={buttonClass(variant, size, className)} {...props} />;
}

export function ButtonLink({
  variant = "secondary",
  size = "md",
  className,
  ...props
}: ComponentProps<typeof Link> & { variant?: Variant; size?: Size }) {
  return <Link className={buttonClass(variant, size, className)} {...props} />;
}

/* ------------------------------------------------------------------ Fields */

export function Field({
  label,
  htmlFor,
  hint,
  error,
  children,
}: {
  label: string;
  htmlFor: string;
  hint?: string;
  error?: string;
  children: ReactNode;
}) {
  return (
    <div className="flex flex-col gap-2">
      <label htmlFor={htmlFor} className="font-mono text-label uppercase tracking-[0.08em] text-muted">
        {label}
      </label>
      {children}
      {hint && !error ? <p className="text-sm text-muted">{hint}</p> : null}
      {error ? (
        <p className="text-sm text-danger" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}

export function Input({ className, ...props }: ComponentProps<"input">) {
  return (
    <input
      className={cn(
        "h-11 w-full rounded-xl border border-rule-strong bg-transparent px-3.5 text-[15px] text-ink placeholder:text-muted",
        "focus:border-ink focus:outline-none aria-[invalid=true]:border-danger",
        className,
      )}
      {...props}
    />
  );
}

/**
 * A dropdown with our own arrow and room for it. `size` matches the input
 * (md, 44px), a form row (sm, 40px) or a toolbar (xs, 32px).
 */
export function Select({
  className,
  wrapperClassName,
  size = "md",
  ...props
}: Omit<ComponentProps<"select">, "size"> & { wrapperClassName?: string; size?: "md" | "sm" | "xs" }) {
  return (
    <div className={cn("relative w-full", wrapperClassName)}>
      <select
        className={cn(
          "w-full appearance-none truncate rounded-xl border border-rule-strong bg-paper pl-3.5 pr-9 text-ink",
          "focus:border-ink focus:outline-none disabled:opacity-50",
          size === "md" && "h-11 text-[15px]",
          size === "sm" && "h-10 text-[15px]",
          size === "xs" && "h-8 rounded-full pl-3 pr-8 text-sm",
          className,
        )}
        {...props}
      />
      <svg
        aria-hidden
        viewBox="0 0 12 12"
        className={cn(
          "pointer-events-none absolute top-1/2 size-3 -translate-y-1/2 text-muted",
          size === "xs" ? "right-3" : "right-3.5",
        )}
      >
        <path d="M2.5 4.5 6 8l3.5-3.5" fill="none" stroke="currentColor" strokeWidth="1.5" />
      </svg>
    </div>
  );
}

/* ---------------------------------------------------------------- Sections */

export function Section({
  number,
  title,
  description,
  children,
  className,
  id,
}: {
  number: string;
  title: string;
  description?: string;
  children: ReactNode;
  className?: string;
  id?: string;
}) {
  return (
    <section id={id} className={cn("flex flex-wrap gap-6 border-b border-rule py-10 scroll-mt-16", className)}>
      <div className="flex-[1_1_200px] max-w-[260px]">
        <span className="font-mono text-label uppercase tracking-[0.08em] text-muted">{number} /</span>
        <h2 className="mt-1.5 text-title font-medium tracking-[-0.01em]">{title}</h2>
        {description ? <p className="mt-2 text-sm leading-snug text-muted">{description}</p> : null}
      </div>
      <div className="min-w-0 flex-[999_1_560px]">{children}</div>
    </section>
  );
}

export function PageHeader({
  eyebrow,
  title,
  actions,
}: {
  eyebrow?: ReactNode;
  title: string;
  actions?: ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-end gap-6 border-b border-rule pb-6">
      <div className="min-w-0 flex-[999_1_400px]">
        {eyebrow ? <div className="flex flex-wrap gap-4">{eyebrow}</div> : null}
        <h1 className="mt-2.5 text-display font-medium">{title}</h1>
      </div>
      {actions ? <div className="flex flex-wrap gap-2">{actions}</div> : null}
    </div>
  );
}

export function EmptyState({
  title,
  children,
  action,
}: {
  title: string;
  children?: ReactNode;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-start gap-3 rounded-[28px] border border-dashed border-rule-strong p-8">
      <h3 className="text-lg font-medium">{title}</h3>
      {children ? <div className="max-w-[60ch] text-[15px] leading-relaxed text-ink-soft">{children}</div> : null}
      {action}
    </div>
  );
}
