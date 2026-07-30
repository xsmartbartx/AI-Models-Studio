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