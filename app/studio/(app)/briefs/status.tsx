import { Mono, cn } from "@/components/ui/primitives";

const LABELS: Record<string, string> = {
  draft: "Not sent",
  sent: "Sent",
  in_progress: "In progress",
  completed: "Completed",
  archived: "Archived",
};

export function StatusLabel({ status, className }: { status: string; className?: string }) {
  return (
    <Mono className={cn("flex items-center gap-1.5", status === "completed" && "text-ink", className)}>
      <span
        aria-hidden
        className={cn(
          "size-1.5 rounded-full",
          status === "completed" ? "bg-signal" : status === "in_progress" ? "bg-ink" : "border border-muted",
        )}
      />
      {LABELS[status] ?? status}
    </Mono>
  );
}
