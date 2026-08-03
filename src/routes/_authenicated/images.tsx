import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient, queryOptions } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { ImageIcon, Loader2, Sparkles, Trash2, Wand2, X } from "lucide-react";

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
import { streamImage } from "@/lib/stream-image";
import {
  saveGeneratedImage,
  deleteGeneratedImage,
} from "@/lib/images.functions";

type Character = {
  id: string;
  name: string;
  appearance: string | null;
  style: string | null;
};

type ImageRow = {
  id: string;
  prompt: string;
  model: string;
  image_url: string;
  character_id: string | null;
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
      .select("id, prompt, model, image_url, character_id, created_at")
      .order("created_at", { ascending: false })
      .limit(60);
    if (error) throw error;
    return (data ?? []) as ImageRow[];
  },
});

const MODEL_OPTIONS = [
  { value: "google/gemini-3.1-flash-image", label: "Nano Banana 2 · fast + pro quality" },
  { value: "google/gemini-3-pro-image", label: "Gemini 3 Pro Image · highest quality" },
  { value: "google/gemini-2.5-flash-image", label: "Nano Banana · classic" },
];

export const Route = createFileRoute("/_authenticated/images")({
  head: () => ({
    meta: [
      { title: "Images — AI Influencer Factory" },
      {
        name: "description",
        content: "Generate consistent AI photoshoots from your characters using Lovable AI.",
      },
    ],
  }),
  component: ImagesPage,
});

function ImagesPage() {
  const queryClient = useQueryClient();
  const { data: characters = [] } = useQuery(charactersQO);
  const { data: images = [], isLoading: imagesLoading } = useQuery(imagesQO);

  const [characterId, setCharacterId] = useState<string>("none");
  const [scene, setScene] = useState("");
  const [model, setModel] = useState(MODEL_OPTIONS[0].value);
  const [previewSrc, setPreviewSrc] = useState<string | null>(null);
  const [previewFinal, setPreviewFinal] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [viewer, setViewer] = useState<ImageRow | null>(null);
  const generationIdRef = useRef(0);

  const save = useServerFn(saveGeneratedImage);
  const remove = useServerFn(deleteGeneratedImage);

  const selectedCharacter = useMemo(
    () => characters.find((c) => c.id === characterId) ?? null,
    [characters, characterId],
  );

  const finalPrompt = useMemo(() => {
    const parts: string[] = [];
    if (selectedCharacter) {
      parts.push(`Character: ${selectedCharacter.name}.`);
      if (selectedCharacter.appearance) parts.push(`Appearance: ${selectedCharacter.appearance}.`);
      if (selectedCharacter.style) parts.push(`Style: ${selectedCharacter.style}.`);
    }
    if (scene.trim()) parts.push(`Scene: ${scene.trim()}`);
    parts.push(
      "Photorealistic, sharp focus, natural lighting, editorial photography, keep the character's face consistent.",
    );
    return parts.join(" ");
  }, [selectedCharacter, scene]);

  const generateMutation = useMutation({
    mutationFn: async () => {
      const myId = ++generationIdRef.current;
      setPreviewSrc(null);
      setPreviewFinal(false);
      setIsGenerating(true);

      const { b64_json } = await streamImage(finalPrompt, model, (b64, isFinal) => {
        if (generationIdRef.current !== myId) return;
        setPreviewSrc(`data:image/png;base64,${b64}`);
        setPreviewFinal(isFinal);
      });

      const row = await save({
        data: {
          characterId: selectedCharacter?.id ?? null,
          prompt: finalPrompt,
          model,
          b64_json,
          aspectRatio: "1:1",
        },
      });
      return row;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["images"] });
      toast.success("Image saved to your gallery");
    },
    onError: (err) => {
      toast.error("Generation failed", { description: (err as Error).message });
    },
    onSettled: () => setIsGenerating(false),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => remove({ data: { id } }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["images"] });
      setViewer(null);
      toast.success("Image deleted");
    },
    onError: (err) =>
      toast.error("Could not delete image", { description: (err as Error).message }),
  });

  const canGenerate = scene.trim().length > 0 && !isGenerating;

  return (
    <div>
      <PageHeader
        eyebrow="Studio"
        title="Images"
        description="Generate photoshoots from your characters. Pick a persona, describe a scene, and Lovable AI renders it."
      />

      <div className="mx-6 my-8 grid gap-6 md:mx-10 lg:grid-cols-[minmax(0,1fr)_420px]">
        {/* Composer */}
        <div className="rounded-2xl border border-border/60 bg-gradient-surface p-6 shadow-panel">
          <div className="space-y-5">
            <div className="space-y-2">
              <Label>Character</Label>
              <Select value={characterId} onValueChange={setCharacterId}>
                <SelectTrigger>
                  <SelectValue placeholder="No character" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">No character (scene only)</SelectItem>
                  {characters.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {selectedCharacter?.appearance && (
                <p className="line-clamp-2 text-xs text-muted-foreground">
                  {selectedCharacter.appearance}
                </p>
              )}
            </div>

            <div className="space-y-2">
              <Label>Scene / prompt</Label>
              <Textarea
                rows={5}
                placeholder="Golden-hour rooftop in Tokyo, oversized leather jacket, looking away from camera, film grain…"
                value={scene}
                onChange={(e) => setScene(e.target.value)}
                maxLength={2000}
              />
              <p className="text-xs text-muted-foreground">
                Character appearance and style are added automatically.
              </p>
            </div>

            <div className="space-y-2">
              <Label>Model</Label>
              <Select value={model} onValueChange={setModel}>
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

            <div className="flex items-center justify-end">
              <Button
                onClick={() => generateMutation.mutate()}
                disabled={!canGenerate}
                className="bg-gradient-brand text-brand-foreground shadow-glow hover:opacity-90"
              >
                {isGenerating ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" /> Generating…
                  </>
                ) : (
                  <>
                    <Wand2 className="h-4 w-4" /> Generate
                  </>
                )}
              </Button>
            </div>
          </div>
        </div>

        {/* Preview */}
        <div className="rounded-2xl border border-border/60 bg-gradient-surface p-6 shadow-panel">
          <div className="mb-3 flex items-center gap-2 text-xs uppercase tracking-widest text-muted-foreground">
            <Sparkles className="h-3.5 w-3.5 text-brand" /> Live preview
          </div>
          <div className="relative aspect-square w-full overflow-hidden rounded-xl border border-border/60 bg-background/40">
            {previewSrc ? (
              <img
                src={previewSrc}
                alt="Preview"
                className={
                  "h-full w-full object-cover transition-[filter] duration-500 " +
                  (previewFinal ? "blur-0" : "blur-2xl")
                }
              />
            ) : (
              <div className="flex h-full w-full items-center justify-center text-sm text-muted-foreground">
                {isGenerating ? "Rendering…" : "Preview appears here"}
              </div>
            )}
            {isGenerating && !previewFinal && (
              <div className="absolute inset-x-0 bottom-0 flex items-center gap-2 bg-background/60 px-3 py-2 text-xs backdrop-blur-md">
                <Loader2 className="h-3.5 w-3.5 animate-spin" /> Streaming preview…
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Gallery */}
      <div className="mx-6 mb-12 md:mx-10">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="font-display text-lg font-semibold">Recent generations</h2>
          <span className="text-xs text-muted-foreground">
            {images.length} image{images.length === 1 ? "" : "s"}
          </span>
        </div>

        {imagesLoading ? (
          <div className="flex items-center gap-2 rounded-2xl border border-border/60 bg-gradient-surface p-6 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" /> Loading gallery…
          </div>
        ) : images.length === 0 ? (
          <EmptyState
            icon={<ImageIcon className="h-5 w-5" />}
            title="Your gallery is empty"
            description="Generate your first shot on the left — it'll be saved here automatically."
          />
        ) : (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
            {images.map((img) => (
              <button
                key={img.id}
                type="button"
                onClick={() => setViewer(img)}
                className="group relative aspect-square overflow-hidden rounded-xl border border-border/60 bg-background/40 transition hover:border-brand"
              >
                <img
                  src={img.image_url}
                  alt={img.prompt.slice(0, 80)}
                  loading="lazy"
                  className="h-full w-full object-cover transition-transform group-hover:scale-105"
                />
                <div className="pointer-events-none absolute inset-x-0 bottom-0 bg-gradient-to-t from-background/90 to-transparent p-2 text-left opacity-0 transition group-hover:opacity-100">
                  <p className="line-clamp-2 text-[0.7rem] text-foreground">{img.prompt}</p>
                </div>
              </button>
            ))}
          </div>
        )}
      </div>

      <Dialog open={!!viewer} onOpenChange={(v) => !v && setViewer(null)}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle className="font-display">Generated image</DialogTitle>
            <DialogDescription className="line-clamp-3">
              {viewer?.prompt}
            </DialogDescription>
          </DialogHeader>
          {viewer && (
            <div className="overflow-hidden rounded-xl border border-border/60">
              <img src={viewer.image_url} alt={viewer.prompt} className="w-full" />
            </div>
          )}
          <DialogFooter className="flex justify-between sm:justify-between">
            <p className="mr-auto self-center font-mono text-xs text-muted-foreground">
              {viewer?.model}
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
