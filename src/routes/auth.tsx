import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import { Loader2, Sparkles } from "lucide-react";

import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable/index";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

type AuthSearch = { redirect?: string };

export const Route = createFileRoute("/auth")({
  validateSearch: (search: Record<string, unknown>): AuthSearch => ({
    redirect: typeof search.redirect === "string" ? search.redirect : undefined,
  }),
  head: () => ({
    meta: [
      { title: "Sign in — AI Influencer Factory" },
      { name: "description", content: "Sign in to manage your AI personas and generated content." },
    ],
  }),
  component: AuthPage,
});

const emailSchema = z.object({
  email: z.string().trim().email("Enter a valid email").max(255),
  password: z.string().min(8, "At least 8 characters").max(72, "Max 72 characters"),
});
type EmailInput = z.infer<typeof emailSchema>;

function safeRedirect(candidate: string | undefined): string {
  if (!candidate) return "/characters";
  try {
    // only allow same-origin paths starting with /
    if (candidate.startsWith("/") && !candidate.startsWith("//")) return candidate;
  } catch {
    // fall through
  }
  return "/characters";
}

function AuthPage() {
  const { redirect } = Route.useSearch();
  const navigate = useNavigate();
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [googleLoading, setGoogleLoading] = useState(false);

  // If already signed in, bounce away.
  useEffect(() => {
    let active = true;
    supabase.auth.getUser().then(({ data }) => {
      if (active && data.user) navigate({ to: safeRedirect(redirect), replace: true });
    });
    return () => {
      active = false;
    };
  }, [navigate, redirect]);

  const form = useForm<EmailInput>({
    resolver: zodResolver(emailSchema),
    defaultValues: { email: "", password: "" },
  });
  const [submitting, setSubmitting] = useState(false);

  async function onEmailSubmit(values: EmailInput) {
    setSubmitting(true);
    try {
      if (mode === "signin") {
        const { error } = await supabase.auth.signInWithPassword(values);
        if (error) throw error;
        toast.success("Signed in");
      } else {
        const { error } = await supabase.auth.signUp({
          email: values.email,
          password: values.password,
          options: { emailRedirectTo: window.location.origin },
        });
        if (error) throw error;
        toast.success("Account created");
      }
      navigate({ to: safeRedirect(redirect), replace: true });
    } catch (err) {
      toast.error(mode === "signin" ? "Sign-in failed" : "Sign-up failed", {
        description: (err as Error).message,
      });
    } finally {
      setSubmitting(false);
    }
  }

  async function onGoogle() {
    setGoogleLoading(true);
    try {
      const result = await lovable.auth.signInWithOAuth("google", {
        redirect_uri: window.location.origin,
      });
      if (result.error) throw result.error;
      if (result.redirected) return;
      navigate({ to: safeRedirect(redirect), replace: true });
    } catch (err) {
      toast.error("Google sign-in failed", { description: (err as Error).message });
    } finally {
      setGoogleLoading(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4 py-10">
      <div className="w-full max-w-md space-y-6">
        <div className="text-center">
          <Link to="/" className="inline-flex items-center gap-2">
            <span className="grid h-9 w-9 place-items-center rounded-xl border border-border/60 bg-gradient-surface text-brand shadow-glow">
              <Sparkles className="h-4 w-4" />
            </span>
            <span className="font-display text-lg font-semibold tracking-tight">
              AI Influencer Factory
            </span>
          </Link>
          <p className="mt-3 text-sm text-muted-foreground">
            Sign in to manage your personas and generated content.
          </p>
        </div>

        <div className="rounded-2xl border border-border/60 bg-gradient-surface p-6 shadow-panel">
          <Tabs value={mode} onValueChange={(v) => setMode(v as "signin" | "signup")}>
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="signin">Sign in</TabsTrigger>
              <TabsTrigger value="signup">Create account</TabsTrigger>
            </TabsList>

            <div className="mt-6 space-y-4">
              <Button
                type="button"
                variant="outline"
                className="w-full"
                disabled={googleLoading}
                onClick={onGoogle}
              >
                {googleLoading ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <GoogleGlyph />
                )}
                Continue with Google
              </Button>

              <div className="flex items-center gap-3 text-xs uppercase tracking-widest text-muted-foreground">
                <span className="h-px flex-1 bg-border" />
                or
                <span className="h-px flex-1 bg-border" />
              </div>

              <TabsContent value="signin" className="mt-0">
                <EmailForm
                  form={form}
                  submitting={submitting}
                  onSubmit={onEmailSubmit}
                  cta="Sign in"
                />
              </TabsContent>
              <TabsContent value="signup" className="mt-0">
                <EmailForm
                  form={form}
                  submitting={submitting}
                  onSubmit={onEmailSubmit}
                  cta="Create account"
                />
              </TabsContent>
            </div>
          </Tabs>
        </div>

        <p className="text-center text-xs text-muted-foreground">
          By continuing you agree to keep this workspace to yourself for now.
        </p>
      </div>
    </div>
  );
}

function EmailForm({
  form,
  submitting,
  onSubmit,
  cta,
}: {
  form: ReturnType<typeof useForm<EmailInput>>;
  submitting: boolean;
  onSubmit: (v: EmailInput) => void;
  cta: string;
}) {
  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
        <FormField
          control={form.control}
          name="email"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Email</FormLabel>
              <FormControl>
                <Input
                  type="email"
                  autoComplete="email"
                  placeholder="you@example.com"
                  {...field}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="password"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Password</FormLabel>
              <FormControl>
                <Input
                  type="password"
                  autoComplete={cta === "Sign in" ? "current-password" : "new-password"}
                  placeholder="At least 8 characters"
                  {...field}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <Button
          type="submit"
          disabled={submitting}
          className="w-full bg-gradient-brand text-brand-foreground shadow-glow hover:opacity-90"
        >
          {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
          {cta}
        </Button>
      </form>
    </Form>
  );
}

function GoogleGlyph() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4" aria-hidden="true">
      <path
        fill="#EA4335"
        d="M12 10.2v3.9h5.5c-.24 1.4-1.72 4.1-5.5 4.1-3.3 0-6-2.73-6-6.1s2.7-6.1 6-6.1c1.88 0 3.14.8 3.86 1.48l2.63-2.53C16.9 3.5 14.68 2.5 12 2.5 6.75 2.5 2.5 6.75 2.5 12S6.75 21.5 12 21.5c6.93 0 9.5-4.86 9.5-9.2 0-.62-.07-1.08-.15-1.6H12z"
      />
    </svg>
  );
}
