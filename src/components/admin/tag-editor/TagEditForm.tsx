"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import { ChevronDown, FileText, Image as ImageIcon, Trash2 } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";
import { ArrowLeft } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { PersonEditorMobileFormHeader } from "@/components/admin/individual-editor/PersonEditorMobileFormHeader";
import { useMediaQueryMinLg } from "@/hooks/useMediaQueryMinLg";
import { EntityGedcomProfileMediaSection, type ProfileMediaSelectionShape } from "@/components/admin/EntityGedcomProfileMediaSection";
import { TagEditorFormActions } from "@/components/admin/tag-editor/TagEditorFormActions";
import { postJson } from "@/lib/infra/api";
import { ApiError } from "@/lib/infra/api";
import {
  useTagDetail,
  useDeleteTag,
  useUpdateTag,
  type AdminTagDetailResponse,
} from "@/hooks/useAdminTags";
import { displayTagName } from "@/lib/admin/display-tag-name";

type TagMobileSectionKey = "tag-cover" | "tag-details" | "tag-danger";

function TagMobileSectionToggle({
  isDesktop,
  sectionKey,
  mobileExpanded,
  onToggle,
  icon: Icon,
  title,
  summary,
}: {
  isDesktop: boolean;
  sectionKey: TagMobileSectionKey;
  mobileExpanded: TagMobileSectionKey | null;
  onToggle: (key: TagMobileSectionKey) => void;
  icon: LucideIcon;
  title: string;
  summary: string;
}) {
  if (isDesktop) return null;
  const expanded = mobileExpanded === sectionKey;
  return (
    <button
      type="button"
      className="flex w-full items-start gap-3 rounded-xl border border-base-content/10 bg-card/80 px-4 py-3 text-left shadow-sm"
      aria-expanded={expanded}
      onClick={() => onToggle(sectionKey)}
    >
      <span className="mt-0.5 flex size-10 shrink-0 items-center justify-center rounded-lg bg-primary/15 text-primary">
        <Icon className="size-5" aria-hidden />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-base font-semibold text-foreground">{title}</span>
        <span className="mt-0.5 block text-sm text-muted-foreground">{summary}</span>
      </span>
      <ChevronDown
        className={cn("mt-1 size-5 shrink-0 text-muted-foreground transition-transform", expanded && "rotate-180")}
      />
    </button>
  );
}

function TagSectionHeader({
  icon: Icon,
  title,
  description,
}: {
  icon: LucideIcon;
  title: string;
  description: string;
}) {
  return (
    <div className="mb-4 flex items-start gap-3">
      <span className="flex size-12 shrink-0 items-center justify-center rounded-xl bg-primary/15 text-primary">
        <Icon className="size-6" aria-hidden />
      </span>
      <div>
        <h2 className="text-base font-semibold">{title}</h2>
        <p className="text-sm text-muted-foreground">{description}</p>
      </div>
    </div>
  );
}

export type TagEditFormProps = {
  hideBackLink?: boolean;
  contextReturnHref?: string;
} & ({ mode: "create" } | { mode: "edit"; tagId: string });

export function TagEditForm(props: TagEditFormProps) {
  const router = useRouter();
  const qc = useQueryClient();
  const isDesktop = useMediaQueryMinLg();
  const mode = props.mode;
  const tagId = mode === "edit" ? props.tagId : "";
  const hideBackLink = props.hideBackLink ?? false;
  const backHref = props.contextReturnHref ?? "/admin/tags";
  const formId = "tag-edit-form";

  const { data, isLoading, error, refetch } = useTagDetail(tagId);
  const deleteTag = useDeleteTag();
  const updateTag = useUpdateTag();

  const [name, setName] = useState("");
  const [color, setColor] = useState("");
  const [description, setDescription] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [mobileExpanded, setMobileExpanded] = useState<TagMobileSectionKey | null>("tag-cover");

  const detail = data as AdminTagDetailResponse | undefined;
  const canEdit = mode === "create" ? true : Boolean(detail?.tag.canEdit);
  const profileSelection = (detail?.profileMediaSelection ?? null) as ProfileMediaSelectionShape;

  useEffect(() => {
    if (mode !== "edit" || !detail?.tag) return;
    setName(detail.tag.name);
    setColor(detail.tag.color ?? "");
    setDescription(detail.tag.description ?? "");
  }, [mode, detail?.tag]);

  const onMobileToggle = useCallback((key: TagMobileSectionKey) => {
    setMobileExpanded((prev) => (prev === key ? null : key));
  }, []);

  const coverSummary = useMemo(() => {
    const m = profileSelection?.media;
    const t = m && typeof m.title === "string" ? m.title.trim() : "";
    if (t) return t;
    const id = m && typeof m.id === "string" ? m.id.trim() : "";
    if (id) return id.slice(0, 12) + "…";
    return "No cover image";
  }, [profileSelection]);

  const titleSummary = useMemo(() => {
    const n = name.trim();
    return n ? displayTagName(n) : "Untitled";
  }, [name]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const n = name.trim();
    if (!n) {
      toast.error("Name is required.");
      return;
    }
    setSubmitting(true);
    try {
      if (mode === "create") {
        const res = await postJson<{ tag: { id: string } }>("/api/admin/tags", {
          name: n,
          ...(color.trim() ? { color: color.trim().slice(0, 7) } : {}),
          ...(description.trim() ? { description: description.trim() } : {}),
        });
        await qc.invalidateQueries({ queryKey: ["admin", "tags"] });
        toast.success("Tag created.");
        router.push(`/admin/tags/${res.tag.id}/edit`);
        return;
      }
      await updateTag.mutateAsync({
        id: tagId,
        name: n,
        color: color.trim() ? color.trim().slice(0, 7) : null,
        description: description.trim() ? description.trim() : null,
      });
      await qc.invalidateQueries({ queryKey: ["admin", "tags", "detail", tagId] });
      toast.success("Tag saved.");
      void refetch();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : err instanceof Error ? err.message : "Could not save.");
    } finally {
      setSubmitting(false);
    }
  };

  const onDelete = async () => {
    if (mode !== "edit" || !detail?.tag.canDelete) return;
    const label = displayTagName(detail.tag.name);
    if (!window.confirm(`Delete tag “${label}”? This cannot be undone.`)) return;
    try {
      await deleteTag.mutateAsync(tagId);
      toast.success(`Deleted “${label}”.`);
      router.push("/admin/tags");
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Could not delete tag.");
    }
  };

  if (mode === "edit" && isLoading) {
    return <p className="text-sm text-muted-foreground">Loading…</p>;
  }
  if (mode === "edit" && (error || !detail?.tag)) {
    return <p className="text-sm text-destructive">Could not load this tag.</p>;
  }

  return (
    <div className="w-full space-y-6">
      {!hideBackLink ? (
        <Link
          href={backHref}
          className={cn(buttonVariants({ variant: "ghost", size: "sm" }), "inline-flex gap-1.5")}
        >
          <ArrowLeft className="size-4" />
          Tags
        </Link>
      ) : null}

      {hideBackLink ? (
        <>
          {isDesktop ? (
            <header className="flex flex-wrap items-start justify-between gap-4 border-b border-base-content/10 pb-5">
              <div className="space-y-1">
                <Link
                  href={backHref}
                  className={cn(buttonVariants({ variant: "ghost", size: "sm" }), "mb-1 inline-flex gap-1.5 px-0")}
                >
                  <ArrowLeft className="size-4" aria-hidden />
                  Tags
                </Link>
                <h1 className="text-2xl font-semibold tracking-tight">{mode === "create" ? "New tag" : "Edit tag"}</h1>
                <p className="text-muted-foreground">
                  {mode === "create"
                    ? "Create a label for organizing tree media. You can add a cover image after the tag is saved."
                    : "Set the tag name, optional description, and cover image for album views."}
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <Link href={backHref} className={cn(buttonVariants({ variant: "outline" }))}>
                  Cancel
                </Link>
                <button
                  type="submit"
                  form={formId}
                  className={cn(buttonVariants())}
                  disabled={submitting || !canEdit}
                >
                  {submitting ? "Saving…" : mode === "create" ? "Create tag" : "Save tag"}
                </button>
              </div>
            </header>
          ) : (
            <div className="space-y-3">
              <PersonEditorMobileFormHeader
                title={mode === "create" ? "New tag" : "Edit tag"}
                backHref={backHref}
                treeHref="/admin/tags"
              />
              <p className="text-sm text-muted-foreground">
                {mode === "create"
                  ? "Create a label for organizing tree media."
                  : "Set the tag name, optional description, and cover image for album views."}
              </p>
            </div>
          )}
        </>
      ) : null}

      {mode === "edit" && !canEdit ? (
        <p className="text-sm text-destructive" role="alert">
          You do not have permission to edit this tag.
        </p>
      ) : null}

      <form id={formId} onSubmit={(e) => void handleSubmit(e)} className="w-full space-y-6">
        <TagMobileSectionToggle
          isDesktop={isDesktop}
          sectionKey="tag-cover"
          mobileExpanded={mobileExpanded}
          onToggle={onMobileToggle}
          icon={ImageIcon}
          title="Cover image"
          summary={coverSummary}
        />
        <section
          className={cn(
            "rounded-xl border border-base-content/10 bg-card/60 p-4 shadow-sm sm:p-6",
            !isDesktop && mobileExpanded !== "tag-cover" && "hidden",
          )}
        >
          {isDesktop ? (
            <TagSectionHeader
              icon={ImageIcon}
              title="Cover image"
              description="Used as the default album cover for tagged media when one is set. Otherwise a random item from the set is used."
            />
          ) : null}
          {mode === "create" ? (
            <p className="text-sm text-muted-foreground">
              Save the tag first, then you can pick a photo from the family tree archive as the cover.
            </p>
          ) : (
            <EntityGedcomProfileMediaSection
              entity="tag"
              entityId={tagId}
              heading="Cover image"
              profileMediaSelection={profileSelection}
              invalidateQueryKeys={[["admin", "tags", "detail", tagId]]}
              enabled={canEdit}
              emptyHint="No cover image set."
              chooseTriggerLabel="Choose cover image"
            />
          )}
        </section>

        <TagMobileSectionToggle
          isDesktop={isDesktop}
          sectionKey="tag-details"
          mobileExpanded={mobileExpanded}
          onToggle={onMobileToggle}
          icon={FileText}
          title="Title & description"
          summary={titleSummary}
        />
        <section
          className={cn(
            "rounded-xl border border-base-content/10 bg-card/60 p-4 shadow-sm sm:p-6",
            !isDesktop && mobileExpanded !== "tag-details" && "hidden",
          )}
        >
          {isDesktop ? (
            <TagSectionHeader
              icon={FileText}
              title="Title & description"
              description="Name shown in pickers and filters; optional color and longer notes."
            />
          ) : null}
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="tag-name">Name</Label>
              <Input
                id="tag-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Cemetery"
                autoComplete="off"
                disabled={!canEdit}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="tag-color">Color (optional)</Label>
              <Input
                id="tag-color"
                value={color}
                onChange={(e) => setColor(e.target.value)}
                placeholder="#3b82f6"
                className="font-mono text-sm"
                autoComplete="off"
                disabled={!canEdit}
              />
              <p className="text-xs text-muted-foreground">Hex color, up to 7 characters including #.</p>
            </div>
            <div className="space-y-2 md:col-span-2">
              <Label htmlFor="tag-description">Description (optional)</Label>
              <textarea
                id="tag-description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={4}
                disabled={!canEdit}
                className="flex min-h-[100px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                placeholder="Internal notes about how to use this tag…"
              />
            </div>
          </div>
        </section>

        {mode === "edit" && detail?.tag.canDelete ? (
          <>
            <TagMobileSectionToggle
              isDesktop={isDesktop}
              sectionKey="tag-danger"
              mobileExpanded={mobileExpanded}
              onToggle={onMobileToggle}
              icon={Trash2}
              title="Danger zone"
              summary="Delete this tag permanently"
            />
            <section
              className={cn(
                "rounded-xl border border-destructive/25 bg-destructive/[0.04] p-4 shadow-sm sm:p-6",
                !isDesktop && mobileExpanded !== "tag-danger" && "hidden",
              )}
            >
              {isDesktop ? (
                <TagSectionHeader
                  icon={Trash2}
                  title="Danger zone"
                  description="Deleting removes the tag and all links to media and other items."
                />
              ) : null}
              <button
                type="button"
                className={cn(buttonVariants({ variant: "destructive" }), "min-h-10")}
                onClick={() => void onDelete()}
                disabled={deleteTag.isPending}
              >
                {deleteTag.isPending ? "Deleting…" : "Delete tag"}
              </button>
            </section>
          </>
        ) : null}
      </form>

      <TagEditorFormActions mode={mode} backHref={backHref} submitting={submitting} />
    </div>
  );
}
