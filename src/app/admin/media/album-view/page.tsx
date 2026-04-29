"use client";

import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { toast } from "sonner";
import type { AlbumViewModel } from "@ligneous/album-view";
import { AlbumView } from "@/components/album/AlbumView";
import { NoteEditorPageLayout } from "@/components/admin/NoteEditorPageLayout";
import Link from "next/link";
import { buttonVariants } from "@/components/ui/button";
import { ApiError, fetchJson } from "@/lib/infra/api";
import { cn } from "@/lib/utils";

function GeneratedAlbumViewInner() {
  const sp = useSearchParams();
  const type = (sp.get("type") ?? "").trim().toLowerCase();
  const id = (sp.get("id") ?? "").trim();

  const [model, setModel] = useState<AlbumViewModel | null>(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    if (!type || !id) {
      setLoading(false);
      setErr("Missing type or id query parameter.");
      setModel(null);
      return;
    }
    let cancelled = false;
    void (async () => {
      setLoading(true);
      setErr(null);
      try {
        const res = await fetchJson<{ model: AlbumViewModel }>(
          `/api/admin/album-view?kind=generated&type=${encodeURIComponent(type)}&id=${encodeURIComponent(id)}`,
        );
        if (!cancelled) setModel(res.model);
      } catch (e) {
        if (!cancelled) {
          setErr(e instanceof ApiError ? e.message : "Could not load album view.");
          setModel(null);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [type, id]);

  useEffect(() => {
    if (err) toast.error(err);
  }, [err]);

  if (!type || !id) {
    return (
      <p className="text-sm text-muted-foreground">
        Use <span className="font-mono">?type=individual&amp;id=…</span> (family, event, place, note, date, tag).
      </p>
    );
  }

  if (loading) {
    return <p className="text-sm text-muted-foreground">Loading…</p>;
  }
  if (err || !model) {
    return <p className="text-sm text-destructive">{err ?? "Not found."}</p>;
  }

  const backHint =
    model.source.type === "individual"
      ? `/admin/individuals/${model.source.individualId}`
      : model.source.type === "family"
        ? `/admin/families/${model.source.familyId}`
        : model.source.type === "event"
          ? `/admin/events/${model.source.eventId}`
          : model.source.type === "place"
            ? `/admin/places/${model.source.placeId}`
            : model.source.type === "note"
              ? `/admin/notes/${model.source.noteId}`
              : model.source.type === "date"
                ? `/admin/dates/${model.source.dateId}`
                : model.source.type === "tag"
                  ? "/admin/tags"
                  : "/admin/media";

  const backButtonLabel =
    model.source.type === "tag"
      ? "Back to tags"
      : model.source.type === "place"
        ? "Back to place"
        : model.source.type === "date"
          ? "Back to date"
          : model.source.type === "note"
            ? "Back to note"
            : "Open record";

  return (
    <AlbumView
      model={model}
      trailingToolbar={
        <Link
          href={backHint}
          className={cn(buttonVariants({ variant: "outline", size: "sm" }), "inline-flex shrink-0")}
        >
          {backButtonLabel}
        </Link>
      }
    />
  );
}

export default function AdminMediaAlbumViewPage() {
  return (
    <NoteEditorPageLayout backHref="/admin/media" backLabel="Media" fullWidth>
      <Suspense fallback={<p className="text-sm text-muted-foreground">Loading…</p>}>
        <GeneratedAlbumViewInner />
      </Suspense>
    </NoteEditorPageLayout>
  );
}
