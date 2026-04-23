"use client";

import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/** Max-width shell + back link for note create/edit (matches note detail layout rhythm). */
export function NoteEditorPageLayout({
  backHref,
  backLabel,
  children,
}: {
  backHref: string;
  backLabel: string;
  children: React.ReactNode;
}) {
  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-6 pb-20 md:pb-24">
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
