"use client";

import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { cn } from "@/lib/utils";

type PageHeaderProps = {
  title: string;
  subtitle?: React.ReactNode;
  icon?: React.ReactNode;
  back?: string;
  backLabel?: string;
  actions?: React.ReactNode;
  className?: string;
};

export function PageHeader({
  title,
  subtitle,
  icon,
  back,
  backLabel,
  actions,
  className,
}: PageHeaderProps) {
  return (
    <header
      className={cn(
        "flex animate-fade-in-up flex-col gap-3 sm:flex-row sm:items-start sm:justify-between",
        className,
      )}
    >
      <div className="flex min-w-0 items-start gap-3">
        {back ? (
          <Link
            href={back}
            aria-label={backLabel ?? "Volver"}
            className="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-border bg-card text-muted-foreground shadow-soft transition-all hover:border-primary/40 hover:bg-accent hover:text-accent-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
          >
            <ArrowLeft className="h-4 w-4" />
          </Link>
        ) : null}

        <div className="min-w-0">
          <div className="flex items-center gap-2.5">
            {icon ? <span className="flex shrink-0 items-center">{icon}</span> : null}
            <h1 className="truncate text-xl font-bold tracking-tight text-foreground sm:text-2xl">
              {title}
            </h1>
          </div>
          {subtitle ? (
            <p className="mt-1 text-sm text-muted-foreground">{subtitle}</p>
          ) : null}
        </div>
      </div>

      {actions ? (
        <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div>
      ) : null}
    </header>
  );
}
