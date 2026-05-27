"use client";

import { useMemo } from "react";
import { Link2, Users } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { CardActionFooter } from "@/components/data-viewer/CardActionFooter";
import { DataViewer, type DataViewerConfig } from "@/components/data-viewer";
import {
  useAdminRelationships,
  useDeleteAdminRelationship,
  type AdminRelationship,
} from "@/hooks/useAdminRelationships";
import { useRouter } from "next/navigation";

// ── Helpers ───────────────────────────────────────────────────────────────────

function AssociationCard({
  relationship,
  onEdit,
  onDelete,
}: {
  relationship: AdminRelationship;
  onEdit?: () => void;
  onDelete?: () => void;
}) {
  return (
    <Card>
      <CardContent className="space-y-3 pt-4">
        <div className="flex min-w-0 items-center gap-2">
          <Link2 className="size-4 shrink-0 text-muted-foreground" />
          <span className="truncate font-medium">{relationship.relationshipType.label}</span>
        </div>

        <div className="flex flex-wrap gap-1.5">
          {relationship.participants.map((p) => (
            <span
              key={p.id}
              className="inline-flex items-center gap-1 rounded-full border border-base-content/15 bg-base-200/60 px-2 py-0.5 text-xs font-medium text-base-content"
            >
              <Users className="size-3 shrink-0 text-muted-foreground" />
              {p.individual.fullName ?? p.individual.xref}
              <span className="text-muted-foreground">· {p.role.label}</span>
            </span>
          ))}
        </div>

        {relationship.notes && (
          <p className="text-xs leading-relaxed text-muted-foreground line-clamp-2">{relationship.notes}</p>
        )}
      </CardContent>
      <CardActionFooter onEdit={onEdit} onDelete={onDelete} />
    </Card>
  );
}

// ── DataViewer config ─────────────────────────────────────────────────────────

function buildConfig(
  onAdd: () => void,
  onEdit: (r: AdminRelationship) => void,
  onDelete: (r: AdminRelationship) => void,
): DataViewerConfig<AdminRelationship> {
  return {
    id: "associations",
    labels: { singular: "Association", plural: "Associations" },
    getRowId: (r) => r.id,
    columns: [
      {
        id: "type",
        header: "Type",
        enableSorting: false,
        cell: ({ row }) => (
          <div className="flex items-center gap-2">
            <Link2 className="size-3.5 shrink-0 text-muted-foreground" />
            <span>{row.original.relationshipType.label}</span>
          </div>
        ),
      },
      {
        id: "participants",
        header: "Participants",
        enableSorting: false,
        cell: ({ row }) => (
          <div className="flex flex-wrap gap-1">
            {row.original.participants.map((p) => (
              <span
                key={p.id}
                className="inline-flex items-center gap-1 rounded-full border border-base-content/15 bg-base-200/60 px-1.5 py-0.5 text-[11px] font-medium text-base-content"
              >
                {p.individual.fullName ?? p.individual.xref}
                <span className="text-muted-foreground">· {p.role.label}</span>
              </span>
            ))}
          </div>
        ),
      },
      {
        id: "notes",
        header: "Notes",
        enableSorting: false,
        cell: ({ row }) =>
          row.original.notes ? (
            <span className="line-clamp-1 text-sm text-muted-foreground">{row.original.notes}</span>
          ) : (
            <span className="text-muted-foreground">—</span>
          ),
      },
    ],
    renderCard: ({ record, onEdit, onDelete }) => (
      <AssociationCard relationship={record} onEdit={onEdit} onDelete={onDelete} />
    ),
    actions: {
      add: { label: "Add association", handler: onAdd },
      edit: { label: "Edit", handler: onEdit },
      delete: { label: "Delete", handler: onDelete },
    },
  };
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function AdminAssociationsPage() {
  const router = useRouter();
  const { data, isLoading } = useAdminRelationships();
  const { mutate: deleteRelationship } = useDeleteAdminRelationship();

  const config = useMemo(
    () =>
      buildConfig(
        () => router.push("/admin/associations/new"),
        (r) => router.push(`/admin/associations/${r.id}/edit`),
        (r) => deleteRelationship(r.id),
      ),
    [router, deleteRelationship],
  );

  const rows = useMemo(() => data?.relationships ?? [], [data]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Associations</h1>
        <p className="mt-1 text-muted-foreground">
          Non-family relationships between individuals, such as godparents, witnesses, and mentors.
        </p>
      </div>

      <DataViewer
        config={config}
        data={rows}
        isLoading={isLoading}
        defaultViewMode="cards"
        viewModeKey="admin-associations-view"
        totalCount={rows.length}
      />
    </div>
  );
}
