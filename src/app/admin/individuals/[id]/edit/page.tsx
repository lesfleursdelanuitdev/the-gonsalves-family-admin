"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { IndividualEditForm } from "@/components/admin/IndividualEditForm";
import { buttonVariants } from "@/components/ui/button";
import { useAdminIndividual } from "@/hooks/useAdminIndividuals";
import {
  formatDisplayNameFromNameForms,
  initialsFromPersonLabel,
  type NameFormForDisplay,
} from "@/lib/gedcom/display-name";
import { cn } from "@/lib/utils";

function individualEditPageLabel(ind: Record<string, unknown>): string {
  const fromForms = formatDisplayNameFromNameForms(
    ind.individualNameForms as NameFormForDisplay[] | null | undefined,
    typeof ind.fullName === "string" ? ind.fullName : null,
  ).trim();
  if (fromForms) return fromForms;
  const xref = typeof ind.xref === "string" ? ind.xref.trim() : "";
  if (xref) return xref;
  return "—";
}

function isHttpUrl(s: string): boolean {
  try {
    const u = new URL(s);
    return u.protocol === "http:" || u.protocol === "https:";
  } catch {
    return false;
  }
}

function inferMediaKind(form: string | null | undefined): "photo" | "document" | "video" {
  const f = (form ?? "").toLowerCase();
  if (f.includes("video") || f === "video") return "video";
  if (f.includes("doc") || f === "document") return "document";
  return "photo";
}

function firstIndividualPhotoUrl(
  individualMedia: { media: Record<string, unknown> }[] | null | undefined,
): string | null {
  for (const row of individualMedia ?? []) {
    const m = row.media;
    const ref = typeof m.fileRef === "string" ? m.fileRef.trim() : "";
    if (!ref || !isHttpUrl(ref)) continue;
    if (inferMediaKind(typeof m.form === "string" ? m.form : null) !== "photo") continue;
    return ref;
  }
  return null;
}

export default function AdminIndividualEditPage() {
  const params = useParams();
  const id = typeof params.id === "string" ? params.id : "";
  const { data, isLoading, error } = useAdminIndividual(id);
  const ind = data?.individual as Record<string, unknown> | undefined;
  const [photoLoadFailed, setPhotoLoadFailed] = useState(false);

  const personLabel = ind ? individualEditPageLabel(ind) : "—";
  const photoUrl = useMemo(() => {
    if (!ind) return null;
    return firstIndividualPhotoUrl(
      ind.individualMedia as { media: Record<string, unknown> }[] | null | undefined,
    );
  }, [ind]);

  useEffect(() => {
    setPhotoLoadFailed(false);
  }, [id, photoUrl]);

  const backIndividuals = (
    <Link
      href="/admin/individuals"
      className={cn(buttonVariants({ variant: "ghost", size: "sm" }), "mb-2 inline-flex gap-1.5")}
    >
      <ArrowLeft className="size-4" />
      Back
    </Link>
  );

  if (!id) {
    return (
      <div>
        {backIndividuals}
        <p className="text-sm text-muted-foreground">Missing id.</p>
      </div>
    );
  }
  if (isLoading) {
    return (
      <div>
        {backIndividuals}
        <p className="text-sm text-muted-foreground">Loading…</p>
      </div>
    );
  }
  if (error || !ind) {
    return (
      <div>
        {backIndividuals}
        <p className="text-sm text-destructive">Could not load this person.</p>
      </div>
    );
  }

  const showPhoto = Boolean(photoUrl) && !photoLoadFailed;
  const initials = initialsFromPersonLabel(personLabel);

  return (
    <div className="space-y-6">
      <Link
        href={`/admin/individuals/${id}`}
        className={cn(buttonVariants({ variant: "ghost", size: "sm" }), "inline-flex gap-1.5")}
      >
        <ArrowLeft className="size-4" />
        Back
      </Link>
      <div>
        <div className="flex items-center gap-3 sm:gap-4">
          <div
            className={cn(
              "relative flex size-12 shrink-0 overflow-hidden rounded-full border border-border bg-muted sm:size-14",
              showPhoto ? "bg-background" : "",
            )}
          >
            {showPhoto ? (
              <img
                src={photoUrl!}
                alt=""
                className="size-full object-cover"
                onError={() => setPhotoLoadFailed(true)}
              />
            ) : (
              <span
                className="flex size-full items-center justify-center text-sm font-semibold tracking-tight text-muted-foreground sm:text-base"
                aria-hidden
              >
                {initials}
              </span>
            )}
          </div>
          <h1 className="min-w-0 text-2xl font-semibold tracking-tight">
            <span className="font-medium text-muted-foreground">Edit:</span>{" "}
            <span className="text-foreground">{personLabel}</span>
          </h1>
        </div>
        <p className="mt-2 text-muted-foreground">Update name, vital events, living flag, and family links.</p>
      </div>
      <IndividualEditForm key={id} mode="edit" individualId={id} initialIndividual={ind} />
    </div>
  );
}
