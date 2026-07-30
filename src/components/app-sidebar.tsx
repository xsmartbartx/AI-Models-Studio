import { Link, useRouterState } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import {
  Sparkles,
  Users,
  ImageIcon,
  Film,
  MessageSquareText,
  CalendarClock,
  BookOpen,
  Settings,
  Shield,
} from "lucide-react";
import { checkIsAdmin } from "@/lib/admin.functions";

import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar";

const studioItems = [
  { title: "Characters", url: "/characters", icon: Users },
  { title: "Images", url: "/images", icon: ImageIcon },
  { title: "Videos", url: "/videos", icon: Film },
];

const publishItems = [
  { title: "Posts", url: "/posts", icon: MessageSquareText },
  { title: "Scheduler", url: "/scheduler", icon: CalendarClock },
];

const libraryItems = [
  { title: "Prompt Library", url: "/prompts", icon: BookOpen },
  { title: "Settings", url: "/settings", icon: Settings },
];

export function AppSidebar() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const { data: adminGate } = useQuery({
    queryKey: ["admin", "is-admin"],
    queryFn: () => checkIsAdmin(),
    staleTime: 60_000,
  });
  const isActive = (url: string) =>
    url === "/" ? pathname === "/" : pathname === url || pathname.startsWith(url + "/");

  const renderGroup = (
    label: string,
    items: { title: string; url: string; icon: React.ComponentType<{ className?: string }> }[],
  ) => (
    <SidebarGroup>
      <SidebarGroupLabel className="text-[0.68rem] uppercase tracking-[0.14em] text-muted-foreground/80">
        {label}
      </SidebarGroupLabel>
      <SidebarGroupContent>
        <SidebarMenu>
          {items.map((item) => (
            <SidebarMenuItem key={item.url}>
              <SidebarMenuButton
                asChild
                isActive={isActive(item.url)}
                className="data-[active=true]:bg-brand/10 data-[active=true]:text-brand data-[active=true]:font-medium"
              >
                <Link to={item.url} className="flex items-center gap-3">
                  <item.icon className="h-4 w-4" />
                  <span>{item.title}</span>
                </Link>
              </SidebarMenuButton>
            </SidebarMenuItem>
          ))}
        </SidebarMenu>
      </SidebarGroupContent>
    </SidebarGroup>
  );

    return (
    <Sidebar collapsible="icon" className="border-r border-sidebar-border">
      <SidebarHeader className="px-3 pt-4 pb-2">
        <Link to="/" className="flex items-center gap-2.5">
          <div className="grid h-9 w-9 place-items-center rounded-lg bg-gradient-brand shadow-glow">
            <Sparkles className="h-4 w-4 text-brand-foreground" />
          </div>
          <div className="flex flex-col leading-tight">
            <span className="font-display text-sm font-semibold tracking-tight">
              Influencer Factory
            </span>
            <span className="text-[0.68rem] text-muted-foreground">
              Zero-budget studio
            </span>
          </div>
        </Link>
      </SidebarHeader>

      <SidebarContent className="px-1">
        {renderGroup("Studio", studioItems)}
        {renderGroup("Publish", publishItems)}
        {renderGroup("Workspace", libraryItems)}
        {adminGate?.isAdmin &&
          renderGroup("Admin", [{ title: "Dashboard", url: "/admin", icon: Shield }])}
      </SidebarContent>

      <SidebarFooter className="px-3 pb-4">
        <div className="rounded-lg border border-sidebar-border bg-sidebar-accent/40 p-3">
          <p className="font-display text-xs font-medium">Local runtime</p>
          <p className="mt-1 text-[0.7rem] leading-relaxed text-muted-foreground">
            Connect ComfyUI & Ollama in Settings to enable generation.
          </p>
        </div>
      </SidebarFooter>
    </Sidebar>
  );
}