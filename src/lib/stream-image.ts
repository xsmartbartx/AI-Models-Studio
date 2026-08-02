import { createParser } from "eventsource-parser";
import { flushSync } from "react-dom";
import { supabase } from "@/integrations/supabase/client";

type ImageEventPayload =
  | {
      type: "image_generation.partial_image";
      b64_json: string;
      partial_image_index: number;
      created_at: number;
    }
  | {
      type: "image_generation.completed";
      b64_json: string;
      created_at: number;
    }
  | { type: "error"; error: { message: string; type?: string; code?: string } };

export async function streamImage(
  prompt: string,
  model: string,
  onFrame: (b64: string, isFinal: boolean) => void,
): Promise<{ b64_json: string; model: string }> {
  const { data: sessionData } = await supabase.auth.getSession();
  const token = sessionData.session?.access_token;
  if (!token) throw new Error("You must be signed in.");

  const res = await fetch("/api/generate-image", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ prompt, model }),
  });
  if (!res.ok || !res.body) {
    const text = await res.text().catch(() => "");
    throw new Error(text || `Image generation failed: ${res.status}`);
  }

  let finalB64: string | undefined;
  let streamError: string | undefined;

  const parser = createParser({
    onEvent(event) {
      let payload: ImageEventPayload | undefined;
      try {
        payload = JSON.parse(event.data) as ImageEventPayload;
      } catch {
        return;
      }
      if (event.event === "error" || payload?.type === "error") {
        streamError =
          (payload as { error?: { message?: string } } | undefined)?.error?.message ??
          "Image generation failed";
        return;
      }
      if (
        event.event !== "image_generation.partial_image" &&
        event.event !== "image_generation.completed"
      )
        return;
      const isFinal = event.event === "image_generation.completed";
      const b64 = (payload as { b64_json?: string }).b64_json;
      if (!b64) return;
      flushSync(() => {
        onFrame(b64, isFinal);
      });
      if (isFinal) finalB64 = b64;
    },
  });

  const reader = res.body.pipeThrough(new TextDecoderStream()).getReader();
  try {
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      parser.feed(value);
    }
  } finally {
    reader.cancel().catch(() => {});
  }

  if (streamError) throw new Error(streamError);
  if (!finalB64) throw new Error("Image stream ended without a completed event");
  return { b64_json: finalB64, model };
}
