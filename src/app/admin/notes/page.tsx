"use client";

import { useMemo, useCallback, useState } from "react";
import { useRouter } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { AdminListPageShell } from "@/components/admin/AdminListPageShell";
import { NoteGridCard, type NoteGridCardLinkedTarget } from "@/components/admin/NoteGridCard";
import {
  DataViewer,
  DataViewerGedcomBatchEditModal,
  type DataViewerConfig,
} from "@/components/data-viewer";
import { FilterPanel } from "@/components/data-viewer/FilterPanel";
import { selectClassName } from "@/components/data-viewer/constants";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAdminNotes, useDeleteNote, type AdminNotesListResponse } from "@/hooks/useAdminNotes";
import { deleteJson } from "@/lib/infra/api";
import { useAdminNotesPageFilters } from "@/hooks/useAdminNotesPageFilters";
import { stripSlashesFromName } from "@/lib/gedcom/display-name";
import { labelGedcomEventType } from "@/lib/gedcom/gedcom-event-labels";
import { markdownToPlainPreview } from "@/lib/utils/markdown-preview";

interface NoteRow {
  id: string;
  xref: string;
  contentPreview: string;
  isTopLevel: boolean;
  linkedTo: string;
  linkedTargets: NoteGridCardLinkedTarget[];
}

function mapApiToRows(api: AdminNotesListResponse): NoteRow[] {
  return (api?.notes ?? []).map((n) => {
    const contentPreview = markdownToPlainPreview(n.content, 160);
    const linkedTargets: NoteGridCardLinkedTarget[] = [];

    n.individualNotes?.forEach((in_) => {
      const name = stripSlashesFromName(in_.individual?.fullName);
      const id = in_.individual?.id;
      if (name && id) {
        linkedTargets.push({ kind: "individual", label: name, href: `/admin/individuals/${id}` });
      }
    });
    n.familyNotes?.forEach((fn) => {
      const h = stripSlashesFromName(fn.family?.husband?.fullName);
      const w = stripSlashesFromName(fn.family?.wife?.fullName);
      const id = fn.family?.id;
      if (!id || !(h || w)) return;
      const label = `${h} & ${w}`.replace(/^ & | & $/g, "").trim() || "Family";
      linkedTargets.push({ kind: "family", label, href: `/admin/families/${id}` });
    });
    n.eventNotes?.forEach((en) => {
      const id = en.event?.id;
      const et = en.event?.eventType;
      if (id && et) {
        const typeWord = labelGedcomEventType(et);
        const custom = (en.event?.customType ?? "").trim();
        const display = custom ? `${typeWord} (${custom})` : typeWord;
        linkedTargets.push({ kind: "event", label: `Event: ${display}`, href: `/admin/events/${id}` });
      }
    });
    n.sourceNotes?.forEach((sn) => {
      const t = sn.source?.title ?? sn.source?.xref;
      if (t) {
        linkedTargets.push({ kind: "source", label: t, href: null });
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
  bulkDeleteOne: (id: string) => Promise<void>,
  onBulkEdit: (ids: string[]) => void,
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
      <NoteGridCard record={record} onView={onView} onEdit={onEdit} onDelete={onDelete} />
    ),
    actions: {
      add: { label: "Add note", handler: () => router.push("/admin/notes/new") },
      view: { label: "View", handler: (r) => router.push(`/admin/notes/${r.id}`) },
      edit: { label: "Edit", handler: (r) => router.push(`/admin/notes/${r.id}/edit`) },
      bulkEdit: { label: "Edit selected", handler: onBulkEdit },
      delete: {
        label: "Delete",
        handler: onDelete,
        bulkDeleteOne,
      },
    },
  };
}

export default function AdminNotesPage() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const deleteNote = useDeleteNote();
  const [batchEditOpen, setBatchEditOpen] = useState(false);
  const [batchEditIds, setBatchEditIds] = useState<string[]>([]);
  const [batchApplyKey, setBatchApplyKey] = useState<number | undefined>();
  const { draft: filterDraft, queryOpts, updateDraft, apply: applyFilters, clear: clearFilters } =
    useAdminNotesPageFilters();

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

  const bulkDeleteOneNote = useCallback(async (id: string) => {
    await deleteJson(`/api/admin/notes/${id}`);
  }, []);

  const handleBulkDeleteFinished = useCallback(() => {
    void queryClient.invalidateQueries({ queryKey: ["admin", "notes"] });
  }, [queryClient]);

  const openBulkEdit = useCallback((ids: string[]) => {
    setBatchEditIds(ids);
    setBatchEditOpen(true);
  }, []);

  const rows = useMemo(() => (data ? mapApiToRows(data) : []), [data]);
  const config = useMemo(
    () => buildNotesConfig(router, handleDelete, bulkDeleteOneNote, openBulkEdit),
    [router, handleDelete, bulkDeleteOneNote, openBulkEdit],
  );

  return (
    <AdminListPageShell
      title="Notes"
      description="Free-text notes linked to individuals, families, events, or sources. Filter by top-level flag, content, or names on linked individuals."
      filters={
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
      }
    >
      <DataViewerGedcomBatchEditModal
        open={batchEditOpen}
        onOpenChange={setBatchEditOpen}
        entityKind="note"
        selectedIds={batchEditIds}
        onApplied={() => {
          setBatchApplyKey((k) => (k ?? 0) + 1);
          void queryClient.invalidateQueries({ queryKey: ["admin", "notes"] });
        }}
      />
      <DataViewer
        config={config}
        data={rows}
        isLoading={isLoading}
        viewModeKey="admin-notes-view"
        totalCount={data?.total}
        batchApplyKey={batchApplyKey}
        onBulkDeleteFinished={handleBulkDeleteFinished}
      />
    </AdminListPageShell>
  );
}
