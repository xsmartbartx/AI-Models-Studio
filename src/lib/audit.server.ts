import { supabaseAdmin } from "@/integrations/supabase/client.server";

export type AuditEntry = {
  actorId: string | null;
  actorEmail?: string | null;
  action: string;
  targetKind?: string | null;
  targetId?: string | null;
  metadata?: Record<string, unknown>;
};

export async function writeAudit(entry: AuditEntry) {
  try {
    await supabaseAdmin.from("audit_logs").insert({
      actor_id: entry.actorId,
      actor_email: entry.actorEmail ?? null,
      action: entry.action,
      target_kind: entry.targetKind ?? null,
      target_id: entry.targetId ?? null,
      metadata: (entry.metadata ?? {}) as never,
    });
  } catch (e) {
    console.error("[audit] write failed", e);
  }
}
