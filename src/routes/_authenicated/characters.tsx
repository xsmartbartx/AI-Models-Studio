import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient, queryOptions } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import { Users, Plus, Search, ArrowUpDown, ArrowUp, ArrowDown, Loader2 } from "lucide-react";

import { PageHeader, EmptyState } from "@/components/page-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from "@/components/ui/pagination";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
  FormDescription,
} from "@/components/ui/form";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/_authenticated/characters")({
  head: () => ({
    meta: [
      { title: "Characters — AI Influencer Factory" },
      {
        name: "description",
        content: "Design consistent AI personas with appearance, style and hobbies.",
      },
    ],
  }),
  loader: ({ context }) => context.queryClient.ensureQueryData(charactersQueryOptions),
  component: CharactersPage,
});

type Character = {
  id: string;
  name: string;
  bio: string | null;
  appearance: string | null;
  style: string | null;
  created_at: string;
  updated_at: string;
};

const charactersQueryOptions = queryOptions({
  queryKey: ["characters"],
  queryFn: async (): Promise<Character[]> => {
    const { data, error } = await supabase
      .from("characters")
      .select("id, name, bio, appearance, style, created_at, updated_at")
      .order("created_at", { ascending: false });
    if (error) throw error;
    return data ?? [];
  },
});

const characterSchema = z.object({
  name: z.string().trim().min(1, "Name is required").max(80, "Max 80 characters"),
  bio: z.string().trim().max(1000, "Max 1000 characters").optional().or(z.literal("")),
  appearance: z.string().trim().max(1000, "Max 1000 characters").optional().or(z.literal("")),
  style: z.string().trim().max(500, "Max 500 characters").optional().or(z.literal("")),
});
type CharacterInput = z.infer<typeof characterSchema>;

type SortKey = "name" | "style" | "created_at";
type SortDir = "asc" | "desc";
const PAGE_SIZE_OPTIONS = [5, 10, 20];

function CharactersPage() {
  const { data: characters = [], isLoading } = useQuery(charactersQueryOptions);
  const navigate = useNavigate();

  const [dialogOpen, setDialogOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [sortKey, setSortKey] = useState<SortKey>("created_at");
  const [sortDir, setSortDir] = useState<SortDir>("desc");
  const [pageSize, setPageSize] = useState(10);
  const [page, setPage] = useState(1);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return characters;
    return characters.filter((c) =>
      [c.name, c.bio, c.appearance, c.style].filter(Boolean).join(" ").toLowerCase().includes(q),
    );
  }, [characters, query]);

  const sorted = useMemo(() => {
    const arr = [...filtered];
    arr.sort((a, b) => {
      const av = a[sortKey] ?? "";
      const bv = b[sortKey] ?? "";
      const cmp = String(av).localeCompare(String(bv));
      return sortDir === "asc" ? cmp : -cmp;
    });
    return arr;
  }, [filtered, sortKey, sortDir]);

  const totalPages = Math.max(1, Math.ceil(sorted.length / pageSize));
  const safePage = Math.min(page, totalPages);
  const paged = sorted.slice((safePage - 1) * pageSize, safePage * pageSize);

  function toggleSort(key: SortKey) {
    if (sortKey === key) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else {
      setSortKey(key);
      setSortDir(key === "created_at" ? "desc" : "asc");
    }
    setPage(1);
  }

  const isEmpty = !isLoading && characters.length === 0;
  const noResults = !isLoading && characters.length > 0 && sorted.length === 0;

  return (
    <div>
      <PageHeader
        eyebrow="Studio"
        title="Characters"
        description="Every persona defines the identity reused across images, videos and captions."
        actions={
          <NewCharacterDialog
            open={dialogOpen}
            onOpenChange={setDialogOpen}
            trigger={
              <Button className="bg-gradient-brand text-brand-foreground shadow-glow hover:opacity-90">
                <Plus className="h-4 w-4" /> New character
              </Button>
            }
          />
        }
      />

      {isLoading ? (
        <div className="mx-6 my-8 flex items-center gap-3 rounded-2xl border border-border/60 bg-gradient-surface p-8 text-sm text-muted-foreground md:mx-10">
          <Loader2 className="h-4 w-4 animate-spin" /> Loading characters…
        </div>
      ) : isEmpty ? (
        <EmptyState
          icon={<Users className="h-5 w-5" />}
          title="No characters yet"
          description="Create your first persona — name, bio, appearance and style. This becomes the anchor for InstantID / PuLID."
          action={
            <NewCharacterDialog
              open={dialogOpen}
              onOpenChange={setDialogOpen}
              trigger={
                <Button className="bg-gradient-brand text-brand-foreground shadow-glow hover:opacity-90">
                  <Plus className="h-4 w-4" /> Create character
                </Button>
              }
            />
          }
        />
      ) : (
        <div className="mx-6 my-8 space-y-4 md:mx-10">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="relative w-full sm:max-w-sm">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Search by name, bio, appearance, style…"
                value={query}
                onChange={(e) => {
                  setQuery(e.target.value);
                  setPage(1);
                }}
                className="pl-9"
              />
            </div>
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <span>Rows per page</span>
              <Select
                value={String(pageSize)}
                onValueChange={(v) => {
                  setPageSize(Number(v));
                  setPage(1);
                }}
              >
                <SelectTrigger className="h-9 w-[80px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {PAGE_SIZE_OPTIONS.map((n) => (
                    <SelectItem key={n} value={String(n)}>
                      {n}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="overflow-hidden rounded-2xl border border-border/60 bg-gradient-surface shadow-panel">
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent">
                  <SortHeader label="Name" active={sortKey === "name"} dir={sortDir} onClick={() => toggleSort("name")} />
                  <TableHead>Bio</TableHead>
                  <TableHead>Appearance</TableHead>
                  <SortHeader label="Style" active={sortKey === "style"} dir={sortDir} onClick={() => toggleSort("style")} />
                  <SortHeader label="Created" active={sortKey === "created_at"} dir={sortDir} onClick={() => toggleSort("created_at")} className="w-36" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {noResults ? (
                  <TableRow>
                    <TableCell colSpan={5} className="h-32 text-center text-sm text-muted-foreground">
                      No characters match “{query}”.
                    </TableCell>
                  </TableRow>
                ) : (
                  paged.map((c) => (
                    <TableRow
                      key={c.id}
                      onClick={() =>
                        navigate({ to: "/characters/$id", params: { id: c.id } })
                      }
                      className="cursor-pointer"
                    >
                      <TableCell className="font-medium">{c.name}</TableCell>
                      <TableCell className="max-w-[280px] text-muted-foreground">
                        <p className="line-clamp-2 text-sm">{c.bio || "—"}</p>
                      </TableCell>
                      <TableCell className="max-w-[280px] text-muted-foreground">
                        <p className="line-clamp-2 text-sm">{c.appearance || "—"}</p>
                      </TableCell>
                      <TableCell className="text-muted-foreground">{c.style || "—"}</TableCell>
                      <TableCell className="whitespace-nowrap font-mono text-xs text-muted-foreground">
                        {new Date(c.created_at).toLocaleDateString(undefined, {
                          year: "numeric",
                          month: "short",
                          day: "2-digit",
                        })}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>

          <div className="flex flex-col items-center justify-between gap-3 sm:flex-row">
            <p className="text-xs text-muted-foreground">
              {sorted.length === 0
                ? "0 results"
                : `Showing ${(safePage - 1) * pageSize + 1}–${Math.min(safePage * pageSize, sorted.length)} of ${sorted.length}`}
            </p>
            <Pagination className="mx-0 w-auto justify-end">
              <PaginationContent>
                <PaginationItem>
                  <PaginationPrevious
                    onClick={(e) => {
                      e.preventDefault();
                      setPage((p) => Math.max(1, p - 1));
                    }}
                    aria-disabled={safePage <= 1}
                    className={safePage <= 1 ? "pointer-events-none opacity-50" : "cursor-pointer"}
                  />
                </PaginationItem>
                {Array.from({ length: totalPages }, (_, i) => i + 1).map((n) => (
                  <PaginationItem key={n}>
                    <PaginationLink
                      isActive={n === safePage}
                      onClick={(e) => {
                        e.preventDefault();
                        setPage(n);
                      }}
                      className="cursor-pointer"
                    >
                      {n}
                    </PaginationLink>
                  </PaginationItem>
                ))}
                <PaginationItem>
                  <PaginationNext
                    onClick={(e) => {
                      e.preventDefault();
                      setPage((p) => Math.min(totalPages, p + 1));
                    }}
                    aria-disabled={safePage >= totalPages}
                    className={safePage >= totalPages ? "pointer-events-none opacity-50" : "cursor-pointer"}
                  />
                </PaginationItem>
              </PaginationContent>
            </Pagination>
          </div>
        </div>
      )}
    </div>
  );
}

function NewCharacterDialog({
  open,
  onOpenChange,
  trigger,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  trigger: React.ReactNode;
}) {
  const queryClient = useQueryClient();
  const form = useForm<CharacterInput>({
    resolver: zodResolver(characterSchema),
    defaultValues: { name: "", bio: "", appearance: "", style: "" },
  });

  const mutation = useMutation({
    mutationFn: async (values: CharacterInput) => {
      const { data: userData, error: userError } = await supabase.auth.getUser();
      if (userError || !userData.user) throw new Error("You must be signed in.");
      const payload = {
        user_id: userData.user.id,
        name: values.name.trim(),
        bio: values.bio?.trim() || null,
        appearance: values.appearance?.trim() || null,
        style: values.style?.trim() || null,
      };
      const { data, error } = await supabase
        .from("characters")
        .insert(payload)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["characters"] });
      toast.success(`Character “${data.name}” saved`);
      form.reset();
      onOpenChange(false);
    },
    onError: (err) => {
      toast.error("Could not save character", { description: (err as Error).message });
    },
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent className="sm:max-w-[560px]">
        <DialogHeader>
          <DialogTitle className="font-display">New character</DialogTitle>
          <DialogDescription>
            Define the persona once — it becomes the anchor reused across images, videos and captions.
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit((v) => mutation.mutate(v))} className="space-y-4">
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Name</FormLabel>
                  <FormControl>
                    <Input placeholder="e.g. Aria Nakamura" maxLength={80} {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="bio"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Bio</FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder="Age, nationality, personality, hobbies…"
                      rows={3}
                      maxLength={1000}
                      {...field}
                    />
                  </FormControl>
                  <FormDescription>Short backstory — used in captions and prompts.</FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="appearance"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Appearance</FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder="Hair, eyes, body type, skin, distinguishing features…"
                      rows={3}
                      maxLength={1000}
                      {...field}
                    />
                  </FormControl>
                  <FormDescription>
                    Feeds InstantID / PuLID prompts to keep the face consistent.
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="style"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Style</FormLabel>
                  <FormControl>
                    <Input
                      placeholder="e.g. Streetwear, Parisian chic, Y2K"
                      maxLength={500}
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <DialogFooter>
              <Button
                type="button"
                variant="ghost"
                onClick={() => onOpenChange(false)}
                disabled={mutation.isPending}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={mutation.isPending}
                className="bg-gradient-brand text-brand-foreground shadow-glow hover:opacity-90"
              >
                {mutation.isPending ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" /> Saving…
                  </>
                ) : (
                  <>Save character</>
                )}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}

function SortHeader({
  label,
  active,
  dir,
  onClick,
  className,
}: {
  label: string;
  active: boolean;
  dir: SortDir;
  onClick: () => void;
  className?: string;
}) {
  const Icon = !active ? ArrowUpDown : dir === "asc" ? ArrowUp : ArrowDown;
  return (
    <TableHead className={className}>
      <button
        type="button"
        onClick={onClick}
        className={`group inline-flex cursor-pointer items-center gap-1.5 font-medium transition-colors hover:text-foreground ${
          active ? "text-foreground" : ""
        }`}
      >
        {label}
        <Icon className={`h-3.5 w-3.5 transition-opacity ${active ? "opacity-100" : "opacity-40 group-hover:opacity-80"}`} />
      </button>
    </TableHead>
  );
}
