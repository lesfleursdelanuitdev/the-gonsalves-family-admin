"use client";

import { useCallback, useMemo, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { toast } from "sonner";
import { CircleHelp, Link2, Plus, RotateCcw, CheckCircle2, Archive, Unlink } from "lucide-react";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogFooter, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import {
  useOpenQuestionsByEntity,
  usePatchOpenQuestion,
  useAdminOpenQuestions,
} from "@/hooks/useAdminOpenQuestions";
import type { OpenQuestionEntityType } from "@/lib/admin/open-questions";
import { OpenQuestionStatusBadge } from "@/components/admin/OpenQuestionStatusBadge";
import { ApiError } from "@/lib/infra/api";

export function EntityOpenQuestionsSection({
  entityType,
  entityId,
  variant,
  /** When variant is edit, used for “Add question” pre-link and “Link existing”. */
  entityLabel,
}: {
  entityType: OpenQuestionEntityType;
  entityId: string;
  variant: "view" | "edit";
  entityLabel?: string;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const pageSearch = useSearchParams();
  const { data, isLoading, error, refetch } = useOpenQuestionsByEntity(entityType, entityId);
  const items = (data?.openQuestions ?? []) as Record<string, unknown>[];

  const patch = usePatchOpenQuestion();
  const [resolveOpen, setResolveOpen] = useState(false);
  const [resolveTargetId, setResolveTargetId] = useState<string | null>(null);
  const [resolutionDraft, setResolutionDraft] = useState("");

  const [linkOpen, setLinkOpen] = useState(false);
  const [linkSearch, setLinkSearch] = useState("");
  const { data: searchData } = useAdminOpenQuestions({
    status: "open",
    q: linkSearch.trim() || undefined,
    limit: 15,
    offset: 0,
  });
  const searchRows = (searchData?.openQuestions ?? []) as Record<string, unknown>[];

  const sorted = useMemo(() => {
    const rank = (s: string) => (s === "open" ? 0 : s === "resolved" ? 1 : 2);
    return [...items].sort(
      (a, b) =>
        rank(String(a.status ?? "")) - rank(String(b.status ?? "")) ||
        String(b.updatedAt ?? "").localeCompare(String(a.updatedAt ?? "")),
    );
  }, [items]);

  const newQuestionHref = useMemo(() => {
    const q = new URLSearchParams();
    if (entityType === "individual") q.set("individualId", entityId);
    if (entityType === "family") q.set("familyId", entityId);
    if (entityType === "event") q.set("eventId", entityId);
    if (entityType === "media") q.set("mediaId", entityId);
    if (entityLabel) q.set("label", entityLabel);
    const rtBase = pathname.startsWith("/admin/") ? pathname : "";
    if (rtBase) {
      const rtQs = pageSearch.toString();
      q.set("returnTo", rtQs ? `${rtBase}?${rtQs}` : rtBase);
    }
    return `/admin/open-questions/new?${q.toString()}`;
  }, [entityId, entityLabel, entityType, pageSearch, pathname]);

  const onMarkResolved = useCallback(() => {
    if (!resolveTargetId) return;
    patch.mutate(
      { id: resolveTargetId, body: { action: "resolve", resolution: resolutionDraft } },
      {
        onSuccess: () => {
          toast.success("Marked resolved.");
          setResolveOpen(false);
          setResolutionDraft("");
          setResolveTargetId(null);
          void refetch();
        },
        onError: (e) => {
          toast.error(e instanceof ApiError ? e.message : "Failed");
        },
      },
    );
  }, [patch, refetch, resolutionDraft, resolveTargetId]);

  const onUnlink = useCallback(
    (questionId: string) => {
      patch.mutate(
        { id: questionId, body: { unlink: { entityType, entityId } } },
        {
          onSuccess: () => {
            toast.success("Unlinked.");
            void refetch();
          },
          onError: (e) => {
            toast.error(e instanceof ApiError ? e.message : "Failed");
          },
        },
      );
    },
    [entityId, entityType, patch, refetch],
  );

  const onLinkExisting = useCallback(
    (questionId: string) => {
      patch.mutate(
        { id: questionId, body: { link: { entityType, entityId } } },
        {
          onSuccess: () => {
            toast.success("Linked.");
            setLinkOpen(false);
            setLinkSearch("");
            void refetch();
          },
          onError: (e) => {
            toast.error(e instanceof ApiError ? e.message : "Failed");
          },
        },
      );
    },
    [entityId, entityType, patch, refetch],
  );

  const onReopen = useCallback(
    (questionId: string) => {
      patch.mutate(
        { id: questionId, body: { action: "reopen" } },
        {
          onSuccess: () => {
            toast.success("Reopened.");
            void refetch();
          },
          onError: (e) => {
            toast.error(e instanceof ApiError ? e.message : "Failed");
          },
        },
      );
    },
    [patch, refetch],
  );

  const onArchive = useCallback(
    (questionId: string) => {
      patch.mutate(
        { id: questionId, body: { action: "archive" } },
        {
          onSuccess: () => {
            toast.success("Archived.");
            void refetch();
          },
          onError: (e) => {
            toast.error(e instanceof ApiError ? e.message : "Failed");
          },
        },
      );
    },
    [patch, refetch],
  );

  return (
    <Card className="border-base-content/10 bg-base-200/15 shadow-none">
      <CardHeader className="flex flex-row flex-wrap items-start justify-between gap-3 space-y-0 pb-2">
        <div className="flex min-w-0 items-start gap-2">
          <CircleHelp className="mt-0.5 size-5 shrink-0 text-primary" aria-hidden />
          <div className="min-w-0 space-y-1">
            <CardTitle className="text-lg">Open Questions</CardTitle>
            <p className="text-sm text-muted-foreground">
              Research and verification items linked to this record.
            </p>
          </div>
        </div>
        {variant === "edit" ? (
          <div className="flex flex-wrap gap-2">
            <Link href={newQuestionHref} className={cn(buttonVariants({ variant: "outline", size: "sm" }))}>
              <Plus className="size-3.5" aria-hidden />
              Add question
            </Link>
            <Button type="button" variant="outline" size="sm" onClick={() => setLinkOpen(true)}>
              <Link2 className="size-3.5" aria-hidden />
              Link existing question
            </Button>
          </div>
        ) : null}
      </CardHeader>
      <CardContent className="space-y-3">
        {isLoading ? <p className="text-sm text-muted-foreground">Loading…</p> : null}
        {error ? <p className="text-sm text-destructive">Could not load open questions.</p> : null}
        {!isLoading && !error && sorted.length === 0 ? (
          <div className="rounded-lg border border-dashed border-base-content/15 bg-base-content/[0.02] px-4 py-6 text-center text-sm text-muted-foreground">
            <p className="font-medium text-base-content">No open questions yet.</p>
            <p className="mt-1">
              Add a question to track something that needs research or verification.
            </p>
          </div>
        ) : null}
        <ul className="space-y-2">
          {sorted.map((oq) => {
            const id = String(oq.id ?? "");
            const qtext = String(oq.question ?? "");
            const st = String(oq.status ?? "open");
            const res = String(oq.resolution ?? "").trim();
            const resolvedAt = oq.resolvedAt as string | undefined;
            const isResolved = st === "resolved";
            const isArchived = st === "archived";
            return (
              <li
                key={id}
                className={cn(
                  "rounded-lg border px-3 py-2.5 text-sm",
                  isResolved || isArchived
                    ? "border-base-content/8 bg-base-content/[0.03]"
                    : "border-primary/20 bg-primary/[0.06]",
                )}
              >
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div className="min-w-0 flex-1 space-y-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <OpenQuestionStatusBadge status={st} />
                      <Link href={`/admin/open-questions/${id}/edit`} className="link link-primary font-medium">
                        {qtext || "—"}
                      </Link>
                    </div>
                    {res ? (
                      <p className={cn("text-xs", isResolved ? "text-base-content/70" : "text-muted-foreground")}>
                        <span className="font-medium text-base-content/80">Resolution:</span> {res}
                      </p>
                    ) : null}
                    {resolvedAt ? (
                      <p className="text-[11px] text-muted-foreground">
                        Resolved {new Date(resolvedAt).toLocaleString()}
                      </p>
                    ) : null}
                  </div>
                  <div className="flex shrink-0 flex-wrap justify-end gap-1">
                    {variant === "edit" ? (
                      <>
                        {st === "open" ? (
                          <Button
                            type="button"
                            variant="outline"
                            size="xs"
                            className="h-7 gap-1"
                            onClick={() => {
                              setResolveTargetId(id);
                              setResolutionDraft("");
                              setResolveOpen(true);
                            }}
                          >
                            <CheckCircle2 className="size-3" aria-hidden />
                            Mark resolved
                          </Button>
                        ) : null}
                        {st === "resolved" ? (
                          <Button
                            type="button"
                            variant="outline"
                            size="xs"
                            className="h-7 gap-1"
                            onClick={() => onReopen(id)}
                          >
                            <RotateCcw className="size-3" aria-hidden />
                            Reopen
                          </Button>
                        ) : null}
                        {st !== "archived" ? (
                          <Button
                            type="button"
                            variant="outline"
                            size="xs"
                            className="h-7 gap-1"
                            onClick={() => onArchive(id)}
                          >
                            <Archive className="size-3" aria-hidden />
                            Archive
                          </Button>
                        ) : null}
                        <Button
                          type="button"
                          variant="ghost"
                          size="xs"
                          className="h-7 gap-1 text-muted-foreground"
                          onClick={() => {
                            if (!window.confirm("Unlink this question from this record?")) return;
                            onUnlink(id);
                          }}
                        >
                          <Unlink className="size-3" aria-hidden />
                          Unlink
                        </Button>
                      </>
                    ) : (
                      <Button
                        type="button"
                        variant="ghost"
                        size="xs"
                        className="h-7"
                        onClick={() => router.push(`/admin/open-questions/${id}/edit`)}
                      >
                        View
                      </Button>
                    )}
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      </CardContent>

      <Dialog open={resolveOpen} onOpenChange={setResolveOpen}>
        <DialogContent className="sm:max-w-md">
          <div className="space-y-2 pb-2">
            <DialogTitle>Mark resolved</DialogTitle>
          </div>
          <div className="space-y-2 py-2">
            <Label htmlFor="oq-res-draft">Resolution</Label>
            <textarea
              id="oq-res-draft"
              value={resolutionDraft}
              onChange={(e) => setResolutionDraft(e.target.value)}
              rows={4}
              placeholder="How was this resolved?"
              className="textarea textarea-bordered w-full min-h-[5.5rem] resize-y text-sm"
            />
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setResolveOpen(false)}>
              Cancel
            </Button>
            <Button type="button" className="btn-primary" disabled={patch.isPending} onClick={() => onMarkResolved()}>
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={linkOpen} onOpenChange={setLinkOpen}>
        <DialogContent className="sm:max-w-lg">
          <div className="space-y-2 pb-2">
            <DialogTitle>Link existing question</DialogTitle>
          </div>
          <div className="space-y-2 py-2">
            <Label htmlFor="oq-link-search">Search open questions</Label>
            <Input
              id="oq-link-search"
              value={linkSearch}
              onChange={(e) => setLinkSearch(e.target.value)}
              placeholder="Keyword in question or details"
            />
            <ul className="max-h-64 space-y-1 overflow-y-auto rounded-md border border-base-content/10 p-2 text-sm">
              {searchRows.map((row) => {
                const rid = String(row.id ?? "");
                const already = items.some((x) => String(x.id) === rid);
                return (
                  <li key={rid} className="flex items-center justify-between gap-2 rounded px-1 py-1 hover:bg-base-content/[0.04]">
                    <span className="min-w-0 truncate">{String(row.question ?? rid)}</span>
                    <Button
                      type="button"
                      size="xs"
                      variant="outline"
                      disabled={already || patch.isPending}
                      onClick={() => onLinkExisting(rid)}
                    >
                      {already ? "Linked" : "Link"}
                    </Button>
                  </li>
                );
              })}
              {searchRows.length === 0 ? (
                <li className="px-2 py-4 text-center text-muted-foreground">No matches.</li>
              ) : null}
            </ul>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setLinkOpen(false)}>
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
