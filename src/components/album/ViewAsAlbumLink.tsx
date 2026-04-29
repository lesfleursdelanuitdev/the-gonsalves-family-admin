"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Images } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type EntityType = "individual" | "family" | "event" | "place" | "note" | "date" | "tag";

/**
 * Opens a **media set** view for a GEDCOM entity (`/admin/media/album-view`, album-style layout).
 * Pass **`count`** when the parent already knows membership size, or **`includeCount`** to fetch a cheap total first.
 */
export function ViewAsAlbumLink({
  entityType,
  entityId,
  className,
  label = "View media",
  count: countProp,
  includeCount = false,
}: {
  entityType: EntityType;
  entityId: string;
  className?: string;
  /** Button text; action-oriented (“View … media”), not “album”. */
  label?: string;
  /** When set (including `0`), shown as a badge so users know how dense the set is before opening. */
  count?: number;
  /** When `count` is omitted, fetch `/api/admin/media-set-count` once (lightweight). */
  includeCount?: boolean;
}) {
  const [fetchedCount, setFetchedCount] = useState<number | null>(null);
  const [fetchError, setFetchError] = useState(false);

  useEffect(() => {
    if (countProp !== undefined || !includeCount || !entityId) return;
    let cancelled = false;
    setFetchedCount(null);
    setFetchError(false);
    void (async () => {
      try {
        const res = await fetch(
          `/api/admin/media-set-count?type=${encodeURIComponent(entityType)}&id=${encodeURIComponent(entityId)}`,
        );
        const body = (await res.json()) as { count?: number; error?: string };
        if (!res.ok) throw new Error(body.error ?? "count failed");
        if (!cancelled) setFetchedCount(typeof body.count === "number" ? body.count : 0);
      } catch {
        if (!cancelled) {
          setFetchError(true);
          setFetchedCount(null);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [entityType, entityId, countProp, includeCount]);

  const href = `/admin/media/album-view?type=${encodeURIComponent(entityType)}&id=${encodeURIComponent(entityId)}`;
  const badgeLoading =
    includeCount && countProp === undefined && fetchedCount === null && !fetchError;
  const showBadge =
    countProp !== undefined ||
    (includeCount && !fetchError && (fetchedCount !== null || badgeLoading));

  const resolvedCount = countProp !== undefined ? countProp : fetchedCount;
  const aria =
    resolvedCount !== null && resolvedCount !== undefined && !badgeLoading
      ? `${label} (${resolvedCount} item${resolvedCount === 1 ? "" : "s"})`
      : badgeLoading
        ? `${label} (loading count)`
        : label;

  return (
    <Link
      href={href}
      aria-label={aria}
      className={cn(
        buttonVariants({ variant: "outline", size: "sm" }),
        "inline-flex max-w-full shrink-0 items-center gap-1.5",
        className,
      )}
    >
      <Images className="size-3.5 shrink-0" aria-hidden />
      <span className="min-w-0 truncate">{label}</span>
      {showBadge ? (
        <span
          className={cn(
            "shrink-0 rounded-full border border-base-content/15 bg-base-content/[0.06] px-1.5 py-0.5 text-[0.6875rem] font-medium tabular-nums leading-none text-muted-foreground",
            resolvedCount === 0 && !badgeLoading && "opacity-80",
          )}
          aria-hidden
        >
          {countProp !== undefined ? countProp : badgeLoading ? "…" : (fetchedCount ?? "—")}
        </span>
      ) : null}
    </Link>
  );
}
