"use client";

import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface DetailPageShellProps {
  backHref: string;
  backLabel: string;
  isLoading: boolean;
  error: unknown;
  /** The fetched entity – if falsy after loading, treated as not-found */
  data: unknown;
  notFoundMessage?: string;
  children: React.ReactNode;
  /** Match full admin main column (e.g. long edit forms); default is centered max-w-3xl. */
  fullWidth?: boolean;
}

function BackLink({ href, label }: { href: string; label: string }) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <Link
        href={href}
        className={cn(buttonVariants({ variant: "ghost", size: "sm" }), "inline-flex gap-2")}
      >
        <ArrowLeft className="size-4" />
        {label}
      </Link>
    </div>
  );
}

export function DetailPageShell({
  backHref,
  backLabel,
  isLoading,
  error,
  data,
  notFoundMessage = "Could not load this item.",
  children,
  fullWidth = false,
}: DetailPageShellProps) {
  const containerClass = cn(
    "mx-auto flex w-full flex-col",
    fullWidth ? "max-w-none" : "max-w-3xl",
  );

  if (isLoading) {
    return <p className="text-muted-foreground">Loading…</p>;
  }

  if (error || !data) {
    return (
      <div className={cn(containerClass, "gap-4 pb-20")}>
        <BackLink href={backHref} label={backLabel} />
        <p className="text-destructive">{notFoundMessage}</p>
      </div>
    );
  }

  return (
    <div className={cn(containerClass, "gap-6 pb-20 md:pb-24")}>
      <BackLink href={backHref} label={backLabel} />
      {children}
    </div>
  );
}
