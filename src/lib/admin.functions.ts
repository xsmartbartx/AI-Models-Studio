import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

async function assertAdmin(supabase: any, userId: string) {
  const { data, error } = await supabase.rpc("has_role", {
    _user_id: userId,
    _role: "admin",
  });
  if (error) throw new Error(error.message);
  if (!data) throw new Error("Forbidden");
}

async function actorEmail(userId: string): Promise<string | null> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data } = await supabaseAdmin.auth.admin.getUserById(userId);
  return data.user?.email ?? null;
}

export const getAdminOverview = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    await assertAdmin(supabase, userId);

        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const [usersRes, chars, imgs, vids, roles] = await Promise.all([
      supabaseAdmin.auth.admin.listUsers({ page: 1, perPage: 200 }),
      supabaseAdmin.from("characters").select("id, name, user_id, created_at").order("created_at", { ascending: false }).limit(500),
      supabaseAdmin.from("images").select("id, prompt, model, image_url, user_id, character_id, created_at").order("created_at", { ascending: false }).limit(500),
      supabaseAdmin.from("videos").select("id, prompt, model, status, video_url, user_id, character_id, created_at").order("created_at", { ascending: false }).limit(500),
      supabaseAdmin.from("user_roles").select("user_id, role"),
    ]);

    if (usersRes.error) throw new Error(usersRes.error.message);
    if (chars.error) throw new Error(chars.error.message);
    if (imgs.error) throw new Error(imgs.error.message);
    if (vids.error) throw new Error(vids.error.message);
    if (roles.error) throw new Error(roles.error.message);

    const users = (usersRes.data.users ?? []).map((u) => ({
      id: u.id,
      email: u.email ?? null,
      created_at: u.created_at,
      last_sign_in_at: u.last_sign_in_at ?? null,
    }));

    return {
      users,
      characters: chars.data ?? [],
      images: imgs.data ?? [],
      videos: vids.data ?? [],
      roles: roles.data ?? [],
      stats: {
        users: users.length,
        characters: chars.data?.length ?? 0,
        images: imgs.data?.length ?? 0,
        videos: vids.data?.length ?? 0,
      },
    };
  });

export const checkIsAdmin = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const { data } = await supabase.rpc("has_role", {
      _user_id: userId,
      _role: "admin",
    });
    return { isAdmin: !!data };
  });

  const RoleMutation = z.object({
  userId: z.string().uuid(),
  role: z.enum(["admin", "user"]),
});

export const grantRole = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => RoleMutation.parse(i))
  .handler(async ({ data, context }) => {
    await assertAdmin(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { writeAudit } = await import("@/lib/audit.server");
    const { error } = await supabaseAdmin
      .from("user_roles")
      .insert({ user_id: data.userId, role: data.role });
    if (error && !/duplicate key/i.test(error.message)) throw new Error(error.message);
    await writeAudit({
      actorId: context.userId,
      actorEmail: await actorEmail(context.userId),
      action: "role.grant",
      targetKind: "user",
      targetId: data.userId,
      metadata: { role: data.role },
    });
    return { ok: true };
  });

export const revokeRole = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => RoleMutation.parse(i))
  .handler(async ({ data, context }) => {
    await assertAdmin(context.supabase, context.userId);
    if (data.userId === context.userId && data.role === "admin") {
      throw new Error("You cannot revoke your own admin role.");
    }
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { writeAudit } = await import("@/lib/audit.server");
    const { error } = await supabaseAdmin
      .from("user_roles")
      .delete()
      .eq("user_id", data.userId)
      .eq("role", data.role);
    if (error) throw new Error(error.message);
    await writeAudit({
      actorId: context.userId,
      actorEmail: await actorEmail(context.userId),
      action: "role.revoke",
      targetKind: "user",
      targetId: data.userId,
      metadata: { role: data.role },
    });
    return { ok: true };
  });

  const DeleteInput = z.object({
  kind: z.enum(["image", "video", "character"]),
  id: z.string().uuid(),
});

export const adminDeleteRow = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => DeleteInput.parse(i))
  .handler(async ({ data, context }) => {
    await assertAdmin(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { writeAudit } = await import("@/lib/audit.server");

    let ownerId: string | null = null;

    if (data.kind === "image") {
      const { data: row } = await supabaseAdmin
        .from("images")
        .select("storage_path, user_id")
        .eq("id", data.id)
        .maybeSingle();
      ownerId = row?.user_id ?? null;
      if (row?.storage_path) {
        await supabaseAdmin.storage.from("generated-images").remove([row.storage_path]);
      }
      const { error } = await supabaseAdmin.from("images").delete().eq("id", data.id);
      if (error) throw new Error(error.message);
    } else if (data.kind === "video") {
      const { data: row } = await supabaseAdmin
        .from("videos")
        .select("storage_path, user_id")
        .eq("id", data.id)
        .maybeSingle();
      ownerId = row?.user_id ?? null;
      if (row?.storage_path) {
        await supabaseAdmin.storage.from("generated-videos").remove([row.storage_path]);
      }
      const { error } = await supabaseAdmin.from("videos").delete().eq("id", data.id);
      if (error) throw new Error(error.message);
    } else {
      const { data: row } = await supabaseAdmin
        .from("characters")
        .select("user_id")
        .eq("id", data.id)
        .maybeSingle();
      ownerId = row?.user_id ?? null;
      const { error } = await supabaseAdmin.from("characters").delete().eq("id", data.id);
      if (error) throw new Error(error.message);
    }

    await writeAudit({
      actorId: context.userId,
      actorEmail: await actorEmail(context.userId),
      action: `admin.delete.${data.kind}`,
      targetKind: data.kind,
      targetId: data.id,
      metadata: { owner_id: ownerId },
    });
    return { ok: true };
  });

  const ListAuditInput = z.object({
  limit: z.number().int().min(1).max(500).optional(),
  action: z.string().max(100).optional(),
}).optional();

export const listAuditLogs = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => ListAuditInput.parse(i))
  .handler(async ({ data, context }) => {
    await assertAdmin(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    let q = supabaseAdmin
      .from("audit_logs")
      .select("id, actor_id, actor_email, action, target_kind, target_id, metadata, created_at")
      .order("created_at", { ascending: false })
      .limit(data?.limit ?? 200);
    if (data?.action) q = q.eq("action", data.action);
    const { data: rows, error } = await q;
    if (error) throw new Error(error.message);
    return rows ?? [];
  });