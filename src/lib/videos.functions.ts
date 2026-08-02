import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const GATEWAY = "https://connector-gateway.lovable.dev/replicate/v1";

const MODELS = {
  "wan-video/wan-2.2-i2v-fast": "wan-video/wan-2.2-i2v-fast",
  "kwaivgi/kling-v2.1": "kwaivgi/kling-v2.1",
} as const;

type ModelId = keyof typeof MODELS;

function replicateHeaders() {
  const lovable = process.env.LOVABLE_API_KEY;
  const replicate = process.env.REPLICATE_API_KEY;
  if (!lovable || !replicate) throw new Error("Replicate connector is not configured");
  return {
    Authorization: `Bearer ${lovable}`,
    "X-Connection-Api-Key": replicate,
    "Content-Type": "application/json",
  };
}

function buildInput(model: ModelId, prompt: string, image: string, aspect: string, duration: number) {
  if (model === "wan-video/wan-2.2-i2v-fast") {
    return { image, prompt, num_frames: Math.max(24, Math.round(duration * 16)) };
  }
  // kling v2.1
  return {
    start_image: image,
    prompt,
    duration,
    aspect_ratio: aspect,
    negative_prompt: "",
  };
}

const StartInput = z.object({
  characterId: z.string().uuid().nullable().optional(),
  sourceImageId: z.string().uuid().nullable().optional(),
  imageUrl: z.string().url(),
  prompt: z.string().min(1).max(2000),
  model: z.enum(["wan-video/wan-2.2-i2v-fast", "kwaivgi/kling-v2.1"]),
  aspectRatio: z.enum(["9:16", "1:1", "16:9"]),
  duration: z.union([z.literal(5), z.literal(10)]),
});

export const startVideo = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => StartInput.parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;

    const input = buildInput(data.model, data.prompt, data.imageUrl, data.aspectRatio, data.duration);
    const res = await fetch(`${GATEWAY}/models/${data.model}/predictions`, {
      method: "POST",
      headers: replicateHeaders(),
      body: JSON.stringify({ input }),
    });
    const body = await res.text();
    if (!res.ok) {
      throw new Error(`Replicate error [${res.status}]: ${body}`);
    }
    const parsed = JSON.parse(body) as { id: string; status: string };

    const { data: row, error } = await supabase
      .from("videos")
      .insert({
        user_id: userId,
        character_id: data.characterId ?? null,
        source_image_id: data.sourceImageId ?? null,
        prompt: data.prompt,
        model: data.model,
        provider: "replicate",
        prediction_id: parsed.id,
        status: parsed.status ?? "starting",
        aspect_ratio: data.aspectRatio,
        duration_seconds: data.duration,
      })
      .select()
      .single();
    if (error) throw new Error(error.message);
    const { writeAudit } = await import("@/lib/audit.server");
    await writeAudit({
      actorId: userId,
      action: "video.generate",
      targetKind: "video",
      targetId: row.id,
      metadata: {
        model: data.model,
        aspect_ratio: data.aspectRatio,
        duration: data.duration,
        character_id: data.characterId ?? null,
      },
    });
    return row;
  });

const PollInput = z.object({ id: z.string().uuid() });

export const pollVideo = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => PollInput.parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;

    const { data: row, error } = await supabase
      .from("videos")
      .select("*")
      .eq("id", data.id)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!row || row.user_id !== userId) throw new Error("Not found");
    if (row.status === "succeeded" || row.status === "failed" || row.status === "canceled") {
      return row;
    }
    if (!row.prediction_id) throw new Error("Missing prediction id");

    const res = await fetch(`${GATEWAY}/predictions/${row.prediction_id}`, {
      headers: replicateHeaders(),
    });
    const body = await res.text();
    if (!res.ok) throw new Error(`Replicate poll error [${res.status}]: ${body}`);
    const pred = JSON.parse(body) as {
      status: string;
      output?: string | string[] | null;
      error?: string | null;
    };

    if (pred.status === "succeeded") {
      const outputUrl = Array.isArray(pred.output) ? pred.output[0] : pred.output;
      if (!outputUrl) throw new Error("Replicate returned no output url");
      const media = await fetch(outputUrl);
      if (!media.ok) throw new Error(`Failed to fetch generated video: ${media.status}`);
      const bytes = new Uint8Array(await media.arrayBuffer());
      const key = `${userId}/${Date.now()}-${crypto.randomUUID()}.mp4`;
      const { error: upErr } = await supabase.storage
        .from("generated-videos")
        .upload(key, bytes, { contentType: "video/mp4", upsert: false });
      if (upErr) throw new Error(`Upload failed: ${upErr.message}`);
      const { data: signed, error: signErr } = await supabase.storage
        .from("generated-videos")
        .createSignedUrl(key, 60 * 60 * 24 * 365);
      if (signErr || !signed?.signedUrl) throw new Error("Sign failed");

      const { data: updated, error: updErr } = await supabase
        .from("videos")
        .update({
          status: "succeeded",
          storage_path: key,
          video_url: signed.signedUrl,
          error: null,
        })
        .eq("id", row.id)
        .select()
        .single();
      if (updErr) throw new Error(updErr.message);
      return updated;
    }

    if (pred.status === "failed" || pred.status === "canceled") {
      const { data: updated } = await supabase
        .from("videos")
        .update({ status: pred.status, error: pred.error ?? "Prediction failed" })
        .eq("id", row.id)
        .select()
        .single();
      return updated ?? row;
    }

    // still processing/starting
    if (pred.status && pred.status !== row.status) {
      const { data: updated } = await supabase
        .from("videos")
        .update({ status: pred.status })
        .eq("id", row.id)
        .select()
        .single();
      return updated ?? row;
    }
    return row;
  });

export const deleteVideo = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => PollInput.parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: row, error } = await supabase
      .from("videos")
      .select("id, storage_path, user_id")
      .eq("id", data.id)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!row || row.user_id !== userId) throw new Error("Not found");
    if (row.storage_path) {
      await supabase.storage.from("generated-videos").remove([row.storage_path]);
    }
    const { error: delErr } = await supabase.from("videos").delete().eq("id", data.id);
    if (delErr) throw new Error(delErr.message);
    const { writeAudit } = await import("@/lib/audit.server");
    await writeAudit({
      actorId: userId,
      action: "video.delete",
      targetKind: "video",
      targetId: data.id,
    });
    return { ok: true };
  });
