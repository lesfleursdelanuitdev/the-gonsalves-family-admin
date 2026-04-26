"use client";

import { useMemo } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { CaseUpper } from "lucide-react";
import { DataViewer, type DataViewerConfig } from "@/components/data-viewer";
import { CardActionFooter } from "@/components/data-viewer/CardActionFooter";
import { FilterPanel } from "@/components/data-viewer/FilterPanel";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  useAdminSurnames,
  type AdminSurnameListItem,
  type AdminSurnamesListResponse,
} from "@/hooks/useAdminGedcomCatalogs";
import { AdminListPageShell } from "@/components/admin/AdminListPageShell";
import { useAdminListQFilters } from "@/hooks/useAdminListQFilters";
import {
  adminCatalogToIndividualsLinkClass,
  adminIndividualsHrefForSurname,
} from "@/lib/admin/admin-individuals-url-filters";
import { stripSlashesFromName } from "@/lib/gedcom/display-name";
import { cn } from "@/lib/utils";

interface SurnameRow {
  id: string;
  surname: string;
  displaySurname: string;
  frequency: number;
  soundex: string;
  metaphone: string;
}

function mapApiToRows(api: AdminSurnamesListResponse): SurnameRow[] {
  return (api?.surnames ?? []).map((s: AdminSurnameListItem) => ({
    id: s.id,
    surname: s.surname,
    displaySurname: stripSlashesFromName(s.surname) || s.surname,
    frequency: s.frequency,
    soundex: s.soundex ?? "—",
    metaphone: s.metaphone ?? "—",
  }));
}

function buildSurnamesConfig(router: ReturnType<typeof useRouter>): DataViewerConfig<SurnameRow> {
  return {
    id: "surnames",
    labels: { singular: "Surname", plural: "Surnames" },
    getRowId: (row) => row.id,
    defaultSorting: [{ id: "displaySurname", desc: false }],
    enableRowSelection: false,
    columns: [
      {
        accessorKey: "displaySurname",
        header: "Surname",
        enableSorting: true,
        cell: ({ row }) => {
          const r = row.original;
          return (
            <Link
              href={adminIndividualsHrefForSurname(r.surname)}
              className={cn(adminCatalogToIndividualsLinkClass, "inline-block max-w-[min(100%,20rem)] truncate")}
              title={`Individuals with surname prefix “${r.displaySurname}” (GEDCOM-aware)`}
            >
              {r.displaySurname}
            </Link>
          );
        },
      },
      { accessorKey: "frequency", header: "Frequency", enableSorting: true },
      { accessorKey: "soundex", header: "Soundex", enableSorting: true },
      { accessorKey: "metaphone", header: "Metaphone", enableSorting: true },
    ],
    renderCard: ({ record, onView }) => (
      <Card>
        <CardHeader className="pb-2">
          <div className="flex items-center gap-2">
            <CaseUpper className="size-5 text-muted-foreground" aria-hidden />
            <CardTitle className="text-base font-medium">
              <Link
                href={adminIndividualsHrefForSurname(record.surname)}
                className={adminCatalogToIndividualsLinkClass}
              >
                {record.displaySurname}
              </Link>
            </CardTitle>
          </div>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground">
          <p>Frequency: {record.frequency.toLocaleString()}</p>
          <p className="text-xs">
            {record.soundex} / {record.metaphone}
          </p>
        </CardContent>
        <CardActionFooter onView={onView} />
      </Card>
    ),
    actions: {
      view: {
        label: "View",
        handler: (r) => router.push(`/admin/surnames/${r.id}`),
      },
    },
  };
}

export default function AdminSurnamesPage() {
  const router = useRouter();
  const { draft, applied, queryOpts, updateDraft, apply: applyFilters, clear: clearFilters } =
    useAdminListQFilters();

  const { data, isLoading } = useAdminSurnames(queryOpts);

  const rows = useMemo(() => (data ? mapApiToRows(data) : []), [data]);
  const config = useMemo(() => buildSurnamesConfig(router), [router]);

  return (
    <AdminListPageShell
      title="Surnames"
      description="Deduplicated surname tokens for this tree (read-only). Click a surname to open Individuals with the last-name prefix filter applied (same GEDCOM slash-aware rules as the filter panel). Change names on individuals or families to alter catalog entries."
      filters={
        <FilterPanel onApply={applyFilters} onClear={clearFilters}>
          <div className="space-y-2">
            <Label htmlFor="surnames-filter-q">Search surnames</Label>
            <Input
              id="surnames-filter-q"
              value={draft.q}
              onChange={(e) => updateDraft("q", e.target.value)}
              placeholder="Substring in catalog surname token"
            />
            <p className="text-xs text-muted-foreground">
              Click Apply to narrow the list before opening links to Individuals.
            </p>
          </div>
        </FilterPanel>
      }
    >
      <DataViewer
        config={config}
        data={rows}
        isLoading={isLoading}
        viewModeKey="admin-surnames-view"
        paginationResetKey={applied.q}
        totalCount={data?.total}
      />
    </AdminListPageShell>
  );
}
