import { useEffect, useState } from "react";
import { useNavigate, useRouter } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { LogOut, User } from "lucide-react";
import { toast } from "sonner";

import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

type SessionUser = {
  id: string;
  email: string | null;
  display_name: string | null;
  avatar_url: string | null;
};

export function HeaderUserMenu() {
  const [user, setUser] = useState<SessionUser | null>(null);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();
  const router = useRouter();
  const queryClient = useQueryClient();

  useEffect(() => {
    let active = true;

    async function hydrate() {
      const { data } = await supabase.auth.getUser();
      if (!active) return;
      if (data.user) {
        setUser({
          id: data.user.id,
          email: data.user.email ?? null,
          display_name:
            (data.user.user_metadata?.display_name as string | undefined) ??
            (data.user.user_metadata?.full_name as string | undefined) ??
            null,
          avatar_url: (data.user.user_metadata?.avatar_url as string | undefined) ?? null,
        });
      } else {
        setUser(null);
      }
      setLoading(false);
    }

    hydrate();

    const { data: sub } = supabase.auth.onAuthStateChange((event) => {
      if (event !== "SIGNED_IN" && event !== "SIGNED_OUT" && event !== "USER_UPDATED") return;
      router.invalidate();
      if (event !== "SIGNED_OUT") {
        queryClient.invalidateQueries();
      }
      hydrate();
    });

    return () => {
      active = false;
      sub.subscription.unsubscribe();
    };
  }, [router, queryClient]);

   async function handleSignOut() {
    try {
      await queryClient.cancelQueries();
      queryClient.clear();
      const { error } = await supabase.auth.signOut();
      if (error) throw error;
      toast.success("Signed out");
      navigate({ to: "/auth", replace: true });
    } catch (err) {
      toast.error("Sign-out failed", { description: (err as Error).message });
    }
  }

  if (loading) return null;

  if (!user) {
    return (
      <Button
        size="sm"
        variant="outline"
        onClick={() => navigate({ to: "/auth" })}
      >
        Sign in
      </Button>
    );
  }

   const label = user.display_name ?? user.email ?? "Account";
  const initials = (label.match(/\b\w/g) ?? ["U"]).slice(0, 2).join("").toUpperCase();

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          className="flex items-center gap-2 rounded-full border border-border/60 bg-background/50 pl-1 pr-3 py-1 text-xs font-medium transition-colors hover:bg-background/80 cursor-pointer"
        >
          <Avatar className="h-6 w-6">
            {user.avatar_url ? <AvatarImage src={user.avatar_url} alt={label} /> : null}
            <AvatarFallback className="text-[0.6rem]">{initials}</AvatarFallback>
          </Avatar>
          <span className="max-w-[140px] truncate">{label}</span>
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuLabel className="truncate text-xs font-normal text-muted-foreground">
          {user.email}
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={() => navigate({ to: "/settings" })} className="cursor-pointer">
          <User className="h-4 w-4" /> Account settings
        </DropdownMenuItem>
        <DropdownMenuItem onClick={handleSignOut} className="cursor-pointer">
          <LogOut className="h-4 w-4" /> Sign out
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}