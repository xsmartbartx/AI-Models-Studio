import type { ReactNode } from "react";

interface PageHeaderProps {
  eyebrow?: string;
  title: string;
  description?: string;
  actions?: ReactNode;
}

export function PageHeader({ eyebrow, title, description, actions }: PageHeaderProps) {
  return (
    <div className="flex flex-col gap-4 border-b border-border/60 px-6 py-8 md:flex-row md:items-end md:justify-between md:px-10">
      <div className="max-w-2xl space-y-2">
        {eyebrow && (
          <p className="font-mono text-[0.68rem] uppercase tracking-[0.18em] text-brand">
            {eyebrow}
          </p>
        )}
        <h1 className="font-display text-3xl font-semibold tracking-tight md:text-4xl">
          {title}
        </h1>
        {description && (
          <p className="text-sm leading-relaxed text-muted-foreground md:text-base">
            {description}
          </p>
        )}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}

interface EmptyStateProps {
  icon: ReactNode;
  title: string;
  description: string;
  action?: ReactNode;
}

export function EmptyState({ icon, title, description, action }: EmptyStateProps) {
  return (
    <div className="mx-6 my-8 md:mx-10">
      <div className="relative overflow-hidden rounded-2xl border border-border/60 bg-gradient-surface p-10 shadow-panel">
        <div className="pointer-events-none absolute -right-24 -top-24 h-64 w-64 rounded-full bg-brand/10 blur-3xl" />
        <div className="relative flex flex-col items-start gap-4">
          <div className="grid h-11 w-11 place-items-center rounded-xl border border-border/60 bg-background/60 text-brand">
            {icon}
          </div>
          <div className="space-y-1.5">
            <h2 className="font-display text-xl font-semibold tracking-tight">{title}</h2>
            <p className="max-w-xl text-sm leading-relaxed text-muted-foreground">
              {description}
            </p>
          </div>
          {action && <div className="pt-2">{action}</div>}
        </div>
      </div>
    </div>
  );
}