import { createFileRoute } from "@tanstack/react-router";
import { BookOpen } from "lucide-react";
import { PageHeader } from "@/components/page-shell";

export const Route = createFileRoute("/_authenticated/prompts")({
  head: () => ({
    meta: [
      { title: "Prompt Library — AI Influencer Factory" },
      { name: "description", content: "Curated prompt presets: lifestyle, gym, travel." },
    ],
  }),
  component: PromptsPage,
});

const presets = [
  {
    tag: "Lifestyle",
    text: "walking in old town, summer evening, DSLR photo, realistic skin",
  },
  {
    tag: "Gym",
    text: "fitness club, workout session, sportswear, natural lighting",
  },
  {
    tag: "Travel",
    text: "airport terminal, vacation outfit, cinematic photo",
  },
];

function PromptsPage() {
  return (
    <div>
      <PageHeader
        eyebrow="Workspace"
        title="Prompt Library"
        description="Copy-ready prompt presets tuned for FLUX Dev with InstantID / PuLID face conditioning."
      />
      <section className="grid gap-4 px-6 py-8 sm:grid-cols-2 lg:grid-cols-3 md:px-10">
        {presets.map((p) => (
          <article
            key={p.tag}
            className="rounded-2xl border border-border/60 bg-card p-5 shadow-panel"
          >
            <div className="flex items-center gap-2">
              <BookOpen className="h-4 w-4 text-brand" />
              <span className="font-mono text-[0.68rem] uppercase tracking-[0.18em] text-muted-foreground">
                {p.tag}
              </span>
            </div>
            <p className="mt-4 font-mono text-sm leading-relaxed text-foreground/90">
              {p.text}
            </p>
          </article>
        ))}
      </section>
    </div>
  );
}
