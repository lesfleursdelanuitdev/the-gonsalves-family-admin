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
        className={cn(buttonVariants({ variant: "ghost", size: "sm" }), "inline-flex gap-1.5")}
      >
        <ArrowLeft className="size-4" />
        Back
      </Link>
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">New individual</h1>
        <p className="text-muted-foreground">Create a person in the admin tree.</p>
      </div>
      <IndividualEditForm mode="create" />
    </div>
  );
}
