import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import { EmptyState, Mono, PageHeader, Section } from "@/components/ui/primitives";

export const metadata: Metadata = { title: "Library" };

export default async function LibraryPage() {
  const supabase = await createClient();
  const [{ count }, { data: dimensions }] = await Promise.all([
    supabase.from("images").select("id", { count: "exact", head: true }).eq("status", "approved"),
    supabase.from("dimensions").select("key, left_label, right_label").order("sort"),
  ]);

  return (
    <>
      <PageHeader eyebrow={<Mono>{count ?? 0} approved</Mono>} title="Library" />

      <Section number="01" title="Images" description="The references every brief draws from.">
        <EmptyState title="No images yet">
          Uploading, pasting and the browser extension arrive in phase 2. Claude scores each image
          on the dimensions below, and you approve or correct it from the keyboard.
        </EmptyState>
      </Section>

      <Section
        number="02"
        title="Taste dimensions"
        description="Every image and every client is placed on these, from −2 to +2."
      >
        <ul className="border-t border-rule">
          {(dimensions ?? []).map((d, i) => (
            <li
              key={d.key}
              className="grid grid-cols-[40px_minmax(0,1fr)_minmax(0,2fr)_minmax(0,1fr)] items-center gap-4 border-b border-rule py-3"
            >
              <Mono>{String(i + 1).padStart(2, "0")}</Mono>
              <span className="text-[15px]">{d.left_label}</span>
              <span aria-hidden className="relative h-px bg-rule-strong">
                <span className="absolute top-[-5px] left-1/2 h-[11px] w-px bg-rule-strong" />
              </span>
              <span className="text-right text-[15px]">{d.right_label}</span>
            </li>
          ))}
        </ul>
      </Section>
    </>
  );
}
