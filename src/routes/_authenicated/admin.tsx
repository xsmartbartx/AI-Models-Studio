import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient, queryOptions } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { Shield, ShieldOff, Trash2, Users, ImageIcon, Film, Sparkles, Loader2, AlertTriangle, ScrollText } from "lucide-react";

import { PageHeader } from "@/components/page-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  getAdminOverview,
  checkIsAdmin,
  grantRole,
  revokeRole,
  adminDeleteRow,
  listAuditLogs,
} from "@/lib/admin.functions";

const auditQO = queryOptions({
  queryKey: ["admin", "audit"],
  queryFn: () => listAuditLogs({ data: {} }),
});

const isAdminQO = queryOptions({
  queryKey: ["admin", "is-admin"],
  queryFn: () => checkIsAdmin(),
  staleTime: 60_000,
});

const overviewQO = queryOptions({
  queryKey: ["admin", "overview"],
  queryFn: () => getAdminOverview(),
});

export const Route = createFileRoute("/_authenticated/admin")({
  head: () => ({
    meta: [{ title: "Admin — AI Influencer Factory" }],
  }),
  component: AdminPage,
});

function AdminPage() {
  const qc = useQueryClient();
  const isAdminFn = useServerFn(checkIsAdmin);
  const overviewFn = useServerFn(getAdminOverview);
  const grantFn = useServerFn(grantRole);
  const revokeFn = useServerFn(revokeRole);
  const deleteFn = useServerFn(adminDeleteRow);

  const { data: gate, isLoading: gateLoading } = useQuery({
    ...isAdminQO,
    queryFn: () => isAdminFn(),
  });

  const isAdmin = !!gate?.isAdmin;

  const { data, isLoading, error } = useQuery({
    ...overviewQO,
    queryFn: () => overviewFn(),
    enabled: isAdmin,
  });

  const [search, setSearch] = useState("");

  const usersById = useMemo(() => {
    const m = new Map<string, { email: string | null }>();
    (data?.users ?? []).forEach((u) => m.set(u.id, { email: u.email }));
    return m;
  }, [data]);

  const rolesByUser = useMemo(() => {
    const m = new Map<string, Set<string>>();
    (data?.roles ?? []).forEach((r) => {
      if (!m.has(r.user_id)) m.set(r.user_id, new Set());
      m.get(r.user_id)!.add(r.role);
    });
    return m;
  }, [data]);

  const filteredUsers = useMemo(() => {
    const q = search.trim().toLowerCase();
    const users = data?.users ?? [];
    if (!q) return users;
    return users.filter(
      (u) => u.email?.toLowerCase().includes(q) || u.id.toLowerCase().includes(q),
    );
  }, [data, search]);

  const grantMut = useMutation({
    mutationFn: (userId: string) => grantFn({ data: { userId, role: "admin" } }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin", "overview"] });
      toast.success("Admin role granted");
    },
    onError: (e) => toast.error("Failed", { description: (e as Error).message }),
  });

  const revokeMut = useMutation({
    mutationFn: (userId: string) => revokeFn({ data: { userId, role: "admin" } }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin", "overview"] });
      toast.success("Admin role revoked");
    },
    onError: (e) => toast.error("Failed", { description: (e as Error).message }),
  });

  const delMut = useMutation({
    mutationFn: (v: { kind: "image" | "video" | "character"; id: string }) =>
      deleteFn({ data: v }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin", "overview"] });
      toast.success("Deleted");
    },
    onError: (e) => toast.error("Delete failed", { description: (e as Error).message }),
  });

  if (gateLoading) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center gap-2 text-sm text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" /> Checking permissions…
      </div>
    );
  }

  if (!isAdmin) {
    return (
      <div className="mx-auto max-w-md p-10 text-center">
        <div className="mx-auto mb-4 grid h-12 w-12 place-items-center rounded-full bg-destructive/10 text-destructive">
          <AlertTriangle className="h-5 w-5" />
        </div>
        <h1 className="font-display text-xl font-semibold">Admins only</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          You don't have permission to view this page.
        </p>
        <Button asChild variant="outline" className="mt-6">
          <Link to="/">Back to app</Link>
        </Button>
      </div>
    );
  }

  return (
    <div>
      <PageHeader
        eyebrow="Workspace"
        title="Admin"
        description="Full-database view. Manage roles, moderate generated media, and see every user."
      />

      <div className="mx-6 mt-6 grid grid-cols-2 gap-3 md:mx-10 md:grid-cols-4">
        <StatCard icon={<Users className="h-4 w-4" />} label="Users" value={data?.stats.users ?? "—"} />
        <StatCard icon={<Sparkles className="h-4 w-4" />} label="Characters" value={data?.stats.characters ?? "—"} />
        <StatCard icon={<ImageIcon className="h-4 w-4" />} label="Images" value={data?.stats.images ?? "—"} />
        <StatCard icon={<Film className="h-4 w-4" />} label="Videos" value={data?.stats.videos ?? "—"} />
      </div>

      {error && (
        <div className="mx-6 mt-4 rounded-lg border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive md:mx-10">
          {(error as Error).message}
        </div>
      )}

      <div className="mx-6 my-8 md:mx-10">
        <Tabs defaultValue="users">
          <TabsList>
            <TabsTrigger value="users">Users</TabsTrigger>
            <TabsTrigger value="images">Images</TabsTrigger>
            <TabsTrigger value="videos">Videos</TabsTrigger>
            <TabsTrigger value="characters">Characters</TabsTrigger>
            <TabsTrigger value="audit">Audit log</TabsTrigger>
          </TabsList>

          <TabsContent value="users" className="mt-4">
            <div className="mb-3">
              <Input
                placeholder="Search by email or id…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="max-w-md"
              />
            </div>
            <div className="rounded-2xl border border-border/60 bg-gradient-surface shadow-panel">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Email</TableHead>
                    <TableHead>Roles</TableHead>
                    <TableHead>Signed up</TableHead>
                    <TableHead>Last seen</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {isLoading ? (
                    <TableRow>
                      <TableCell colSpan={5}>
                        <div className="flex items-center gap-2 py-4 text-sm text-muted-foreground">
                          <Loader2 className="h-4 w-4 animate-spin" /> Loading…
                        </div>
                      </TableCell>
                    </TableRow>
                  ) : filteredUsers.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={5} className="py-6 text-center text-sm text-muted-foreground">
                        No users match.
                      </TableCell>
                    </TableRow>
                  ) : (
                    filteredUsers.map((u) => {
                      const roles = rolesByUser.get(u.id);
                      const isUserAdmin = roles?.has("admin");
                      return (
                        <TableRow key={u.id}>
                          <TableCell className="font-medium">{u.email ?? "—"}</TableCell>
                          <TableCell>
                            {isUserAdmin ? (
                              <span className="rounded-full bg-brand/10 px-2 py-0.5 text-xs text-brand">
                                admin
                              </span>
                            ) : (
                              <span className="text-xs text-muted-foreground">user</span>
                            )}
                          </TableCell>
                          <TableCell className="text-xs text-muted-foreground">
                            {new Date(u.created_at).toLocaleDateString()}
                          </TableCell>
                          <TableCell className="text-xs text-muted-foreground">
                            {u.last_sign_in_at
                              ? new Date(u.last_sign_in_at).toLocaleDateString()
                              : "never"}
                          </TableCell>
                          <TableCell className="text-right">
                            {isUserAdmin ? (
                              <Button
                                size="sm"
                                variant="ghost"
                                disabled={revokeMut.isPending}
                                onClick={() => revokeMut.mutate(u.id)}
                              >
                                <ShieldOff className="h-3.5 w-3.5" /> Revoke admin
                              </Button>
                            ) : (
                              <Button
                                size="sm"
                                variant="ghost"
                                disabled={grantMut.isPending}
                                onClick={() => grantMut.mutate(u.id)}
                              >
                                <Shield className="h-3.5 w-3.5" /> Make admin
                              </Button>
                            )}
                          </TableCell>
                        </TableRow>
                      );
                    })
                  )}
                </TableBody>
              </Table>
            </div>
          </TabsContent>

          <TabsContent value="images" className="mt-4">
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
              {(data?.images ?? []).map((img) => (
                <div key={img.id} className="group relative aspect-square overflow-hidden rounded-xl border border-border/60">
                  <img src={img.image_url} alt="" loading="lazy" className="h-full w-full object-cover" />
                  <div className="absolute inset-0 flex flex-col justify-between bg-gradient-to-t from-background/95 via-background/40 to-transparent p-2 opacity-0 transition group-hover:opacity-100">
                    <span className="ml-auto rounded bg-background/70 px-1.5 py-0.5 text-[0.6rem] font-mono text-foreground">
                      {usersById.get(img.user_id)?.email?.split("@")[0] ?? "unknown"}
                    </span>
                    <div className="flex items-end justify-between gap-2">
                      <p className="line-clamp-2 text-[0.65rem] text-foreground">{img.prompt}</p>
                      <Button
                        size="icon"
                        variant="destructive"
                        className="h-7 w-7 shrink-0"
                        onClick={() => delMut.mutate({ kind: "image", id: img.id })}
                      >
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </TabsContent>

          <TabsContent value="videos" className="mt-4">
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
              {(data?.videos ?? []).map((v) => (
                <div key={v.id} className="group relative aspect-square overflow-hidden rounded-xl border border-border/60 bg-background/40">
                  {v.video_url ? (
                    <video src={v.video_url} muted loop playsInline className="h-full w-full object-cover" />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center text-xs uppercase tracking-widest text-muted-foreground">
                      {v.status}
                    </div>
                  )}
                  <div className="absolute inset-0 flex flex-col justify-between bg-gradient-to-t from-background/95 via-background/40 to-transparent p-2 opacity-0 transition group-hover:opacity-100">
                    <span className="ml-auto rounded bg-background/70 px-1.5 py-0.5 text-[0.6rem] font-mono">
                      {usersById.get(v.user_id)?.email?.split("@")[0] ?? "unknown"}
                    </span>
                    <div className="flex items-end justify-between gap-2">
                      <p className="line-clamp-2 text-[0.65rem]">{v.prompt}</p>
                      <Button
                        size="icon"
                        variant="destructive"
                        className="h-7 w-7 shrink-0"
                        onClick={() => delMut.mutate({ kind: "video", id: v.id })}
                      >
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </TabsContent>

          <TabsContent value="characters" className="mt-4">
            <div className="rounded-2xl border border-border/60 bg-gradient-surface shadow-panel">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Owner</TableHead>
                    <TableHead>Created</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {(data?.characters ?? []).map((c) => (
                    <TableRow key={c.id}>
                      <TableCell className="font-medium">{c.name}</TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {usersById.get(c.user_id)?.email ?? c.user_id.slice(0, 8)}
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {new Date(c.created_at).toLocaleDateString()}
                      </TableCell>
                      <TableCell className="text-right">
                        <Button
                          size="sm"
                          variant="ghost"
                          className="text-destructive"
                          onClick={() => delMut.mutate({ kind: "character", id: c.id })}
                        >
                          <Trash2 className="h-3.5 w-3.5" /> Delete
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </TabsContent>

          <TabsContent value="audit" className="mt-4">
            <AuditLogTable usersById={usersById} />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}

function StatCard({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: number | string;
}) {
  return (
    <div className="rounded-2xl border border-border/60 bg-gradient-surface p-4 shadow-panel">
      <div className="flex items-center gap-2 text-xs uppercase tracking-widest text-muted-foreground">
        {icon} {label}
      </div>
      <p className="mt-2 font-display text-2xl font-semibold">{value}</p>
    </div>
  );
}

function AuditLogTable({ usersById }: { usersById: Map<string, { email: string | null }> }) {
  const listFn = useServerFn(listAuditLogs);
  const { data, isLoading, error } = useQuery({
    ...auditQO,
    queryFn: () => listFn({ data: {} }),
    refetchInterval: 15_000,
  });

  const rows = data ?? [];

  return (
    <div className="rounded-2xl border border-border/60 bg-gradient-surface shadow-panel">
      <div className="flex items-center gap-2 border-b border-border/60 px-4 py-3 text-xs uppercase tracking-widest text-muted-foreground">
        <ScrollText className="h-4 w-4" /> Sensitive-action history
      </div>
      {error && (
        <div className="p-3 text-sm text-destructive">{(error as Error).message}</div>
      )}
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>When</TableHead>
            <TableHead>Actor</TableHead>
            <TableHead>Action</TableHead>
            <TableHead>Target</TableHead>
            <TableHead>Details</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {isLoading ? (
            <TableRow>
              <TableCell colSpan={5}>
                <div className="flex items-center gap-2 py-4 text-sm text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin" /> Loading…
                </div>
              </TableCell>
            </TableRow>
          ) : rows.length === 0 ? (
            <TableRow>
              <TableCell colSpan={5} className="py-6 text-center text-sm text-muted-foreground">
                No audit events yet.
              </TableCell>
            </TableRow>
          ) : (
            rows.map((r) => {
              const email =
                r.actor_email ?? (r.actor_id ? usersById.get(r.actor_id)?.email : null) ?? null;
              return (
                <TableRow key={r.id}>
                  <TableCell className="whitespace-nowrap text-xs text-muted-foreground">
                    {new Date(r.created_at).toLocaleString()}
                  </TableCell>
                  <TableCell className="text-xs">
                    <div className="font-medium">{email ?? "system"}</div>
                    <div className="font-mono text-[0.65rem] text-muted-foreground">
                      {r.actor_id?.slice(0, 8) ?? "—"}
                    </div>
                  </TableCell>
                  <TableCell>
                    <span className="rounded-full bg-brand/10 px-2 py-0.5 text-xs text-brand">
                      {r.action}
                    </span>
                  </TableCell>
                  <TableCell className="text-xs">
                    {r.target_kind ? (
                      <>
                        <div>{r.target_kind}</div>
                        <div className="font-mono text-[0.65rem] text-muted-foreground">
                          {r.target_id?.slice(0, 8)}
                        </div>
                      </>
                    ) : (
                      "—"
                    )}
                  </TableCell>
                  <TableCell className="max-w-[320px]">
                    <pre className="truncate font-mono text-[0.65rem] text-muted-foreground">
                      {r.metadata && Object.keys(r.metadata as object).length > 0
                        ? JSON.stringify(r.metadata)
                        : "—"}
                    </pre>
                  </TableCell>
                </TableRow>
              );
            })
          )}
        </TableBody>
      </Table>
    </div>
  );
}
