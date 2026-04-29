"use client";

import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { IndividualEditForm } from "@/components/admin/IndividualEditForm";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export default function AdminIndividualNewPage() {
  return (
    <div className="space-y-6">
      <Link
        href="/admin/individuals"
        className={cn(buttonVariants({ variant: "ghost", size: "sm" }), "hidden gap-1.5 lg:inline-flex")}
      >
        <ArrowLeft className="size-4" />
        Back to people
      </Link>
      <div className="hidden lg:block">
        <h1 className="text-2xl font-semibold tracking-tight">New person</h1>
        <p className="text-muted-foreground">Add someone to the tree—basics first; you can refine everything later.</p>
      </div>
      <IndividualEditForm mode="create" />
    </div>
  );
}
