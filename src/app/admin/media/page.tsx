"use client";

import { useCallback, useMemo, useRef, useState } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { useQuery } from "@tanstack/react-query";
import { FileImage, FileText, Film, Loader2, Upload } from "lucide-react";
import {
  isLikelyRasterImage,
  isLikelyVideoFile,
  isPlayableVideoRef,
  mediaImageUnoptimized,
  resolveMediaImageSrc,
} from "@/lib/admin/mediaPreview";
import { DataViewer, type DataViewerConfig } from "@/components/data-viewer";
import { ResultCount } from "@/components/data-viewer/ResultCount";
import { CardActionFooter } from "@/components/data-viewer/CardActionFooter";
import { FilterPanel } from "@/components/data-viewer/FilterPanel";
import { selectClassName } from "@/components/data-viewer/constants";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  useAdminMedia,
  useCreateMedia,
  useDeleteMedia,
  type AdminMediaListResponse,
  type UseAdminMediaOpts,
} from "@/hooks/useAdminMedia";
import { useFilterState } from "@/hooks/useFilterState";
import { ADMIN_LIST_MAX_LIMIT } from "@/constants/admin";
import { stripSlashesFromName } from "@/lib/gedcom/display-name";
import { labelGedcomEventType } from "@/lib/gedcom/gedcom-event-labels";
import { fetchJson, ApiError, postFormData } from "@/lib/infra/api";
import { cn } from "@/lib/utils";

interface MediaRow {
  id: string;
  title: string;
  /** Optional admin-only caption; not part of GEDCOM title. */
  description: string;
  mediaType: "photo" | "document" | "video";
  /** Display copy of file_ref (may be "—"). */
  filename: string;
  /** Raw GEDCOM form string for type / extension hints. */
  form: string;
  linkedTo: string;
}

const mediaTypeIcon: Record<MediaRow["mediaType"], React.ComponentType<{ className?: string }>> = {
  photo: FileImage,
  document: FileText,
  video: Film,
};

interface AdminSetupPayload {
  configured: boolean;
  message?: string;
  gedcomFile?: { id: string; fileId: string; name: string | null } | null;
  gedcomMediaCount?: number;
}

interface FilterState {
  mediaCategory: string;
  titleContains: string;
  fileRefContains: string;
  fileTypeContains: string;
  linkedGiven: string;
  linkedLast: string;
  q: string;
}

/** Suggested GEDCOM title from an uploaded original filename (strip path + extension). */
function titleFromUploadedFilename(originalName: string): string {
  const base = originalName.trim().replace(/^.*[/\\]/, "");
  const noExt = base.replace(/\.[^.]+$/, "");
  return (noExt || base || "Uploaded media").trim();
}

const FILTER_DEFAULTS: FilterState = {
  mediaCategory: "",
  titleContains: "",
  fileRefContains: "",
  fileTypeContains: "",
  linkedGiven: "",
  linkedLast: "",
  q: "",
};

function mapApiToRows(api: AdminMediaListResponse): MediaRow[] {
  return (api?.media ?? []).map((m) => {
    const form = (m.form ?? "").toLowerCase();
    let mediaType: MediaRow["mediaType"] = "photo";
    if (form.includes("video") || form === "video") mediaType = "video";
    else if (form.includes("doc") || form === "document") mediaType = "document";

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
    const linkedTo = parts.length ? parts.join("; ") : "—";

    return {
      id: m.id,
      title: m.title ?? "—",
      description: (m.description ?? "").trim(),
      mediaType,
      filename: m.fileRef ?? "—",
      form: m.form ?? "",
      linkedTo,
    };
  });
}

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
          const Icon = mediaTypeIcon[t];
          return (
            <span className="inline-flex items-center gap-1.5 capitalize">
              <Icon className="size-4 text-muted-foreground" /> {t}
            </span>
          );
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
    ],
    renderCard: ({ record, onView, onEdit, onDelete }) => {
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
      const titleDisplay = record.title.trim() && record.title !== "—" ? record.title : "Untitled";
      return (
        <Card className="overflow-hidden border-base-content/12 pt-0 shadow-sm shadow-black/10 transition-shadow hover:shadow-md hover:shadow-black/15">
          <div className="relative aspect-[4/3] w-full border-b border-base-content/10 bg-gradient-to-b from-base-200/70 to-base-300/35">
            {thumbSrc ? (
              <Image
                key={thumbSrc + record.id}
                src={thumbSrc}
                alt={titleDisplay}
                fill
                sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, (max-width: 1280px) 33vw, 25vw"
                className="object-contain p-2"
                unoptimized={mediaImageUnoptimized(thumbSrc)}
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
            ) : (
              <div className="flex h-full min-h-[7rem] flex-col items-center justify-center gap-2 px-4 py-6 text-center">
                <Icon className="size-11 shrink-0 text-muted-foreground/55" aria-hidden />
                <span className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                  {record.mediaType}
                </span>
                <span className="line-clamp-2 max-w-full text-xs font-medium leading-snug text-base-content/80">
                  {titleDisplay}
                </span>
              </div>
            )}
          </div>
          <CardHeader className="space-y-1.5 pb-2 pt-4">
            <div className="flex items-start gap-2">
              <Icon className="mt-0.5 size-4 shrink-0 text-muted-foreground" aria-hidden />
              <CardTitle className="line-clamp-2 min-w-0 text-base leading-snug">{record.title}</CardTitle>
            </div>
            <p className="line-clamp-2 break-all font-mono text-[10px] leading-tight tracking-tight text-muted-foreground">
              {record.filename}
            </p>
            {record.description ? (
              <p className="line-clamp-2 text-xs leading-snug text-muted-foreground">{record.description}</p>
            ) : null}
          </CardHeader>
          <CardContent className="pt-0 text-xs leading-relaxed text-muted-foreground">
            <p className="line-clamp-3">{record.linkedTo}</p>
          </CardContent>
          <CardActionFooter onView={onView} onEdit={onEdit} onDelete={onDelete} />
        </Card>
      );
    },
    actions: {
      add: { label: "Add media", handler: () => router.push("/admin/media/new") },
      view: { label: "View", handler: (r) => router.push(`/admin/media/${r.id}`) },
      edit: { label: "Edit", handler: (r) => router.push(`/admin/media/${r.id}/edit`) },
      delete: { label: "Delete", handler: onDelete },
    },
  };
}

function filterStateToQueryOpts(applied: FilterState): UseAdminMediaOpts {
  const opts: UseAdminMediaOpts = {
    limit: ADMIN_LIST_MAX_LIMIT,
    offset: 0,
  };
  const q = applied.q.trim();
  if (q) opts.q = q;
  if (applied.mediaCategory === "photo" || applied.mediaCategory === "document" || applied.mediaCategory === "video") {
    opts.mediaCategory = applied.mediaCategory;
  }
  const tc = applied.titleContains.trim();
  if (tc) opts.titleContains = tc;
  const fr = applied.fileRefContains.trim();
  if (fr) opts.fileRefContains = fr;
  const ft = applied.fileTypeContains.trim();
  if (ft) opts.fileTypeContains = ft;
  const lg = applied.linkedGiven.trim();
  const ll = applied.linkedLast.trim();
  if (lg) opts.linkedGiven = lg;
  if (ll) opts.linkedLast = ll;
  return opts;
}

export default function AdminMediaPage() {
  const router = useRouter();
  const deleteMedia = useDeleteMedia();
  const createMedia = useCreateMedia();
  const listUploadInputRef = useRef<HTMLInputElement>(null);
  const [listUploadDragOver, setListUploadDragOver] = useState(false);
  const { draft: filterDraft, queryOpts, updateDraft, apply: applyFilters, clear: clearFilters } =
    useFilterState(FILTER_DEFAULTS, filterStateToQueryOpts);

  const handleListUploadFile = useCallback(
    async (file: File) => {
      if (!file || file.size <= 0) {
        toast.error("Choose a non-empty file.");
        return;
      }
      try {
        const fd = new FormData();
        fd.set("file", file);
        const up = await postFormData<{
          fileRef: string;
          suggestedForm: string | null;
          originalName: string;
        }>("/api/admin/media/upload", fd);
        const title = titleFromUploadedFilename(up.originalName);
        const res = (await createMedia.mutateAsync({
          title,
          fileRef: up.fileRef,
          form: up.suggestedForm ?? null,
        })) as { media: { id: string } };
        toast.success(`Added media “${title}”.`);
        router.push(`/admin/media/${res.media.id}/edit`);
      } catch (err) {
        const msg = err instanceof ApiError ? err.message : err instanceof Error ? err.message : "Upload failed";
        toast.error(msg);
      }
    },
    [createMedia, router],
  );

  const handleDelete = useCallback(
    async (r: MediaRow) => {
      const label = r.title.trim() || r.filename.trim() || r.id;
      if (
        !window.confirm(
          `Delete media “${label}”? This removes the GEDCOM media row, its tree links, tags, and album links. This cannot be undone.`,
        )
      ) {
        return;
      }
      try {
        await deleteMedia.mutateAsync(r.id);
        toast.success(`Deleted “${label}”.`);
      } catch (err) {
        const msg = err instanceof Error ? err.message : "Unknown error";
        toast.error(`Failed to delete: ${msg}`);
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
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Media</h1>
        <p className="text-muted-foreground">
          GEDCOM media objects: <code className="text-xs">form</code> is the GEDCOM format (often jpeg, pdf, etc.);{" "}
          <code className="text-xs">file_ref</code> is the path or URL. Title is the GEDCOM title; description is an optional
          longer caption. Quick search matches title, description, file reference, form, and xref.
        </p>
        {setup?.configured && setup.gedcomFile ? (
          <p className="mt-2 text-sm text-muted-foreground">
            Scoped to this admin tree file:{" "}
            <span className="font-medium text-base-content/90">{setup.gedcomFile.name ?? "Untitled"}</span>
            {setup.gedcomMediaCount != null ? (
              <>
                {" "}
                (<span className="tabular-nums">{setup.gedcomMediaCount}</span> OBJE row
                {setup.gedcomMediaCount === 1 ? "" : "s"} in <code className="text-xs">gedcom_media_v2</code>).
              </>
            ) : null}{" "}
            Other rows in the database with a different <code className="text-xs">file_uuid</code> are not shown.
          </p>
        ) : null}
      </div>

      {isError ? (
        <div role="alert" className="rounded-box border border-error/30 bg-error/10 px-4 py-3 text-sm text-error">
          <p className="font-medium">Failed to load media</p>
          <p className="mt-1 opacity-90">{loadErrorMessage}</p>
        </div>
      ) : null}

      <section aria-label="Quick upload" className="space-y-2">
        <div className="flex flex-wrap items-end justify-between gap-2">
          <div>
            <h2 className="text-sm font-semibold text-base-content">Upload from this page</h2>
            <p className="text-xs text-muted-foreground">
              Drop a file or browse — we store it, create a media row with title from the filename, then open edit so you
              can add links, tags, or description. Same pipeline as{" "}
              <button
                type="button"
                className="link link-primary font-medium"
                onClick={() => router.push("/admin/media/new")}
              >
                Add media
              </button>
              .
            </p>
          </div>
        </div>
        <div
          role="button"
          tabIndex={0}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") {
              e.preventDefault();
              listUploadInputRef.current?.click();
            }
          }}
          onClick={() => listUploadInputRef.current?.click()}
          onDragEnter={(e) => {
            e.preventDefault();
            setListUploadDragOver(true);
          }}
          onDragLeave={(e) => {
            e.preventDefault();
            setListUploadDragOver(false);
          }}
          onDragOver={(e) => e.preventDefault()}
          onDrop={(e) => {
            e.preventDefault();
            setListUploadDragOver(false);
            const f = e.dataTransfer.files?.[0];
            if (f) void handleListUploadFile(f);
          }}
          className={cn(
            "flex min-h-[120px] cursor-pointer flex-col items-center justify-center gap-2 rounded-box border-2 border-dashed px-4 py-6 text-center text-sm transition-colors",
            listUploadDragOver ? "border-primary bg-primary/5" : "border-base-content/15 bg-base-200/25",
            createMedia.isPending && "pointer-events-none opacity-60",
          )}
        >
          {createMedia.isPending ? (
            <Loader2 className="size-8 animate-spin text-muted-foreground" aria-hidden />
          ) : (
            <Upload className="size-8 text-muted-foreground" aria-hidden />
          )}
          <span className="font-medium text-base-content">
            {createMedia.isPending ? "Uploading and creating…" : "Drop a file here or click to choose"}
          </span>
          <span className="max-w-md text-xs text-muted-foreground">Up to 80 MB. Any file type.</span>
          <input
            ref={listUploadInputRef}
            type="file"
            className="sr-only"
            accept="*/*"
            disabled={createMedia.isPending}
            onChange={(ev) => {
              const f = ev.target.files?.[0];
              if (f) void handleListUploadFile(f);
              ev.target.value = "";
            }}
          />
        </div>
      </section>

      <FilterPanel onApply={applyFilters} onClear={clearFilters}>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <div className="space-y-2">
            <Label htmlFor="filter-media-category">Type (from GEDCOM form)</Label>
            <select
              id="filter-media-category"
              className={selectClassName}
              value={filterDraft.mediaCategory}
              onChange={(e) => updateDraft("mediaCategory", e.target.value)}
            >
              <option value="">Any</option>
              <option value="photo">Photo (default bucket)</option>
              <option value="document">Document</option>
              <option value="video">Video</option>
            </select>
          </div>
          <div className="space-y-2 sm:col-span-2">
            <Label htmlFor="filter-q">Quick search</Label>
            <Input
              id="filter-q"
              value={filterDraft.q}
              onChange={(e) => updateDraft("q", e.target.value)}
              placeholder="Title, description, file path, form, or xref (case-insensitive)"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="filter-title">Title contains</Label>
            <Input
              id="filter-title"
              value={filterDraft.titleContains}
              onChange={(e) => updateDraft("titleContains", e.target.value)}
              placeholder="Substring in title"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="filter-fileref">File / path contains</Label>
            <Input
              id="filter-fileref"
              value={filterDraft.fileRefContains}
              onChange={(e) => updateDraft("fileRefContains", e.target.value)}
              placeholder="Substring in file_ref"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="filter-filetype">File type / extension</Label>
            <Input
              id="filter-filetype"
              value={filterDraft.fileTypeContains}
              onChange={(e) => updateDraft("fileTypeContains", e.target.value)}
              placeholder="e.g. jpg, png, pdf (matches form or path)"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="filter-linked-given">Linked person — given name contains</Label>
            <Input
              id="filter-linked-given"
              value={filterDraft.linkedGiven}
              onChange={(e) => updateDraft("linkedGiven", e.target.value)}
              placeholder="Structured given tokens"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="filter-linked-last">Linked person — last name prefix</Label>
            <Input
              id="filter-linked-last"
              value={filterDraft.linkedLast}
              onChange={(e) => updateDraft("linkedLast", e.target.value)}
              placeholder="GEDCOM slash-aware prefix"
            />
          </div>
        </div>
      </FilterPanel>

      {data && (
        <ResultCount total={data.total} hasMore={data.hasMore} shown={data.media.length} isLoading={isLoading} />
      )}

      <DataViewer
        config={config}
        data={rows}
        isLoading={isLoading}
        defaultViewMode="cards"
        viewModeKey="admin-media-view"
      />
    </div>
  );
}
