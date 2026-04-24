"use client";

import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/** Shell + back link for note / event / media editors. Default narrow column; `fullWidth` matches individual & family editors. */
export function NoteEditorPageLayout({
  backHref,
  backLabel,
  children,
  fullWidth = false,
}: {
  backHref: string;
  backLabel: string;
  children: React.ReactNode;
  /** Use full admin main column width (same idea as `DetailPageShell` `fullWidth`). */
  fullWidth?: boolean;
}) {
  return (
    <div
      className={cn(
        "mx-auto flex flex-col gap-6 pb-20 md:pb-24",
        fullWidth ? "w-full max-w-none" : "max-w-3xl",
      )}
    >
      <Link
        href={backHref}
        className={cn(buttonVariants({ variant: "ghost", size: "sm" }), "inline-flex w-fit gap-2")}
      >
        <ArrowLeft className="size-4" />
        {backLabel}
      </Link>
      {children}
    </div>
  );
}
