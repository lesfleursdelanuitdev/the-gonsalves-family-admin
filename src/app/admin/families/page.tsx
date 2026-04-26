"use client";

import { useMemo, useCallback } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { AdminListPageShell } from "@/components/admin/AdminListPageShell";
import { DataViewer, type DataViewerConfig } from "@/components/data-viewer";
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
  useAdminFamilies,
  useDeleteFamily,
  type AdminFamiliesListResponse,
} from "@/hooks/useAdminFamilies";
import { useAdminFamiliesPageFilters } from "@/hooks/useAdminFamiliesPageFilters";
import { initialsFromPersonLabel, stripSlashesFromName } from "@/lib/gedcom/display-name";
import {
  FAMILY_LIST_FILTER_PARTNER_COLUMNS_HELP,
  FAMILY_PARTNER_1_LABEL,
  FAMILY_PARTNER_2_LABEL,
  FAMILY_PARTNER_SLOT_SUBTITLE,
} from "@/lib/gedcom/family-partner-slots";

interface FamilyRow {
  id: string;
  xref: string;
  husbandId: string | null;
  wifeId: string | null;
  partner1: string;
  partner2: string;
  childCount: number;
  marriageYear: string;
}

const familyPartnerLinkClass =
  "font-semibold text-primary underline-offset-2 hover:underline";

function mapApiToRows(api: AdminFamiliesListResponse): FamilyRow[] {
  return (api?.families ?? []).map((f) => ({
    id: f.id,
    xref: f.xref ?? "",
    husbandId: f.husband?.id ?? null,
    wifeId: f.wife?.id ?? null,
    partner1: stripSlashesFromName(f.husband?.fullName) || "—",
    partner2: stripSlashesFromName(f.wife?.fullName) || "—",
    childCount: f.childrenCount ?? 0,
    marriageYear: f.marriageYear != null ? String(f.marriageYear) : (f.marriageDateDisplay ?? ""),
  }));
}

function buildFamiliesConfig(
  router: ReturnType<typeof useRouter>,
  onDelete: (r: FamilyRow) => void,
): DataViewerConfig<FamilyRow> {
  return {
    id: "families",
    labels: { singular: "Family", plural: "Families" },
    getRowId: (row) => row.id,
    enableRowSelection: true,
    columns: [
      { accessorKey: "xref", header: "XREF" },
      { accessorKey: "partner1", header: `${FAMILY_PARTNER_1_LABEL} (HUSB)`, enableSorting: true },
      { accessorKey: "partner2", header: `${FAMILY_PARTNER_2_LABEL} (WIFE)`, enableSorting: true },
      { accessorKey: "childCount", header: "Children" },
      { accessorKey: "marriageYear", header: "Marriage" },
    ],
    renderCard: ({ record, onView, onEdit, onDelete }) => {
      const hInitials = initialsFromPersonLabel(record.partner1);
      const wInitials = initialsFromPersonLabel(record.partner2);
      const xrefDisplay = record.xref.trim() || "—";

      const partnerLine = (label: string, individualId: string | null) => {
        if (individualId && label !== "—") {
          return (
            <Link href={`/admin/individuals/${individualId}`} className={familyPartnerLinkClass}>
              {label}
            </Link>
          );
        }
        return <span className="font-semibold text-base-content/90">{label}</span>;
      };

      return (
      <Card>
        <CardHeader className="flex flex-col items-center gap-3 pb-2 pt-5 text-center">
          <p
            className="font-mono text-[10px] leading-tight tracking-wide text-muted-foreground"
            title={xrefDisplay}
          >
            {xrefDisplay}
          </p>
          <div
            className="flex items-center justify-center pl-3"
            aria-hidden
          >
            <div className="relative z-10 flex size-[2.75rem] shrink-0 items-center justify-center rounded-full border border-base-content/12 bg-white/10 text-sm font-bold text-base-content">
              {hInitials}
            </div>
            <div className="relative z-20 -ml-3 flex size-[2.75rem] shrink-0 items-center justify-center rounded-full border border-base-content/12 bg-white/16 text-sm font-bold text-base-content">
              {wInitials}
            </div>
          </div>
          <CardTitle className="flex max-w-full flex-wrap items-center justify-center gap-x-1.5 gap-y-1 text-balance text-xl font-semibold leading-snug">
            {partnerLine(record.partner1, record.husbandId)}
            <span className="font-normal text-muted-foreground">·</span>
            {partnerLine(record.partner2, record.wifeId)}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm text-muted-foreground">
          <div className="space-y-1 text-center">
            <p>Married: {record.marriageYear || "—"}</p>
            <p>
              {record.childCount} {record.childCount === 1 ? "child" : "children"}
            </p>
          </div>
          <p
            className="break-all font-mono text-[11px] leading-snug text-base-content/60"
            title={record.id}
          >
            {record.id}
          </p>
        </CardContent>
        <CardActionFooter onView={onView} onEdit={onEdit} onDelete={onDelete} />
      </Card>
      );
    },
    actions: {
      add: {
        label: "Add family",
        handler: () => {
          router.push("/admin/families/create");
        },
      },
      view: { label: "View", handler: (r) => router.push(`/admin/families/${r.id}`) },
      edit: { label: "Edit", handler: (r) => router.push(`/admin/families/${r.id}/edit`) },
      delete: { label: "Delete", handler: onDelete },
    },
  };
}

export default function AdminFamiliesPage() {
  const router = useRouter();
  const deleteFamily = useDeleteFamily();
  const { draft: filterDraft, queryOpts, updateDraft, apply: applyFilters, clear: clearFilters } =
    useAdminFamiliesPageFilters();

  const { data, isLoading } = useAdminFamilies(queryOpts);

  const handleDelete = useCallback(
    async (r: FamilyRow) => {
      const partners = [r.partner1, r.partner2].filter((p) => p !== "—").join(" & ");
      const xref = r.xref.trim();
      const label =
        partners && xref ? `${partners} (${xref})` : partners || xref || r.id;
      if (
        !window.confirm(
          `Delete ${label}? This removes the family record and its links (children in this family, family events, notes, etc.). Individuals are not deleted. This cannot be undone.`,
        )
      ) {
        return;
      }
      try {
        await deleteFamily.mutateAsync(r.id);
        toast.success(`Deleted ${label}.`);
      } catch (err) {
        const msg = err instanceof Error ? err.message : "Unknown error";
        toast.error(`Failed to delete ${label}: ${msg}`);
      }
    },
    [deleteFamily],
  );

  const rows = useMemo(() => (data ? mapApiToRows(data) : []), [data]);
  const config = useMemo(() => buildFamiliesConfig(router, handleDelete), [router, handleDelete]);

  return (
    <AdminListPageShell
      title="Families"
      description="Manage family units, partner and child links, events, and notes."
      headerExtra={<p className="text-sm text-muted-foreground">{FAMILY_PARTNER_SLOT_SUBTITLE}</p>}
      filters={
        <FilterPanel onApply={applyFilters} onClear={clearFilters} spacing="space-y-6">
        <div className="space-y-2">
          <Label htmlFor="filter-partner-count">Partners linked</Label>
          <select
            id="filter-partner-count"
            className={selectClassName}
            value={filterDraft.partnerCount}
            onChange={(e) => updateDraft("partnerCount", e.target.value)}
          >
            <option value="">Any</option>
            <option value="two">Two partners</option>
            <option value="one">One partner</option>
          </select>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-3 rounded-box border border-base-content/[0.08] bg-base-content/[0.03] p-4">
            <div>
              <p className="text-sm font-medium">{FAMILY_PARTNER_1_LABEL}</p>
              <p className="text-xs text-muted-foreground">GEDCOM husband (HUSB)</p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="filter-p1-given">Given name contains</Label>
              <Input
                id="filter-p1-given"
                value={filterDraft.p1Given}
                onChange={(e) => updateDraft("p1Given", e.target.value)}
                placeholder="e.g. Alex"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="filter-p1-last">Last name prefix</Label>
              <Input
                id="filter-p1-last"
                value={filterDraft.p1Last}
                onChange={(e) => updateDraft("p1Last", e.target.value)}
                placeholder="GEDCOM slash-aware"
              />
            </div>
          </div>
          <div className="space-y-3 rounded-box border border-base-content/[0.08] bg-base-content/[0.03] p-4">
            <div>
              <p className="text-sm font-medium">{FAMILY_PARTNER_2_LABEL}</p>
              <p className="text-xs text-muted-foreground">GEDCOM wife (WIFE)</p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="filter-p2-given">Given name contains</Label>
              <Input
                id="filter-p2-given"
                value={filterDraft.p2Given}
                onChange={(e) => updateDraft("p2Given", e.target.value)}
                placeholder="e.g. Jordan"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="filter-p2-last">Last name prefix</Label>
              <Input
                id="filter-p2-last"
                value={filterDraft.p2Last}
                onChange={(e) => updateDraft("p2Last", e.target.value)}
                placeholder="GEDCOM slash-aware"
              />
            </div>
          </div>
        </div>
        <p className="text-xs text-muted-foreground">{FAMILY_LIST_FILTER_PARTNER_COLUMNS_HELP}</p>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <div className="space-y-2">
            <Label htmlFor="filter-children-op">Children count</Label>
            <select
              id="filter-children-op"
              className={selectClassName}
              value={filterDraft.childrenOp}
              onChange={(e) => updateDraft("childrenOp", e.target.value)}
            >
              <option value="">Any</option>
              <option value="gt">Greater than</option>
              <option value="lt">Less than</option>
              <option value="eq">Equal to</option>
            </select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="filter-children-n">Number of children</Label>
            <Input
              id="filter-children-n"
              type="number"
              inputMode="numeric"
              min={0}
              value={filterDraft.childrenCount}
              onChange={(e) => updateDraft("childrenCount", e.target.value)}
              placeholder="e.g. 2"
              disabled={!filterDraft.childrenOp}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="filter-marriage">Marriage date</Label>
            <select
              id="filter-marriage"
              className={selectClassName}
              value={filterDraft.hasMarriageDate}
              onChange={(e) => updateDraft("hasMarriageDate", e.target.value)}
            >
              <option value="">Any</option>
              <option value="true">Has marriage date</option>
              <option value="false">No marriage date</option>
            </select>
          </div>
        </div>
        </FilterPanel>
      }
    >
      <DataViewer
        config={config}
        data={rows}
        isLoading={isLoading}
        viewModeKey="admin-families-view"
        totalCount={data?.total}
      />
    </AdminListPageShell>
  );
}
