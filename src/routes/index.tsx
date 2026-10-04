import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo } from "react";
import { useQuery, queryOptions } from "@tanstack/react-query";
import {
  ArrowRight,
  BarChart3,
  CalendarClock,
  CheckCircle2,
  Film,
  ImageIcon,
  Layers3,
  MessageSquareText,
  Sparkles,
  Users,
  Wand2,
  Clock3,
  AlertTriangle,
} from "lucide-react";

import { PageHeader } from "@/components/page-shell";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";

type Character = {
  id: string;
  name: string;
  style: string | null;
  created_at: string;
};

type ImageRow = {
  id: string;
  prompt: string;
  model: string;
  image_url: string;
  character_id: string | null;
  created_at: string;
};

type VideoRow = {
  id: string;
  prompt: string;
  model: string;
  status: string;
  video_url: string | null;
  character_id: string | null;
  created_at: string;
};

const charactersQO = queryOptions({
  queryKey: ["dashboard", "characters"],
  queryFn: async (): Promise<Character[]> => {
    const { data, error } = await supabase
      .from("characters")
      .select("id, name, style, created_at")
      .order("created_at", { ascending: false })
      .limit(100);
    if (error) throw error;
    return data ?? [];
  },
});

const imagesQO = queryOptions({
  queryKey: ["dashboard", "images"],
  queryFn: async (): Promise<ImageRow[]> => {
    const { data, error } = await supabase
      .from("images")
      .select("id, prompt, model, image_url, character_id, created_at")
      .order("created_at", { ascending: false })
      .limit(24);
    if (error) throw error;
    return (data ?? []) as ImageRow[];
  },
});

const videosQO = queryOptions({
  queryKey: ["dashboard", "videos"],
  queryFn: async (): Promise<VideoRow[]> => {
    const { data, error } = await supabase
      .from("videos")
      .select("id, prompt, model, status, video_url, character_id, created_at")
      .order("created_at", { ascending: false })
      .limit(24);
    if (error) throw error;
    return (data ?? []) as VideoRow[];
  },
});

export const Route = createFileRoute("/")({
  component: CustomerDashboard,
});

function CustomerDashboard() {
  const { data: characters = [], isLoading: charactersLoading } = useQuery(charactersQO);
  const { data: images = [], isLoading: imagesLoading } = useQuery(imagesQO);
  const { data: videos = [], isLoading: videosLoading } = useQuery(videosQO);

  const recentActivity = useMemo(() => {
    const items = [
      ...images.map((item) => ({
        id: `image-${item.id}`,
        kind: "image" as const,
        title: "Image generated",
        detail: item.prompt,
        created_at: item.created_at,
        href: "/images",
      })),
      ...videos.map((item) => ({
        id: `video-${item.id}`,
        kind: "video" as const,
        title:
          item.status === "succeeded"
            ? "Video completed"
            : item.status === "failed"
              ? "Video failed"
              : "Video rendering",
        detail: item.prompt,
        created_at: item.created_at,
        href: "/videos",
      })),
      ...characters.map((item) => ({
        id: `character-${item.id}`,
        kind: "character" as const,
        title: "Character created",
        detail: item.name,
        created_at: item.created_at,
        href: `/characters/${item.id}`,
      })),
    ];
    return items.sort(
      (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
    );
  }, [characters, images, videos]);

  const pendingVideos = videos.filter(
    (video) => !["succeeded", "failed", "canceled"].includes(video.status),
  ).length;
  const failedVideos = videos.filter((video) => ["failed", "canceled"].includes(video.status)).length;
  const successfulVideos = videos.filter((video) => video.status === "succeeded").length;

  return (
    <div className="pb-12">
      <PageHeader
        eyebrow="Customer workspace"
        title="Command Center"
        description="One view for your AI creator pipeline: characters, generations, production status and the next action."
        actions={
          <div className="flex flex-wrap gap-2">
            <Button asChild variant="secondary">
              <Link to="/characters">
                <Users className="h-4 w-4" />
                Manage characters
              </Link>
            </Button>
            <Button asChild className="bg-gradient-brand text-brand-foreground shadow-glow hover:opacity-90">
              <Link to="/images">
                <Wand2 className="h-4 w-4" />
                Generate image
              </Link>
            </Button>
          </div>
        }
      />

      <section className="px-6 py-6 md:px-10">
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
          <MetricCard
            icon={<Users className="h-4 w-4" />}
            label="Characters"
            value={charactersLoading ? "—" : characters.length}
            description="Active personas"
          />
          <MetricCard
            icon={<ImageIcon className="h-4 w-4" />}
            label="Images"
            value={imagesLoading ? "—" : images.length}
            description="Recent gallery items"
          />
          <MetricCard
            icon={<Film className="h-4 w-4" />}
            label="Videos"
            value={videosLoading ? "—" : videos.length}
            description="Recent clips"
          />
          <MetricCard
            icon={<Clock3 className="h-4 w-4" />}
            label="Rendering"
            value={pendingVideos}
            description="Jobs in progress"
            tone={pendingVideos > 0 ? "brand" : "default"}
          />
          <MetricCard
            icon={<BarChart3 className="h-4 w-4" />}
            label="Success rate"
            value={
              videos.length > 0 ? `${Math.round((successfulVideos / videos.length) * 100)}%` : "—"
            }
            description={failedVideos > 0 ? `${failedVideos} failed/canceled` : "No failures"}
            tone={failedVideos > 0 ? "danger" : "default"}
          />
        </div>
      </section>

      <section className="grid gap-6 px-6 md:px-10 lg:grid-cols-[minmax(0,1.35fr)_minmax(340px,0.65fr)]">
        <div className="space-y-6">
          <div className="rounded-2xl border border-border/60 bg-gradient-surface p-6 shadow-panel">
            <div className="mb-5 flex items-start justify-between gap-4">
              <div>
                <p className="font-mono text-[0.68rem] uppercase tracking-[0.16em] text-brand">
                  Production pipeline
                </p>
                <h2 className="mt-1 font-display text-xl font-semibold tracking-tight">
                  Create → animate → publish
                </h2>
              </div>
              <Sparkles className="h-5 w-5 text-brand" />
            </div>

            <div className="grid gap-3 md:grid-cols-4">
              <PipelineStep
                index="01"
                title="Character"
                description={characters.length ? `${characters.length} ready` : "Create a persona"}
                href="/characters"
                icon={<Users className="h-4 w-4" />}
                complete={characters.length > 0}
              />
              <PipelineStep
                index="02"
                title="Image"
                description={images.length ? `${images.length} in gallery` : "Generate a reference"}
                href="/images"
                icon={<ImageIcon className="h-4 w-4" />}
                complete={images.length > 0}
              />
              <PipelineStep
                index="03"
                title="Video"
                description={
                  pendingVideos
                    ? `${pendingVideos} rendering`
                    : videos.length
                      ? `${successfulVideos} completed`
                      : "Animate a still"
                }
                href="/videos"
                icon={<Film className="h-4 w-4" />}
                complete={successfulVideos > 0}
              />
              <PipelineStep
                index="04"
                title="Publish"
                description="Draft & schedule"
                href="/posts"
                icon={<MessageSquareText className="h-4 w-4" />}
                complete={false}
              />
            </div>
          </div>

          <div className="rounded-2xl border border-border/60 bg-card p-6 shadow-panel">
            <div className="mb-5 flex items-center justify-between gap-3">
              <div>
                <p className="font-mono text-[0.68rem] uppercase tracking-[0.16em] text-muted-foreground">
                  Your content
                </p>
                <h2 className="mt-1 font-display text-xl font-semibold tracking-tight">
                  Recent generations
                </h2>
              </div>
              <Link
                to="/images"
                className="inline-flex items-center gap-1 text-xs font-medium text-brand hover:underline"
              >
                Open gallery
                <ArrowRight className="h-3.5 w-3.5" />
              </Link>
            </div>

            {images.length === 0 ? (
              <div className="rounded-xl border border-dashed border-border/70 p-10 text-center">
                <ImageIcon className="mx-auto h-5 w-5 text-muted-foreground" />
                <p className="mt-3 font-medium">No generated assets yet</p>
                <p className="mt-1 text-sm text-muted-foreground">
                  Start with a character and create your first reference image.
                </p>
                <Button asChild className="mt-4">
                  <Link to="/images">Create first image</Link>
                </Button>
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
                {images.slice(0, 8).map((image) => (
                  <Link
                    key={image.id}
                    to="/images"
                    className="group relative aspect-square overflow-hidden rounded-xl border border-border/60 bg-background/40"
                  >
                    <img
                      src={image.image_url}
                      alt={image.prompt.slice(0, 80)}
                      loading="lazy"
                      className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
                    />
                    <div className="pointer-events-none absolute inset-x-0 bottom-0 bg-gradient-to-t from-background/90 to-transparent p-2 pt-8 opacity-0 transition-opacity group-hover:opacity-100">
                      <p className="line-clamp-2 text-[0.68rem] leading-relaxed">
                        {image.prompt}
                      </p>
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="space-y-6">
          <div className="rounded-2xl border border-border/60 bg-card p-6 shadow-panel">
            <div className="mb-5 flex items-center justify-between">
              <div>
                <p className="font-mono text-[0.68rem] uppercase tracking-[0.16em] text-muted-foreground">
                  Operations
                </p>
                <h2 className="mt-1 font-display text-xl font-semibold tracking-tight">
                  Live status
                </h2>
              </div>
              <span className="inline-flex items-center gap-2 rounded-full border border-border/60 px-2.5 py-1 text-[0.68rem] text-muted-foreground">
                <span className="h-1.5 w-1.5 rounded-full bg-brand shadow-glow" />
                Connected
              </span>
            </div>

            <div className="space-y-3">
              <StatusRow
                label="Characters"
                value={characters.length > 0 ? "Ready" : "Needs setup"}
                icon={<Users className="h-4 w-4" />}
                positive={characters.length > 0}
              />
              <StatusRow
                label="Image pipeline"
                value={images.length > 0 ? "Ready" : "No assets"}
                icon={<ImageIcon className="h-4 w-4" />}
                positive={images.length > 0}
              />
              <StatusRow
                label="Video queue"
                value={pendingVideos > 0 ? `${pendingVideos} rendering` : "Idle"}
                icon={<Film className="h-4 w-4" />}
                positive={pendingVideos === 0}
              />
              <StatusRow
                label="Publishing"
                value="Not configured"
                icon={<CalendarClock className="h-4 w-4" />}
                positive={false}
                neutral
              />
            </div>

            <Button asChild variant="outline" className="mt-5 w-full">
              <Link to="/settings">Open workspace settings</Link>
            </Button>
          </div>

          <div className="rounded-2xl border border-border/60 bg-gradient-surface p-6 shadow-panel">
            <div className="flex items-start gap-3">
              <Layers3 className="mt-0.5 h-5 w-5 text-brand" />
              <div>
                <p className="font-display text-lg font-semibold">Recommended next action</p>
                <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
                  {characters.length === 0
                    ? "Create a character first. It becomes the reusable identity layer for every generated asset."
                    : images.length === 0
                      ? "Generate your first reference image from a character to unlock the video workflow."
                      : pendingVideos > 0
                        ? "Your video queue is active. Check Videos for rendering progress and completed clips."
                        : videos.length === 0
                          ? "Animate one of your stills into a short clip to complete the media pipeline."
                          : "Your core media pipeline is active. Move into Posts and Scheduler to turn assets into a publishing workflow."}
                </p>
                <Button asChild variant="ghost" className="mt-3 -ml-3 text-brand hover:text-brand">
                  <Link
                    to={
                      characters.length === 0
                        ? "/characters"
                        : images.length === 0
                          ? "/images"
                          : videos.length === 0
                            ? "/videos"
                            : "/posts"
                    }
                  >
                    Continue workflow
                    <ArrowRight className="h-4 w-4" />
                  </Link>
                </Button>
              </div>
            </div>
          </div>

          <div className="rounded-2xl border border-border/60 bg-card p-6 shadow-panel">
            <div className="mb-4 flex items-center justify-between">
              <div>
                <p className="font-mono text-[0.68rem] uppercase tracking-[0.16em] text-muted-foreground">
                  Activity
                </p>
                <h2 className="mt-1 font-display text-xl font-semibold tracking-tight">
                  Recent events
                </h2>
              </div>
              <CheckCircle2 className="h-5 w-5 text-muted-foreground" />
            </div>
            <div className="space-y-4">
              {recentActivity.length === 0 ? (
                <p className="text-sm text-muted-foreground">No activity yet.</p>
              ) : (
                recentActivity.slice(0, 6).map((item) => (
                  <Link key={item.id} to={item.href as never} className="group flex gap-3">
                    <div className="mt-0.5 grid h-8 w-8 shrink-0 place-items-center rounded-lg border border-border/60 bg-background/50">
                      {item.kind === "image" ? (
                        <ImageIcon className="h-3.5 w-3.5 text-brand" />
                      ) : item.kind === "video" ? (
                        <Film className="h-3.5 w-3.5 text-brand" />
                      ) : (
                        <Users className="h-3.5 w-3.5 text-brand" />
                      )}
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-medium group-hover:text-brand">{item.title}</p>
                      <p className="mt-0.5 line-clamp-2 text-xs text-muted-foreground">{item.detail}</p>
                      <p className="mt-1 font-mono text-[0.64rem] text-muted-foreground/80">
                        {formatRelativeTime(item.created_at)}
                      </p>
                    </div>
                  </Link>
                ))
              )}
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}

function MetricCard({
  icon,
  label,
  value,
  description,
  tone = "default",
}: {
  icon: React.ReactNode;
  label: string;
  value: string | number;
  description: string;
  tone?: "default" | "brand" | "danger";
}) {
  return (
    <div
      className={
        "rounded-2xl border bg-card p-4 shadow-panel " +
        (tone === "brand"
          ? "border-brand/30"
          : tone === "danger"
            ? "border-destructive/30"
            : "border-border/60")
      }
    >
      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        {icon}
        <span>{label}</span>
      </div>
      <div className="mt-3 font-display text-2xl font-semibold tracking-tight">{value}</div>
      <p className="mt-1 text-xs text-muted-foreground">{description}</p>
    </div>
  );
}

function PipelineStep({
  index,
  title,
  description,
  href,
  icon,
  complete,
}: {
  index: string;
  title: string;
  description: string;
  href: string;
  icon: React.ReactNode;
  complete: boolean;
}) {
  return (
    <Link
      to={href}
      className="group rounded-xl border border-border/60 bg-background/40 p-4 transition-colors hover:border-brand/40 hover:bg-brand/5"
    >
      <div className="flex items-center justify-between">
        <span className="font-mono text-[0.62rem] tracking-[0.14em] text-muted-foreground">{index}</span>
        {complete ? (
          <CheckCircle2 className="h-4 w-4 text-brand" />
        ) : (
          <ArrowRight className="h-4 w-4 text-muted-foreground transition-transform group-hover:translate-x-0.5 group-hover:text-brand" />
        )}
      </div>
      <div className="mt-4 grid h-9 w-9 place-items-center rounded-lg border border-border/60 bg-card text-brand">
        {icon}
      </div>
      <p className="mt-3 font-medium">{title}</p>
      <p className="mt-1 text-xs text-muted-foreground">{description}</p>
    </Link>
  );
}

function StatusRow({
  label,
  value,
  icon,
  positive,
  neutral = false,
}: {
  label: string;
  value: string;
  icon: React.ReactNode;
  positive: boolean;
  neutral?: boolean;
}) {
  return (
    <div className="flex items-center justify-between rounded-xl border border-border/50 bg-background/35 px-3 py-3">
      <div className="flex min-w-0 items-center gap-3">
        <div className="grid h-8 w-8 shrink-0 place-items-center rounded-lg border border-border/60 text-brand">
          {icon}
        </div>
        <span className="truncate text-sm font-medium">{label}</span>
      </div>
      <span
        className={
          "inline-flex items-center gap-1.5 text-xs " +
          (neutral
            ? "text-muted-foreground"
            : positive
              ? "text-brand"
              : "text-destructive")
        }
      >
        <span className="h-1.5 w-1.5 rounded-full bg-current" />
        {value}
      </span>
    </div>
  );
}

function formatRelativeTime(value: string) {
  const diff = Date.now() - new Date(value).getTime();
  const minutes = Math.max(0, Math.floor(diff / 60_000));
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}d ago`;
  return new Date(value).toLocaleDateString();
}
