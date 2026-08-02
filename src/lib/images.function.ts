import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const SaveImageInput = z.object({
  characterId: z.string().uuid().nullable().optional(),
  prompt: z.string().min(1).max(4000),
  model: z.string().min(1).max(100),
  b64_json: z.string().min(10),
  aspectRatio: z.string().max(20).optional().nullable(),
});

export const saveGeneratedImage = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => SaveImageInput.parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const bytes = Buffer.from(data.b64_json, "base64");
    const key = `${userId}/${Date.now()}-${crypto.randomUUID()}.png`;

    const { error: uploadError } = await supabase.storage
      .from("generated-images")
      .upload(key, bytes, { contentType: "image/png", upsert: false });
    if (uploadError) throw new Error(`Upload failed: ${uploadError.message}`);

    const { data: signed, error: signError } = await supabase.storage
      .from("generated-images")
      .createSignedUrl(key, 60 * 60 * 24 * 365);
    if (signError || !signed?.signedUrl) {
      throw new Error(`Signed URL failed: ${signError?.message ?? "unknown"}`);
    }

    const { data: row, error: insertError } = await supabase
      .from("images")
      .insert({
        user_id: userId,
        character_id: data.characterId ?? null,
        prompt: data.prompt,
        model: data.model,
        storage_path: key,
        image_url: signed.signedUrl,
        aspect_ratio: data.aspectRatio ?? null,
      })
      .select()
      .single();
    if (insertError) throw new Error(`DB insert failed: ${insertError.message}`);

    const { writeAudit } = await import("@/lib/audit.server");
    await writeAudit({
      actorId: userId,
      action: "image.generate",
      targetKind: "image",
      targetId: row.id,
      metadata: { model: data.model, character_id: data.characterId ?? null },
    });

    return row;
  });

const DeleteImageInput = z.object({ id: z.string().uuid() });

export const deleteGeneratedImage = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => DeleteImageInput.parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: img, error: readError } = await supabase
      .from("images")
      .select("id, storage_path, user_id")
      .eq("id", data.id)
      .maybeSingle();
    if (readError) throw new Error(readError.message);
    if (!img || img.user_id !== userId) throw new Error("Not found");

    await supabase.storage.from("generated-images").remove([img.storage_path]);
    const { error: delError } = await supabase.from("images").delete().eq("id", data.id);
    if (delError) throw new Error(delError.message);
    const { writeAudit } = await import("@/lib/audit.server");
    await writeAudit({
      actorId: userId,
      action: "image.delete",
      targetKind: "image",
      targetId: data.id,
    });
    return { ok: true };
  });

export const refreshImageUrl = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => DeleteImageInput.parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: img, error } = await supabase
      .from("images")
      .select("id, storage_path, user_id")
      .eq("id", data.id)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!img || img.user_id !== userId) throw new Error("Not found");

    const { data: signed, error: signError } = await supabase.storage
      .from("generated-images")
      .createSignedUrl(img.storage_path, 60 * 60 * 24 * 365);
    if (signError || !signed?.signedUrl) throw new Error("Sign failed");

    await supabase.from("images").update({ image_url: signed.signedUrl }).eq("id", img.id);
    return { url: signed.signedUrl };
  });
