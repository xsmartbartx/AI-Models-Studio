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