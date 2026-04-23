"use client";

import { useMemo, useCallback } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { FileText, Link2, StickyNote } from "lucide-react";
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
  useAdminNotes,
  useDeleteNote,
  type AdminNotesListResponse,
  type UseAdminNotesOpts,
} from "@/hooks/useAdminNotes";
import { useFilterState } from "@/hooks/useFilterState";
import { ADMIN_LIST_MAX_LIMIT } from "@/constants/admin";
import { stripSlashesFromName } from "@/lib/gedcom/display-name";
import { markdownToPlainPreview } from "@/lib/utils/markdown-preview";

interface NoteLinkedTarget {
  label: string;
  /** Null when there is no admin detail route (e.g. source). */
  href: string | null;
}

interface NoteRow {
  id: string;
  xref: string;
  contentPreview: string;
  isTopLevel: boolean;
  linkedTo: string;
  linkedTargets: NoteLinkedTarget[];
}

interface FilterState {
  isTopLevel: string;
  contentContains: string;
  linkedGiven: string;
  linkedLast: string;
}

const FILTER_DEFAULTS: FilterState = {
  isTopLevel: "",
  contentContains: "",
  linkedGiven: "",
  linkedLast: "",
};

function mapApiToRows(api: AdminNotesListResponse): NoteRow[] {
  return (api?.notes ?? []).map((n) => {
    const contentPreview = markdownToPlainPreview(n.content, 80);
    const linkedTargets: NoteLinkedTarget[] = [];

    n.individualNotes?.forEach((in_) => {
      const name = stripSlashesFromName(in_.individual?.fullName);
      const id = in_.individual?.id;
      if (name && id) {
        linkedTargets.push({ label: name, href: `/admin/individuals/${id}` });
      }
    });
    n.familyNotes?.forEach((fn) => {
      const h = stripSlashesFromName(fn.family?.husband?.fullName);
      const w = stripSlashesFromName(fn.family?.wife?.fullName);
      const id = fn.family?.id;
      if (!id || !(h || w)) return;
      const label = `${h} & ${w}`.replace(/^ & | & $/g, "").trim() || "Family";
      linkedTargets.push({ label, href: `/admin/families/${id}` });
    });
    n.eventNotes?.forEach((en) => {
      const id = en.event?.id;
      const et = en.event?.eventType;
      if (id && et) {
        linkedTargets.push({ label: `Event: ${et}`, href: `/admin/events/${id}` });
      }
    });
    n.sourceNotes?.forEach((sn) => {
      const t = sn.source?.title ?? sn.source?.xref;
      if (t) {
        linkedTargets.push({ label: t, href: null });
      }
    });

    const linkedTo = linkedTargets.length ? linkedTargets.map((x) => x.label).join("; ") : "—";

    return {
      id: n.id,
      xref: n.xref ?? "—",
      contentPreview,
      isTopLevel: n.isTopLevel,
      linkedTo,
      linkedTargets,
    };
  });
}

function buildNotesConfig(
  router: ReturnType<typeof useRouter>,
  onDelete: (r: NoteRow) => void,
): DataViewerConfig<NoteRow> {
  return {
    id: "notes",
    labels: { singular: "Note", plural: "Notes" },
    getRowId: (row) => row.id,
    enableRowSelection: true,
    columns: [
      { accessorKey: "xref", header: "XREF", enableSorting: true },
      { accessorKey: "contentPreview", header: "Content", enableSorting: true },
      {
        accessorKey: "isTopLevel",
        header: "Top-level",
        cell: ({ row }) => (row.getValue("isTopLevel") ? "Yes" : "No"),
      },
      { accessorKey: "linkedTo", header: "Linked to", enableSorting: true },
    ],
    renderCard: ({ record, onView, onEdit, onDelete }) => (
      <Card>
        <CardHeader className="pb-2">
          <div className="flex items-center gap-2">
            <StickyNote className="size-5 text-muted-foreground" />
            <CardTitle className="text-base font-mono text-sm">{record.xref || "—"}</CardTitle>
          </div>
        </CardHeader>
        <CardContent className="space-y-3 text-sm">
          <p className="flex items-center gap-1.5 rounded-md bg-white/8 px-5 py-3.5 text-sm font-bold leading-none text-white app-light:bg-black/[0.07] app-light:text-base-content/90">
            <FileText className="size-3.5 shrink-0" aria-hidden />
            Content Preview
          </p>
          <div className="rounded-md bg-black/10 p-3">
            <p className="leading-snug text-sm text-base-content/90 line-clamp-4">
              {record.contentPreview}
            </p>
          </div>
          <p className="flex items-center gap-1.5 rounded-md bg-white/8 px-5 py-3.5 text-sm font-bold leading-none text-white app-light:bg-black/[0.07] app-light:text-base-content/90">
            <Link2 className="size-3.5 shrink-0" aria-hidden />
            Linked To
          </p>
          <div className="text-sm text-muted-foreground">
            {record.linkedTargets.length === 0 ? (
              <span>—</span>
            ) : (
              <span className="inline-flex min-w-0 flex-wrap items-baseline gap-x-1 gap-y-1">
                {record.linkedTargets.map((item, i) => (
                  <span key={`${item.label}-${i}`} className="inline-flex items-baseline">
                    {i > 0 ? <span className="mr-1 text-base-content/35">;</span> : null}
                    {item.href ? (
                      <Link
                        href={item.href}
                        className="font-medium text-primary underline-offset-2 hover:underline"
                      >
                        {item.label}
                      </Link>
                    ) : (
                      <span>{item.label}</span>
                    )}
                  </span>
                ))}
              </span>
            )}
          </div>
        </CardContent>
        <CardActionFooter onView={onView} onEdit={onEdit} onDelete={onDelete} />
      </Card>
    ),
    actions: {
      add: { label: "Add note", handler: () => router.push("/admin/notes/new") },
      view: { label: "View", handler: (r) => router.push(`/admin/notes/${r.id}`) },
      edit: { label: "Edit", handler: (r) => router.push(`/admin/notes/${r.id}/edit`) },
      delete: {
        label: "Delete",
        handler: onDelete,
      },
    },
  };
}

function filterStateToQueryOpts(applied: FilterState): UseAdminNotesOpts {
  const opts: UseAdminNotesOpts = {
    limit: ADMIN_LIST_MAX_LIMIT,
    offset: 0,
  };
  if (applied.isTopLevel === "true" || applied.isTopLevel === "false") {
    opts.isTopLevel = applied.isTopLevel;
  }
  const cc = applied.contentContains.trim();
  if (cc) opts.contentContains = cc;
  const lg = applied.linkedGiven.trim();
  const ll = applied.linkedLast.trim();
  if (lg) opts.linkedGiven = lg;
  if (ll) opts.linkedLast = ll;
  return opts;
}

export default function AdminNotesPage() {
  const router = useRouter();
  const deleteNote = useDeleteNote();
  const { draft: filterDraft, queryOpts, updateDraft, apply: applyFilters, clear: clearFilters } =
    useFilterState(FILTER_DEFAULTS, filterStateToQueryOpts);

  const { data, isLoading } = useAdminNotes(queryOpts);

  const handleDelete = useCallback(
    (r: NoteRow) => {
      const xrefOrId = r.xref !== "—" ? r.xref : r.id;
      const linkHint =
        r.linkedTargets.length > 0
          ? ` It will be unlinked from ${r.linkedTargets.length} record(s).`
          : "";
      if (!window.confirm(`Delete this note (${xrefOrId})?${linkHint} This cannot be undone.`)) {
        return;
      }
      deleteNote.mutate(r.id, {
        onSuccess: () => toast.success(`Deleted note (${xrefOrId}).`),
        onError: (err) => {
          const msg = err instanceof Error ? err.message : "Unknown error";
          toast.error(`Failed to delete note: ${msg}`);
        },
      });
    },
    [deleteNote],
  );

  const rows = useMemo(() => (data ? mapApiToRows(data) : []), [data]);
  const config = useMemo(() => buildNotesConfig(router, handleDelete), [router, handleDelete]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Notes</h1>
        <p className="text-muted-foreground">
          Free-text notes linked to individuals, families, events, or sources. Filter by top-level flag, content, or
          names on linked individuals.
        </p>
      </div>

      <FilterPanel onApply={applyFilters} onClear={clearFilters}>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <div className="space-y-2">
            <Label htmlFor="filter-top-level">Top-level note</Label>
            <select
              id="filter-top-level"
              className={selectClassName}
              value={filterDraft.isTopLevel}
              onChange={(e) => updateDraft("isTopLevel", e.target.value)}
            >
              <option value="">Any</option>
              <option value="true">Top-level only</option>
              <option value="false">Not top-level</option>
            </select>
          </div>
          <div className="space-y-2 sm:col-span-2">
            <Label htmlFor="filter-content">Content contains</Label>
            <Input
              id="filter-content"
              value={filterDraft.contentContains}
              onChange={(e) => updateDraft("contentContains", e.target.value)}
              placeholder="Substring in note body (case-insensitive)"
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
        <ResultCount total={data.total} hasMore={data.hasMore} shown={data.notes.length} isLoading={isLoading} />
      )}

      <DataViewer config={config} data={rows} isLoading={isLoading} viewModeKey="admin-notes-view" />
    </div>
  );
}
