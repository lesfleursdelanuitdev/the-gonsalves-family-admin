"use client";

import { useCallback, useMemo, useRef, useState, type ComponentType } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  FileImage,
  FileText,
  Film,
  Headphones,
  Images,
  Link2,
  Loader2,
  MoreVertical,
  Pencil,
  Eye,
  Tag,
  Trash2,
  Upload,
} from "lucide-react";
import {
  isLikelyAudioFile,
  isLikelyRasterImage,
  isLikelyVideoFile,
  isPlayableAudioRef,
  isPlayableVideoRef,
  resolveMediaImageSrc,
} from "@/lib/admin/mediaPreview";
import { inferAdminMediaCategory, type AdminMediaCategory } from "@/lib/admin/infer-admin-media-category";
import { MediaRasterImage } from "@/components/admin/MediaRasterImage";
import { DataViewer, type DataViewerConfig } from "@/components/data-viewer";
import { FilterPanel } from "@/components/data-viewer/FilterPanel";
import { selectClassName } from "@/components/data-viewer/constants";
import { adminMediaUploadMaxMbForUi } from "@/constants/admin";
import { Card, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  ADMIN_MEDIA_QUERY_KEY,
  useAdminMedia,
  useCreateMedia,
  useDeleteMedia,
  type AdminMediaListResponse,
} from "@/hooks/useAdminMedia";
import { useAdminMediaPageFilters } from "@/hooks/useAdminMediaPageFilters";
import { stripSlashesFromName } from "@/lib/gedcom/display-name";
import { labelGedcomEventType } from "@/lib/gedcom/gedcom-event-labels";
import { titleFromUploadedFilename } from "@/lib/admin/media-upload-title";
import { fetchJson, ApiError, postFormDataWithUploadProgress } from "@/lib/infra/api";
import { MediaUploadProgressInline } from "@/components/admin/MediaUploadProgressInline";
import type { MediaEditorUploadProgressState } from "@/hooks/useMediaEditorUploadAndMeta";
import { cn } from "@/lib/utils";

/* ── Types ─────────────────────────────────────────────────────────────── */

interface MediaRow {
  id: string;
  title: string;
  description: string;
  mediaType: AdminMediaCategory;
  filename: string;
  form: string;
  linkedTo: string;
  /** Number of individuals/families/events linked */
  linkedCount: number;
  /** Number of albums this media belongs to */
  albumCount: number;
  /** Number of tags */
  tagCount: number;
}

const mediaTypeIcon: Record<MediaRow["mediaType"], ComponentType<{ className?: string }>> = {
  photo: FileImage,
  document: FileText,
  video: Film,
  audio: Headphones,
};

const mediaTypeBadge: Record<
  MediaRow["mediaType"],
  { label: string; className: string }
> = {
  photo:    { label: "Photo",    className: "bg-success/15 text-success" },
  document: { label: "Document", className: "bg-warning/15 text-warning" },
  video:    { label: "Video",    className: "bg-info/15 text-info" },
  audio:    { label: "Audio",    className: "bg-secondary/20 text-secondary" },
};

interface AdminSetupPayload {
  configured: boolean;
  message?: string;
  gedcomFile?: { id: string; fileId: string; name: string | null } | null;
  gedcomMediaCount?: number;
}

function mapApiToRows(api: AdminMediaListResponse): MediaRow[] {
  return (api?.media ?? []).map((m) => {
    const mediaType = inferAdminMediaCategory(m.form, m.fileRef);

    const parts: string[] = [];
    m.individualMedia?.forEach((im) => {
      const n = stripSlashesFromName(im.individual?.fullName);
      if (n) parts.push(n);
    });
    m.familyMedia?.forEach((fm) => {
      const h = stripSlashesFromName(fm.family?.husband?.fullName);
      const w = stripSlashesFromName(fm.family?.wife?.fullName);
      if (h || w) parts.push(`${h} & ${w}`.replace(/^ & | & $/g, "").trim() || "Family");
    });
    m.sourceMedia?.forEach((sm) => {
      const t = sm.source?.title ?? sm.source?.xref;
      if (t) parts.push(t);
    });
    m.eventMedia?.forEach((em) => {
      const et = em.event?.eventType;
      if (et) {
        const base = labelGedcomEventType(et);
        const label =
          et.toUpperCase() === "EVEN" && em.event?.customType?.trim()
            ? em.event.customType.trim()
            : base;
        parts.push(`Event: ${label}`);
      }
    });

    const linkedCount =
      (m.individualMedia?.length ?? 0) +
      (m.familyMedia?.length ?? 0) +
      (m.eventMedia?.length ?? 0) +
      (m.sourceMedia?.length ?? 0);

    return {
      id: m.id,
      title: m.title ?? "—",
      description: (m.description ?? "").trim(),
      mediaType,
      filename: m.fileRef ?? "—",
      form: m.form ?? "",
      linkedTo: parts.length ? parts.join("; ") : "—",
      linkedCount,
      albumCount: m.albumLinks?.length ?? 0,
      tagCount: m.appTags?.length ?? 0,
    };
  });
}

/* ── MediaTypeBadge ─────────────────────────────────────────────────────── */

function MediaTypeBadge({ mediaType }: { mediaType: MediaRow["mediaType"] }) {
  const { label, className } = mediaTypeBadge[mediaType];
  return (
    <span className={cn("inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold leading-tight", className)}>
      <span className="size-1.5 rounded-full bg-current shrink-0" aria-hidden />
      {label}
    </span>
  );
}

/* ── MediaCardItem ──────────────────────────────────────────────────────── */
// Extracted as a component so it can hold its own menu state.

function MediaCardItem({
  record,
  onView,
  onEdit,
  onDelete,
}: {
  record: MediaRow;
  onView?: () => void;
  onEdit?: () => void;
  onDelete?: () => void;
}) {
  const Icon = mediaTypeIcon[record.mediaType];
  const fileRefRaw = record.filename.trim() === "—" ? "" : record.filename;
  const thumbSrc =
    fileRefRaw && isLikelyRasterImage(fileRefRaw, record.form, null)
      ? resolveMediaImageSrc(fileRefRaw)
      : null;
  const resolvedRef = fileRefRaw ? resolveMediaImageSrc(fileRefRaw) : null;
  const videoCardSrc =
    fileRefRaw &&
    !thumbSrc &&
    resolvedRef &&
    isLikelyVideoFile(fileRefRaw, record.form) &&
    isPlayableVideoRef(fileRefRaw)
      ? resolvedRef
      : null;
  const audioCardSrc =
    fileRefRaw &&
    !thumbSrc &&
    !videoCardSrc &&
    resolvedRef &&
    isLikelyAudioFile(fileRefRaw, record.form) &&
    isPlayableAudioRef(fileRefRaw)
      ? resolvedRef
      : null;
  const titleDisplay = record.title.trim() && record.title !== "—" ? record.title : "Untitled";

  return (
    <Card className="group h-full min-h-0 overflow-hidden border-base-content/12 pt-0 shadow-sm shadow-black/10 transition-shadow hover:shadow-md hover:shadow-black/15">
      {/* Thumbnail */}
      <div className="relative aspect-[4/3] w-full shrink-0 border-b border-base-content/10 bg-gradient-to-b from-base-200/70 to-base-300/35">
        {thumbSrc ? (
          <MediaRasterImage
            key={thumbSrc + record.id}
            fileRef={fileRefRaw}
            form={record.form}
            src={thumbSrc}
            alt={titleDisplay}
            fill
            sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 25vw"
            className="object-contain p-2"
          />
        ) : videoCardSrc ? (
          <video
            key={videoCardSrc + record.id}
            src={videoCardSrc}
            muted
            playsInline
            preload="metadata"
            className="pointer-events-none absolute inset-0 h-full w-full object-contain p-2"
            aria-hidden
          />
        ) : audioCardSrc ? (
          <div className="absolute inset-0 flex items-end justify-center bg-base-200/40 p-3 pb-4" onClick={(e) => e.stopPropagation()}>
            <audio
              key={audioCardSrc + record.id}
              src={audioCardSrc}
              controls
              className="h-9 w-full max-w-[min(100%,18rem)]"
              preload="metadata"
              onClick={(e) => e.stopPropagation()}
            />
          </div>
        ) : (
          <div className="flex h-full min-h-[7rem] flex-col items-center justify-center gap-2 px-4 py-6 text-center">
            <Icon className="size-11 shrink-0 text-muted-foreground/55" aria-hidden />
            <span className="line-clamp-2 max-w-full text-xs font-medium leading-snug text-base-content/80">
              {titleDisplay}
            </span>
          </div>
        )}

        {/* Hover overlay — visible on pointer devices, hidden on touch */}
        <div className="absolute inset-0 flex items-center justify-center gap-2 bg-black/50 opacity-0 transition-opacity group-hover:opacity-100 [@media(hover:none)]:hidden">
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onView?.();
            }}
            className="flex items-center gap-1.5 rounded-md border border-white/25 bg-white/15 px-3 py-1.5 text-xs font-semibold text-white backdrop-blur-sm transition hover:bg-white/25"
          >
            <Eye className="size-3.5" aria-hidden /> View
          </button>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onEdit?.();
            }}
            className="flex items-center gap-1.5 rounded-md border border-white/25 bg-white/15 px-3 py-1.5 text-xs font-semibold text-white backdrop-blur-sm transition hover:bg-white/25"
          >
            <Pencil className="size-3.5" aria-hidden /> Edit
          </button>
        </div>

        {/* ⋯ dropdown — touch devices only, always visible */}
        <div className="absolute right-1.5 top-1.5 hidden [@media(hover:none)]:block" onClick={(e) => e.stopPropagation()}>
          <DropdownMenu>
            <DropdownMenuTrigger
              className="flex size-8 items-center justify-center rounded-md border border-white/20 bg-black/50 text-white backdrop-blur-sm"
              aria-label="Card actions"
            >
              <MoreVertical className="size-4" aria-hidden />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => onView?.()}>
                <Eye className="size-4 opacity-70" aria-hidden /> View
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => onEdit?.()}>
                <Pencil className="size-4 opacity-70" aria-hidden /> Edit
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem variant="destructive" onClick={() => onDelete?.()}>
                <Trash2 className="size-4" aria-hidden /> Delete
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {/* Card body — flex-1 so footer stays at bottom of the card */}
      <CardHeader className="min-h-0 flex-1 space-y-1.5 pb-2 pt-3">
        <div className="flex items-start justify-between gap-2">
          <CardTitle className="line-clamp-2 min-w-0 text-sm leading-snug">{record.title}</CardTitle>
          <MediaTypeBadge mediaType={record.mediaType} />
        </div>
        {record.description ? (
          <p className="line-clamp-1 text-xs leading-snug text-muted-foreground">{record.description}</p>
        ) : null}
      </CardHeader>

      {/* Footer: links · albums · tags */}
      <div className="mt-auto flex shrink-0 flex-wrap items-center gap-x-3 gap-y-1 border-t border-base-content/[0.07] px-4 py-2 text-[11px] text-muted-foreground">
        {record.linkedCount > 0 ? (
          <span className="inline-flex items-center gap-1">
            <Link2 className="size-3 shrink-0 opacity-70" aria-hidden />
            {record.linkedCount} {record.linkedCount === 1 ? "link" : "links"}
          </span>
        ) : (
          <span className="inline-flex items-center gap-1 text-base-content/35">
            <Link2 className="size-3 shrink-0 opacity-50" aria-hidden />
            No links
          </span>
        )}
        {record.albumCount > 0 && (
          <span className="inline-flex items-center gap-1">
            <Images className="size-3 shrink-0 opacity-70" aria-hidden />
            {record.albumCount} {record.albumCount === 1 ? "album" : "albums"}
          </span>
        )}
        {record.tagCount > 0 && (
          <span className="ml-auto inline-flex items-center gap-1">
            <Tag className="size-3 shrink-0 opacity-70" aria-hidden />
            {record.tagCount} {record.tagCount === 1 ? "tag" : "tags"}
          </span>
        )}
      </div>
    </Card>
  );
}

/* ── Config builder ─────────────────────────────────────────────────────── */

function buildMediaConfig(
  router: ReturnType<typeof useRouter>,
  onDelete: (r: MediaRow) => void,
): DataViewerConfig<MediaRow> {
  return {
    id: "media",
    labels: { singular: "Media item", plural: "Media" },
    getRowId: (row) => row.id,
    enableRowSelection: true,
    columns: [
      {
        accessorKey: "mediaType",
        header: "Type",
        cell: ({ row }) => {
          const t = row.getValue("mediaType") as MediaRow["mediaType"];
          return <MediaTypeBadge mediaType={t} />;
        },
      },
      { accessorKey: "title", header: "Title", enableSorting: true },
      {
        accessorKey: "description",
        header: "Description",
        cell: ({ row }) => {
          const d = (row.getValue("description") as string).trim();
          return d ? <span className="line-clamp-2 max-w-[14rem] text-muted-foreground">{d}</span> : "—";
        },
      },
      { accessorKey: "filename", header: "File" },
      { accessorKey: "linkedTo", header: "Linked to", enableSorting: true },
      {
        id: "albumCount",
        header: "Albums",
        cell: ({ row }) => {
          const n = (row.original as MediaRow).albumCount;
          return n > 0 ? <span>{n} {n === 1 ? "album" : "albums"}</span> : <span className="text-muted-foreground/50">—</span>;
        },
      },
    ],
    renderCard: ({ record, onView, onEdit, onDelete: onDel }) => (
      <MediaCardItem record={record} onView={onView} onEdit={onEdit} onDelete={onDel} />
    ),
    actions: {
      view: { label: "View", handler: (r) => router.push(`/admin/media/${r.id}`) },
      edit: { label: "Edit", handler: (r) => router.push(`/admin/media/${r.id}/edit`) },
      delete: { label: "Delete", handler: onDelete },
    },
  };
}

/* ── Page ───────────────────────────────────────────────────────────────── */

export default function AdminMediaPage() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const deleteMedia = useDeleteMedia();
  const createMedia = useCreateMedia();
  const listUploadInputRef = useRef<HTMLInputElement>(null);
  const [listUploadDragOver, setListUploadDragOver] = useState(false);
  const [uploadOpen, setUploadOpen] = useState(false);
  const [listUploadProgress, setListUploadProgress] = useState<MediaEditorUploadProgressState | null>(null);

  const { draft: filterDraft, queryOpts, updateDraft, apply: applyFilters, clear: clearFilters } =
    useAdminMediaPageFilters();

  const handleListUploadFiles = useCallback(
    async (fileList: FileList | File[] | null | undefined) => {
      const raw = fileList == null ? [] : Array.isArray(fileList) ? fileList : Array.from(fileList);
      const files = raw.filter((f) => f && f.size > 0);
      if (files.length === 0) {
        toast.error("Choose at least one non-empty file.");
        return;
      }
      const errors: string[] = [];
      let lastId: string | undefined;
      let lastTitle = "";
      try {
        for (let i = 0; i < files.length; i++) {
          const file = files[i]!;
          const label = file.name?.trim() || `File ${i + 1}`;
          try {
            const fd = new FormData();
            fd.set("file", file);
            setListUploadProgress({
              loaded: 0,
              total: null,
              expectedBytes: file.size,
              caption: `${i + 1} of ${files.length}: ${label}`,
              subCaption: "Uploading…",
            });
            const up = await postFormDataWithUploadProgress<{
              fileRef: string;
              suggestedForm: string | null;
              originalName: string;
            }>("/api/admin/media/upload", fd, (p) => {
              setListUploadProgress({
                loaded: p.loaded,
                total: p.total,
                expectedBytes: file.size,
                caption: `${i + 1} of ${files.length}: ${label}`,
                subCaption: "Uploading…",
              });
            });
            setListUploadProgress({
              loaded: file.size,
              total: file.size,
              expectedBytes: file.size,
              caption: `${i + 1} of ${files.length}: ${label}`,
              subCaption: "Saving media row…",
            });
            const title = titleFromUploadedFilename(up.originalName);
            const res = (await createMedia.mutateAsync({
              title,
              fileRef: up.fileRef,
              form: up.suggestedForm ?? null,
            })) as { media: { id: string } };
            lastId = res.media.id;
            lastTitle = title;
          } catch (err) {
            const msg = err instanceof ApiError ? err.message : err instanceof Error ? err.message : "Upload failed";
            errors.push(`${label}: ${msg}`);
          }
        }
        await queryClient.invalidateQueries({ queryKey: [...ADMIN_MEDIA_QUERY_KEY] });
        if (errors.length === 0) {
          if (files.length === 1 && lastId) {
            toast.success(`Added media "${lastTitle}".`);
            router.push(`/admin/media/${lastId}/edit`);
          } else {
            toast.success(`Added ${files.length} media files.`);
          }
          return;
        }
        if (errors.length < files.length) {
          toast.warning(`Uploaded ${files.length - errors.length} of ${files.length} files.`, {
            description: errors.slice(0, 5).join(" · "),
          });
          return;
        }
        toast.error(errors.slice(0, 3).join(" · "));
      } finally {
        setListUploadProgress(null);
      }
    },
    [createMedia, queryClient, router],
  );

  const handleDelete = useCallback(
    async (r: MediaRow) => {
      const label = r.title.trim() || r.filename.trim() || r.id;
      if (!window.confirm(`Delete media "${label}"? This removes the GEDCOM media row, its tree links, tags, and album links. This cannot be undone.`)) return;
      try {
        await deleteMedia.mutateAsync(r.id);
        toast.success(`Deleted "${label}".`);
      } catch (err) {
        toast.error(`Failed to delete: ${err instanceof Error ? err.message : "Unknown error"}`);
      }
    },
    [deleteMedia],
  );

  const { data: setup } = useQuery({
    queryKey: ["admin", "setup"],
    queryFn: () => fetchJson<AdminSetupPayload>("/api/admin/setup"),
    staleTime: 60 * 1000,
  });

  const { data, isLoading, isError, error } = useAdminMedia(queryOpts);
  const rows = useMemo(() => (data ? mapApiToRows(data) : []), [data]);
  const config = useMemo(() => buildMediaConfig(router, handleDelete), [router, handleDelete]);

  const loadErrorMessage =
    error instanceof ApiError ? error.message : error instanceof Error ? error.message : "Could not load media.";

  return (
    <div className="space-y-5">
      {/* Header row */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Media</h1>
          <p className="text-sm text-muted-foreground">
            Photos, documents, video, and audio linked to people, families, and events in this tree.
          </p>
          {setup?.configured && setup.gedcomFile && (
            <p className="mt-1 text-xs text-muted-foreground">
              Scoped to:{" "}
              <span className="font-medium text-base-content/90">{setup.gedcomFile.name ?? "Untitled"}</span>
              {setup.gedcomMediaCount != null && (
                <> ({setup.gedcomMediaCount} OBJE {setup.gedcomMediaCount === 1 ? "row" : "rows"})</>
              )}
            </p>
          )}
        </div>
        <div className="flex shrink-0 flex-wrap items-center gap-2">
          {/* Upload toggle */}
          <button
            type="button"
            title="Quick upload: you can drop or pick several files at once"
            onClick={() => setUploadOpen((o) => !o)}
            className={cn(
              "btn btn-sm gap-1.5",
              uploadOpen ? "btn-primary" : "btn-outline border-base-content/20",
            )}
          >
            <Upload className="size-3.5" aria-hidden />
            Upload
          </button>
          <button
            type="button"
            className="btn btn-primary btn-sm gap-1.5"
            onClick={() => router.push("/admin/media/new")}
          >
            + Add media
          </button>
        </div>
      </div>

      {/* Upload zone — collapsed by default */}
      {uploadOpen && (
        <section aria-label="Quick upload (multiple files allowed)">
          <p className="mb-2 text-xs text-muted-foreground">
            <span className="font-medium text-base-content/90">Multiple files at once:</span> drop several here, or
            click and multi-select in the file dialog (<kbd className="kbd kbd-xs">Shift</kbd>+click for a range,{" "}
            <kbd className="kbd kbd-xs">Ctrl</kbd> or <kbd className="kbd kbd-xs">⌘</kbd>+click to add files). Each file becomes its own media row (title from filename). One file opens edit;
            two or more stay on this list.
          </p>
          <div
            role="button"
            tabIndex={0}
            onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); listUploadInputRef.current?.click(); } }}
            onClick={() => listUploadInputRef.current?.click()}
            onDragEnter={(e) => { e.preventDefault(); setListUploadDragOver(true); }}
            onDragLeave={(e) => { e.preventDefault(); setListUploadDragOver(false); }}
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => {
              e.preventDefault();
              setListUploadDragOver(false);
              const list = e.dataTransfer.files;
              if (list?.length) void handleListUploadFiles(list);
            }}
            className={cn(
              "flex min-h-[110px] cursor-pointer flex-col items-center justify-center gap-2 rounded-box border-2 border-dashed px-4 py-6 text-center text-sm transition-colors",
              listUploadDragOver ? "border-primary bg-primary/5" : "border-base-content/15 bg-base-200/25",
              listUploadProgress != null && "pointer-events-none opacity-60",
            )}
          >
            {listUploadProgress != null ? (
              <Loader2 className="size-8 animate-spin text-muted-foreground" aria-hidden />
            ) : (
              <Upload className="size-8 text-muted-foreground" aria-hidden />
            )}
            {listUploadProgress != null ? (
              <MediaUploadProgressInline
                className="w-full max-w-sm"
                loaded={listUploadProgress.loaded}
                total={listUploadProgress.total}
                expectedSize={listUploadProgress.expectedBytes}
                caption={listUploadProgress.caption ?? null}
                subCaption={listUploadProgress.subCaption ?? null}
              />
            ) : null}
            <span className="font-medium text-base-content">
              {listUploadProgress != null
                ? "Please wait…"
                : "Drop multiple files here, or click to choose several"}
            </span>
            {listUploadProgress == null ? (
              <span className="badge badge-sm border border-primary/30 bg-primary/10 font-normal text-primary">
                Multi-file upload
              </span>
            ) : null}
            <span className="text-xs text-muted-foreground">
              Up to {adminMediaUploadMaxMbForUi()} MB per file · any file type
            </span>
            <input
              ref={listUploadInputRef}
              type="file"
              multiple
              className="sr-only"
              accept="*/*"
              aria-label="Choose one or more media files to upload"
              disabled={listUploadProgress != null}
              onChange={(ev) => {
                const list = ev.target.files;
                if (list?.length) void handleListUploadFiles(list);
                ev.target.value = "";
              }}
            />
          </div>
        </section>
      )}

      {isError && (
        <div role="alert" className="rounded-box border border-error/30 bg-error/10 px-4 py-3 text-sm text-error">
          <p className="font-medium">Failed to load media</p>
          <p className="mt-1 opacity-90">{loadErrorMessage}</p>
        </div>
      )}

      <FilterPanel onApply={applyFilters} onClear={clearFilters}>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <div className="space-y-2">
            <Label htmlFor="filter-media-category">Type</Label>
            <select id="filter-media-category" className={selectClassName} value={filterDraft.mediaCategory} onChange={(e) => updateDraft("mediaCategory", e.target.value)}>
              <option value="">Any</option>
              <option value="photo">Photo</option>
              <option value="document">Document</option>
              <option value="video">Video</option>
              <option value="audio">Audio</option>
            </select>
          </div>
          <div className="space-y-2 sm:col-span-2">
            <Label htmlFor="filter-q">Quick search</Label>
            <Input id="filter-q" value={filterDraft.q} onChange={(e) => updateDraft("q", e.target.value)} placeholder="Title, description, file path, form, or xref" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="filter-title">Title contains</Label>
            <Input id="filter-title" value={filterDraft.titleContains} onChange={(e) => updateDraft("titleContains", e.target.value)} placeholder="Substring in title" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="filter-fileref">File / path contains</Label>
            <Input id="filter-fileref" value={filterDraft.fileRefContains} onChange={(e) => updateDraft("fileRefContains", e.target.value)} placeholder="Substring in file_ref" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="filter-filetype">File type / extension</Label>
            <Input id="filter-filetype" value={filterDraft.fileTypeContains} onChange={(e) => updateDraft("fileTypeContains", e.target.value)} placeholder="e.g. jpg, png, pdf" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="filter-linked-given">Linked person — given name contains</Label>
            <Input id="filter-linked-given" value={filterDraft.linkedGiven} onChange={(e) => updateDraft("linkedGiven", e.target.value)} placeholder="Structured given tokens" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="filter-linked-last">Linked person — last name prefix</Label>
            <Input id="filter-linked-last" value={filterDraft.linkedLast} onChange={(e) => updateDraft("linkedLast", e.target.value)} placeholder="GEDCOM slash-aware prefix" />
          </div>
        </div>
      </FilterPanel>

      <DataViewer
        config={config}
        data={rows}
        isLoading={isLoading}
        defaultViewMode="cards"
        viewModeKey="admin-media-view"
        totalCount={data?.total}
      />
    </div>
  );
}
