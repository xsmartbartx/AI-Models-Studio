import { createFileRoute, Link } from "@tanstack/react-router";
import {
  Users,
  ImageIcon,
  Film,
  MessageSquareText,
  CalendarClock,
  BookOpen,
  ArrowRight,
  Sparkles,
} from "lucide-react";

import { PageHeader } from "@/components/page-shell";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/")({
  component: Dashboard,
});

const modules = [
  {
    to: "/characters",
    icon: Users,
    title: "Characters",
    description: "Define personas: appearance, style, hobbies. Reused across every generation.",
  },
  {
    to: "/images",
    icon: ImageIcon,
    title: "Images",
    description: "FLUX + InstantID / PuLID workflows. Keep the same face across every shoot.",
  },
  {
    to: "/videos",
    icon: Film,
    title: "Videos",
    description: "Image-to-video via Wan 2.1, Hunyuan or CogVideoX. 5–10 second clips.",
  },
  {
    to: "/posts",
    icon: MessageSquareText,
    title: "Posts",
    description: "Captions and hashtags drafted locally with Qwen 3 / Llama 3 through Ollama.",
  },
  {
    to: "/scheduler",
    icon: CalendarClock,
    title: "Scheduler",
    description: "Queue publications across platforms and track their state.",
  },
  {
    to: "/prompts",
    icon: BookOpen,
    title: "Prompt Library",
    description: "Curated presets: lifestyle, gym, travel — ready to paste into ComfyUI.",
  },
] as const;

function Dashboard() {
  return (
    <div>
      <PageHeader
        eyebrow="Zero-budget edition"
        title="Build a consistent AI influencer, end to end."
        description="Character → reference photo → InstantID → shoot → short video → caption → publish. All on your own hardware."
        actions={
          <>
            <Button asChild variant="secondary">
              <Link to="/prompts">
                <BookOpen className="h-4 w-4" />
                Browse prompts
              </Link>
            </Button>
            <Button asChild className="bg-gradient-brand text-brand-foreground shadow-glow hover:opacity-90">
              <Link to="/characters">
                <Sparkles className="h-4 w-4" />
                Create character
              </Link>
            </Button>
          </>
        }
      />

      <section className="px-6 py-8 md:px-10">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {modules.map((m) => (
            <Link
              key={m.to}
              to={m.to}
              className="group relative overflow-hidden rounded-2xl border border-border/60 bg-card p-6 transition-all hover:border-brand/40 hover:shadow-glow"
            >
              <div className="pointer-events-none absolute -right-16 -top-16 h-40 w-40 rounded-full bg-brand/5 blur-2xl transition-opacity group-hover:bg-brand/15" />
              <div className="relative flex flex-col gap-3">
                <div className="grid h-10 w-10 place-items-center rounded-lg border border-border/60 bg-background/60 text-brand">
                  <m.icon className="h-4 w-4" />
                </div>
                <h3 className="font-display text-lg font-semibold tracking-tight">
                  {m.title}
                </h3>
                <p className="text-sm leading-relaxed text-muted-foreground">
                  {m.description}
                </p>
                <div className="mt-2 inline-flex items-center gap-1 text-xs font-medium text-brand opacity-0 transition-opacity group-hover:opacity-100">
                  Open <ArrowRight className="h-3 w-3" />
                </div>
              </div>
            </Link>
          ))}
        </div>
      </section>
    </div>
  );
}
