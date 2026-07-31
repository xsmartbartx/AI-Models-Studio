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