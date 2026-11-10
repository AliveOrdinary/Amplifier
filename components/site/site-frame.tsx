import { GREETINGS } from "@/components/site/greetings";
import { cn } from "@/components/ui/primitives";

/**
 * The page grid every public page shares: the same width and side margins
 * as the header, so the logo, the menu and the content line up, and on wide
 * screens room on the right for the section scale.
 */
export const PAGE = "mx-auto w-full max-w-[1360px] px-4 sm:px-10 xl:max-w-[min(1360px,calc(100vw-320px))]";

/** Two columns from large screens: a 200px label column, then the content (in line with the menu). */
export const COLUMNS = "grid grid-cols-[minmax(0,1fr)] gap-x-10 gap-y-6 lg:grid-cols-[200px_minmax(0,1fr)]";

/** Small mono labels: "01 / Selected", "Client". */
export const LABEL = "font-mono text-[12px] uppercase tracking-[0.08em]";

export function SiteFooter({ className }: { className?: string }) {
  return (
    <footer className={cn(PAGE, "mt-24", className)}>
      <div className={cn(LABEL, "flex flex-wrap justify-between gap-4 border-t border-rule pt-6 pb-10 normal-case text-muted")}>
        <span className="flex flex-wrap gap-x-3">
          {GREETINGS.map((g) => (
            <span key={g}>{g}</span>
          ))}
        </span>
        <span className="uppercase">© MMXXVI Amplifier</span>
      </div>
    </footer>
  );
}
