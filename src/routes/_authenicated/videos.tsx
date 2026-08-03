import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient, queryOptions } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Film, Loader2, Trash2, Wand2, X } from "lucide-react";

import { PageHeader, EmptyState } from "@/components/page-shell";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import { startVideo, pollVideo, deleteVideo } from "@/lib/videos.functions";

type Character = { id: string; name: string; appearance: string | null; style: string | null };
type ImageRow = {
  id: string;
  prompt: string;
  image_url: string;
  character_id: string | null;
  created_at: string;
};
type VideoRow = {
  id: string;
  prompt: string;
  model: string;
  status: string;
  error: string | null;
  video_url: string | null;
  character_id: string | null;
  source_image_id: string | null;
  aspect_ratio: string | null;
  duration_seconds: number | null;
  created_at: string;
};

const charactersQO = queryOptions({
  queryKey: ["characters", "picker"],
  queryFn: async (): Promise<Character[]> => {
    const { data, error } = await supabase
      .from("characters")
      .select("id, name, appearance, style")
      .order("created_at", { ascending: false });
    if (error) throw error;
    return data ?? [];
  },
});

const imagesQO = queryOptions({
  queryKey: ["images"],
  queryFn: async (): Promise<ImageRow[]> => {
    const { data, error } = await supabase
      .from("images")
      .select("id, prompt, image_url, character_id, created_at")
      .order("created_at", { ascending: false })
      .limit(60);
    if (error) throw error;
    return (data ?? []) as ImageRow[];
  },
});

const videosQO = queryOptions({
  queryKey: ["videos"],
  queryFn: async (): Promise<VideoRow[]> => {
    const { data, error } = await supabase
      .from("videos")
      .select(
        "id, prompt, model, status, error, video_url, character_id, source_image_id, aspect_ratio, duration_seconds, created_at",
      )
      .order("created_at", { ascending: false })
      .limit(40);
    if (error) throw error;
    return (data ?? []) as VideoRow[];
  },
});

const MODEL_OPTIONS = [
  { value: "wan-video/wan-2.2-i2v-fast", label: "Wan 2.2 i2v · fast (~1 min)" },
  { value: "kwaivgi/kling-v2.1", label: "Kling v2.1 · higher quality (slow)" },
] as const;

export const Route = createFileRoute("/_authenticated/videos")({
  head: () => ({
    meta: [
      { title: "Videos — AI Influencer Factory" },
      {
        name: "description",
        content: "Animate your generated stills into short-form video with Wan 2.2 or Kling.",
      },
    ],
  }),
  component: VideosPage,
});

function VideosPage() {
  const queryClient = useQueryClient();
  const { data: characters = [] } = useQuery(charactersQO);
  const { data: images = [] } = useQuery(imagesQO);
  const { data: videos = [], isLoading: videosLoading } = useQuery(videosQO);

  const [characterId, setCharacterId] = useState<string>("none");
  const [imageId, setImageId] = useState<string>("");
  const [prompt, setPrompt] = useState("");
  const [model, setModel] = useState<(typeof MODEL_OPTIONS)[number]["value"]>(
    MODEL_OPTIONS[0].value,
  );
  const [aspect, setAspect] = useState<"9:16" | "1:1" | "16:9">("9:16");
  const [duration, setDuration] = useState<5 | 10>(5);
  const [viewer, setViewer] = useState<VideoRow | null>(null);

  const start = useServerFn(startVideo);
  const poll = useServerFn(pollVideo);
  const remove = useServerFn(deleteVideo);

  // filter images by selected character; auto-pick most recent
  const filteredImages = useMemo(() => {
    if (characterId === "none") return images;
    return images.filter((i) => i.character_id === characterId);
  }, [images, characterId]);

  useEffect(() => {
    if (filteredImages.length === 0) {
      setImageId("");
      return;
    }
    if (!filteredImages.some((i) => i.id === imageId)) {
      setImageId(filteredImages[0].id);
    }
  }, [filteredImages, imageId]);

  const selectedCharacter = useMemo(
    () => characters.find((c) => c.id === characterId) ?? null,
    [characters, characterId],
  );
  const selectedImage = useMemo(
    () => filteredImages.find((i) => i.id === imageId) ?? null,
    [filteredImages, imageId],
  );

  const finalPrompt = useMemo(() => {
    const parts: string[] = [];
    if (selectedCharacter) {
      parts.push(`Character: ${selectedCharacter.name}.`);
      if (selectedCharacter.style) parts.push(`Style: ${selectedCharacter.style}.`);
    }
    if (prompt.trim()) parts.push(prompt.trim());
    parts.push("Smooth natural motion, consistent identity, cinematic lighting.");
    return parts.join(" ");
  }, [selectedCharacter, prompt]);

  // poll in-flight rows
  const pending = useMemo(
    () => videos.filter((v) => v.status !== "succeeded" && v.status !== "failed" && v.status !== "canceled"),
    [videos],
  );

  useEffect(() => {
    if (pending.length === 0) return;
    let cancelled = false;
    const tick = async () => {
      for (const v of pending) {
        try {
          await poll({ data: { id: v.id } });
        } catch (e) {
          // silent; row's error will surface on next fetch
        }
        if (cancelled) return;
      }
      queryClient.invalidateQueries({ queryKey: ["videos"] });
    };
    const interval = setInterval(tick, 6000);
    tick();
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
    // re-run when the set of pending ids changes
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pending.map((v) => v.id).join(",")]);

  const generateMutation = useMutation({
    mutationFn: async () => {
      if (!selectedImage) throw new Error("Pick a source image first.");
      return start({
        data: {
          characterId: selectedCharacter?.id ?? null,
          sourceImageId: selectedImage.id,
          imageUrl: selectedImage.image_url,
          prompt: finalPrompt,
          model,
          aspectRatio: aspect,
          duration,
        },
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["videos"] });
      toast.success("Rendering started — this can take 1–10 minutes");
    },
    onError: (err) => toast.error("Could not start render", { description: (err as Error).message }),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => remove({ data: { id } }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["videos"] });
      setViewer(null);
      toast.success("Clip deleted");
    },
    onError: (err) => toast.error("Delete failed", { description: (err as Error).message }),
  });

  const canGenerate = !!selectedImage && !generateMutation.isPending && prompt.trim().length > 0;

  return (
    <div>
      <PageHeader
        eyebrow="Studio"
        title="Videos"
        description="Animate a still from your gallery. Pick a character, choose the reference shot, describe the motion."
      />

      <div className="mx-6 my-8 grid gap-6 md:mx-10 lg:grid-cols-[minmax(0,1fr)_420px]">
        <div className="rounded-2xl border border-border/60 bg-gradient-surface p-6 shadow-panel">
          <div className="space-y-5">
            <div className="space-y-2">
              <Label>Character</Label>
              <Select value={characterId} onValueChange={setCharacterId}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Any character</SelectItem>
                  {characters.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Reference image</Label>
              {filteredImages.length === 0 ? (
                <p className="rounded-lg border border-dashed border-border/60 p-4 text-xs text-muted-foreground">
                  No images yet for this character. Generate one in the Images studio first.
                </p>
              ) : (
                <div className="grid max-h-64 grid-cols-4 gap-2 overflow-y-auto rounded-xl border border-border/60 p-2">
                  {filteredImages.map((img) => (
                    <button
                      key={img.id}
                      type="button"
                      onClick={() => setImageId(img.id)}
                      className={
                        "relative aspect-square overflow-hidden rounded-lg border transition " +
                        (imageId === img.id
                          ? "border-brand ring-2 ring-brand"
                          : "border-border/60 hover:border-brand/60")
                      }
                    >
                      <img
                        src={img.image_url}
                        alt=""
                        loading="lazy"
                        className="h-full w-full object-cover"
                      />
                    </button>
                  ))}
                </div>
              )}
            </div>

            <div className="space-y-2">
              <Label>Motion prompt</Label>
              <Textarea
                rows={4}
                placeholder="Slow dolly-in, hair moving in the breeze, subtle smile, film grain."
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                maxLength={1500}
              />
            </div>

            <div className="grid gap-4 sm:grid-cols-3">
              <div className="space-y-2">
                <Label>Model</Label>
                <Select value={model} onValueChange={(v) => setModel(v as typeof model)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {MODEL_OPTIONS.map((m) => (
                      <SelectItem key={m.value} value={m.value}>
                        {m.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Duration</Label>
                <Select
                  value={String(duration)}
                  onValueChange={(v) => setDuration(Number(v) as 5 | 10)}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="5">5 seconds</SelectItem>
                    <SelectItem value="10">10 seconds</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Aspect</Label>
                <Select value={aspect} onValueChange={(v) => setAspect(v as typeof aspect)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="9:16">9:16 vertical</SelectItem>
                    <SelectItem value="1:1">1:1 square</SelectItem>
                    <SelectItem value="16:9">16:9 landscape</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="flex items-center justify-end">
              <Button
                onClick={() => generateMutation.mutate()}
                disabled={!canGenerate}
                className="bg-gradient-brand text-brand-foreground shadow-glow hover:opacity-90"
              >
                {generateMutation.isPending ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" /> Starting…
                  </>
                ) : (
                  <>
                    <Wand2 className="h-4 w-4" /> Animate
                  </>
                )}
              </Button>
            </div>
          </div>
        </div>

        {/* Selected reference */}
        <div className="rounded-2xl border border-border/60 bg-gradient-surface p-6 shadow-panel">
          <div className="mb-3 text-xs uppercase tracking-widest text-muted-foreground">
            Reference frame
          </div>
          <div className="relative aspect-square w-full overflow-hidden rounded-xl border border-border/60 bg-background/40">
            {selectedImage ? (
              <img src={selectedImage.image_url} alt="" className="h-full w-full object-cover" />
            ) : (
              <div className="flex h-full w-full items-center justify-center text-sm text-muted-foreground">
                Select an image to animate
              </div>
            )}
          </div>
          {selectedImage && (
            <p className="mt-3 line-clamp-3 text-xs text-muted-foreground">{selectedImage.prompt}</p>
          )}
        </div>
      </div>

      {/* Gallery */}
      <div className="mx-6 mb-12 md:mx-10">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="font-display text-lg font-semibold">Recent clips</h2>
          <span className="text-xs text-muted-foreground">
            {videos.length} clip{videos.length === 1 ? "" : "s"}
          </span>
        </div>

        {videosLoading ? (
          <div className="flex items-center gap-2 rounded-2xl border border-border/60 bg-gradient-surface p-6 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" /> Loading clips…
          </div>
        ) : videos.length === 0 ? (
          <EmptyState
            icon={<Film className="h-5 w-5" />}
            title="No clips yet"
            description="Pick a still on the left, describe the motion, and click Animate."
          />
        ) : (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
            {videos.map((v) => (
              <div
                key={v.id}
                className="group relative aspect-square overflow-hidden rounded-xl border border-border/60 bg-background/40"
              >
                {v.status === "succeeded" && v.video_url ? (
                  <button
                    type="button"
                    onClick={() => setViewer(v)}
                    className="h-full w-full"
                  >
                    <video
                      src={v.video_url}
                      className="h-full w-full object-cover"
                      muted
                      loop
                      playsInline
                      onMouseEnter={(e) => e.currentTarget.play().catch(() => {})}
                      onMouseLeave={(e) => {
                        e.currentTarget.pause();
                        e.currentTarget.currentTime = 0;
                      }}
                    />
                  </button>
                ) : (
                  <div className="flex h-full w-full flex-col items-center justify-center gap-2 p-4 text-center">
                    {v.status === "failed" || v.status === "canceled" ? (
                      <>
                        <X className="h-5 w-5 text-destructive" />
                        <p className="line-clamp-3 text-[0.7rem] text-destructive">
                          {v.error ?? "Render failed"}
                        </p>
                      </>
                    ) : (
                      <>
                        <Loader2 className="h-5 w-5 animate-spin text-brand" />
                        <p className="text-[0.7rem] uppercase tracking-widest text-muted-foreground">
                          {v.status}
                        </p>
                      </>
                    )}
                  </div>
                )}
                <div className="pointer-events-none absolute inset-x-0 bottom-0 bg-gradient-to-t from-background/90 to-transparent p-2 text-left opacity-0 transition group-hover:opacity-100">
                  <p className="line-clamp-2 text-[0.7rem] text-foreground">{v.prompt}</p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <Dialog open={!!viewer} onOpenChange={(v) => !v && setViewer(null)}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle className="font-display">Generated clip</DialogTitle>
            <DialogDescription className="line-clamp-3">{viewer?.prompt}</DialogDescription>
          </DialogHeader>
          {viewer?.video_url && (
            <div className="overflow-hidden rounded-xl border border-border/60 bg-black">
              <video src={viewer.video_url} controls autoPlay loop className="w-full" />
            </div>
          )}
          <DialogFooter className="flex justify-between sm:justify-between">
            <p className="mr-auto self-center font-mono text-xs text-muted-foreground">
              {viewer?.model} · {viewer?.duration_seconds}s · {viewer?.aspect_ratio}
            </p>
            <Button variant="ghost" onClick={() => setViewer(null)}>
              <X className="h-4 w-4" /> Close
            </Button>
            <Button
              variant="destructive"
              disabled={deleteMutation.isPending}
              onClick={() => viewer && deleteMutation.mutate(viewer.id)}
            >
              {deleteMutation.isPending ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" /> Deleting…
                </>
              ) : (
                <>
                  <Trash2 className="h-4 w-4" /> Delete
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
