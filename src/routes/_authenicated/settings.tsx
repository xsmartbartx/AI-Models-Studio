import { createFileRoute } from "@tanstack/react-router";
import { Settings as SettingsIcon } from "lucide-react";
import { PageHeader } from "@/components/page-shell";

export const Route = createFileRoute("/_authenticated/settings")({
  head: () => ({
    meta: [
      { title: "Settings — AI Influencer Factory" },
      { name: "description", content: "Connect your local ComfyUI and Ollama endpoints." },
    ],
  }),
  component: SettingsPage,
});

function SettingsPage() {
  return (
    <div>
      <PageHeader
        eyebrow="Workspace"
        title="Settings"
        description="Point the studio at your local runtime. Nothing here calls a paid API."
      />
      <section className="px-6 py-8 md:px-10">
        <div className="grid gap-4 lg:grid-cols-2">
          <div className="rounded-2xl border border-border/60 bg-card p-6 shadow-panel">
            <div className="flex items-center gap-2">
              <SettingsIcon className="h-4 w-4 text-brand" />
              <h3 className="font-display text-lg font-semibold tracking-tight">
                ComfyUI endpoint
              </h3>
            </div>
            <p className="mt-2 text-sm text-muted-foreground">
              The URL of your local ComfyUI (typically http://127.0.0.1:8188).
              Bridge coming next — this is a placeholder.
            </p>
          </div>
          <div className="rounded-2xl border border-border/60 bg-card p-6 shadow-panel">
            <div className="flex items-center gap-2">
              <SettingsIcon className="h-4 w-4 text-brand" />
              <h3 className="font-display text-lg font-semibold tracking-tight">
                Ollama endpoint
              </h3>
            </div>
            <p className="mt-2 text-sm text-muted-foreground">
              Where your local Ollama runs (typically http://127.0.0.1:11434).
              Used for captions with Qwen 3 or Llama 3.
            </p>
          </div>
        </div>
      </section>
    </div>
  );
}
