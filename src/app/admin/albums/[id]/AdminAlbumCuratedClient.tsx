"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { toast } from "sonner";
import type { AlbumViewModel } from "@ligneous/album-view";
import { AlbumView } from "@/components/album/AlbumView";
import { buttonVariants } from "@/components/ui/button";
import { ApiError, fetchJson } from "@/lib/infra/api";
import { cn } from "@/lib/utils";

export function AdminAlbumCuratedClient({ albumId }: { albumId: string }) {
  const [model, setModel] = useState<AlbumViewModel | null>(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      setLoading(true);
      setErr(null);
      try {
        const res = await fetchJson<{ model: AlbumViewModel }>(
          `/api/admin/album-view?kind=curated&albumId=${encodeURIComponent(albumId)}`,
        );
        if (!cancelled) setModel(res.model);
      } catch (e) {
        if (!cancelled) {
          setErr(e instanceof ApiError ? e.message : "Could not load album.");
          setModel(null);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [albumId]);

  useEffect(() => {
    if (err) toast.error(err);
  }, [err]);

  if (loading) {
    return <p className="text-sm text-muted-foreground">Loading…</p>;
  }
  if (err || !model) {
    return (
      <div className="space-y-4">
        <p className="text-sm text-destructive">{err ?? "Album not found."}</p>
        <Link href="/admin/albums" className={cn(buttonVariants({ variant: "outline" }), "inline-flex w-fit")}>
          Back to albums
        </Link>
      </div>
    );
  }

  return <AlbumView model={model} />;
}
