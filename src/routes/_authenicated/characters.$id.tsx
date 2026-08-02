import { createFileRoute, Link, useNavigate, useRouter } from "@tanstack/react-router";
import { useEffect } from "react";
import { useMutation, useQuery, useQueryClient, queryOptions } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import { ArrowLeft, Loader2, Save, Trash2 } from "lucide-react";

import { PageHeader } from "@/components/page-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
  FormDescription,
} from "@/components/ui/form";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { supabase } from "@/integrations/supabase/client";

type Character = {
  id: string;
  name: string;
  bio: string | null;
  appearance: string | null;
  style: string | null;
  created_at: string;
  updated_at: string;
};

const characterQueryOptions = (id: string) =>
  queryOptions({
    queryKey: ["characters", id],
    queryFn: async (): Promise<Character> => {
      const { data, error } = await supabase
        .from("characters")
        .select("id, name, bio, appearance, style, created_at, updated_at")
        .eq("id", id)
        .maybeSingle();
      if (error) throw error;
      if (!data) throw new Error("Character not found");
      return data;
    },
  });

export const Route = createFileRoute("/_authenticated/characters/$id")({
  head: () => ({
    meta: [
      { title: "Edit character — AI Influencer Factory" },
      { name: "description", content: "Update or delete an AI character persona." },
    ],
  }),
  component: CharacterDetailPage,
});

const characterSchema = z.object({
  name: z.string().trim().min(1, "Name is required").max(80, "Max 80 characters"),
  bio: z.string().trim().max(1000, "Max 1000 characters").optional().or(z.literal("")),
  appearance: z.string().trim().max(1000, "Max 1000 characters").optional().or(z.literal("")),
  style: z.string().trim().max(500, "Max 500 characters").optional().or(z.literal("")),
});
type CharacterInput = z.infer<typeof characterSchema>;

function CharacterDetailPage() {
  const { id } = Route.useParams();
  const navigate = useNavigate();
  const router = useRouter();
  const queryClient = useQueryClient();

  const { data: character, isLoading, error } = useQuery(characterQueryOptions(id));

  const form = useForm<CharacterInput>({
    resolver: zodResolver(characterSchema),
    defaultValues: { name: "", bio: "", appearance: "", style: "" },
  });

  useEffect(() => {
    if (character) {
      form.reset({
        name: character.name,
        bio: character.bio ?? "",
        appearance: character.appearance ?? "",
        style: character.style ?? "",
      });
    }
  }, [character, form]);

  const updateMutation = useMutation({
    mutationFn: async (values: CharacterInput) => {
      const payload = {
        name: values.name.trim(),
        bio: values.bio?.trim() || null,
        appearance: values.appearance?.trim() || null,
        style: values.style?.trim() || null,
      };
      const { data, error } = await supabase
        .from("characters")
        .update(payload)
        .eq("id", id)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["characters"] });
      queryClient.setQueryData(["characters", id], data);
      toast.success(`Saved “${data.name}”`);
    },
    onError: (err) => {
      toast.error("Could not save changes", { description: (err as Error).message });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("characters").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["characters"] });
      queryClient.removeQueries({ queryKey: ["characters", id] });
      toast.success("Character deleted");
      navigate({ to: "/characters" });
    },
    onError: (err) => {
      toast.error("Could not delete character", { description: (err as Error).message });
    },
  });

  if (isLoading) {
    return (
      <div>
        <PageHeader eyebrow="Studio" title="Character" description="Loading…" />
        <div className="mx-6 my-8 flex items-center gap-3 rounded-2xl border border-border/60 bg-gradient-surface p-8 text-sm text-muted-foreground md:mx-10">
          <Loader2 className="h-4 w-4 animate-spin" /> Loading character…
        </div>
      </div>
    );
  }

  if (error || !character) {
    return (
      <div>
        <PageHeader
          eyebrow="Studio"
          title="Character not found"
          description="This character doesn't exist or you don't have access."
          actions={
            <Button asChild variant="secondary">
              <Link to="/characters">
                <ArrowLeft className="h-4 w-4" /> Back to characters
              </Link>
            </Button>
          }
        />
      </div>
    );
  }

  const isBusy = updateMutation.isPending || deleteMutation.isPending;

  return (
    <div>
      <PageHeader
        eyebrow="Studio · Character"
        title={character.name}
        description={`Created ${new Date(character.created_at).toLocaleDateString()} · Last updated ${new Date(character.updated_at).toLocaleDateString()}`}
        actions={
          <div className="flex items-center gap-2">
            <Button variant="ghost" onClick={() => router.history.back()}>
              <ArrowLeft className="h-4 w-4" /> Back
            </Button>
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="destructive" disabled={isBusy}>
                  <Trash2 className="h-4 w-4" /> Delete
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Delete “{character.name}”?</AlertDialogTitle>
                  <AlertDialogDescription>
                    This permanently removes the character. Images, videos and posts already
                    generated will keep their existing files, but references to this persona
                    will be broken. This cannot be undone.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel disabled={deleteMutation.isPending}>Cancel</AlertDialogCancel>
                  <AlertDialogAction
                    onClick={(e) => {
                      e.preventDefault();
                      deleteMutation.mutate();
                    }}
                    disabled={deleteMutation.isPending}
                    className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                  >
                    {deleteMutation.isPending ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin" /> Deleting…
                      </>
                    ) : (
                      <>Delete character</>
                    )}
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>
        }
      />

      <div className="mx-6 my-8 max-w-3xl md:mx-10">
        <div className="rounded-2xl border border-border/60 bg-gradient-surface p-6 shadow-panel md:p-8">
          <Form {...form}>
            <form
              onSubmit={form.handleSubmit((v) => updateMutation.mutate(v))}
              className="space-y-5"
            >
              <FormField
                control={form.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Name</FormLabel>
                    <FormControl>
                      <Input maxLength={80} {...field} />
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
                      <Textarea rows={3} maxLength={1000} {...field} />
                    </FormControl>
                    <FormDescription>
                      Short backstory — used in captions and prompts.
                    </FormDescription>
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
                      <Textarea rows={4} maxLength={1000} {...field} />
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
                      <Input maxLength={500} {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="flex items-center justify-end gap-2 pt-2">
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() => form.reset()}
                  disabled={!form.formState.isDirty || isBusy}
                >
                  Reset
                </Button>
                <Button
                  type="submit"
                  disabled={!form.formState.isDirty || isBusy}
                  className="bg-gradient-brand text-brand-foreground shadow-glow hover:opacity-90"
                >
                  {updateMutation.isPending ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" /> Saving…
                    </>
                  ) : (
                    <>
                      <Save className="h-4 w-4" /> Save changes
                    </>
                  )}
                </Button>
              </div>
            </form>
          </Form>
        </div>
      </div>
    </div>
  );
}
