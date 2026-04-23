"use client";

import { useMemo, useCallback, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { CaseSensitive } from "lucide-react";
import { DataViewer, type DataViewerConfig } from "@/components/data-viewer";
import { ResultCount } from "@/components/data-viewer/ResultCount";
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
  useAdminGivenNames,
  type AdminGivenNameListItem,
  type AdminGivenNamesListResponse,
} from "@/hooks/useAdminGedcomCatalogs";
import { ADMIN_LIST_MAX_LIMIT } from "@/constants/admin";
import {
  adminCatalogToIndividualsLinkClass,
  adminIndividualsHrefForGivenName,
} from "@/lib/admin/admin-individuals-url-filters";
import { cn } from "@/lib/utils";

interface GivenNameRow {
  id: string;
  givenName: string;
  frequency: number;
}

function mapApiToRows(api: AdminGivenNamesListResponse): GivenNameRow[] {
  return (api?.givenNames ?? []).map((g: AdminGivenNameListItem) => ({
    id: g.id,
    givenName: g.givenName,
    frequency: g.frequency,
  }));
}

function buildGivenNamesConfig(router: ReturnType<typeof useRouter>): DataViewerConfig<GivenNameRow> {
  return {
    id: "given-names",
    labels: { singular: "Given name", plural: "Given names" },
    getRowId: (row) => row.id,
    defaultSorting: [{ id: "givenName", desc: false }],
    enableRowSelection: false,
    columns: [
      {
        accessorKey: "givenName",
        header: "Given name",
        enableSorting: true,
        cell: ({ row }) => {
          const name = row.getValue("givenName") as string;
          return (
            <Link
              href={adminIndividualsHrefForGivenName(name)}
              className={cn(adminCatalogToIndividualsLinkClass, "inline-block max-w-[min(100%,20rem)] truncate")}
              title={`Individuals with given name containing “${name}”`}
            >
              {name}
            </Link>
          );
        },
      },
      { accessorKey: "frequency", header: "Frequency", enableSorting: true },
    ],
    renderCard: ({ record, onView }) => (
      <Card>
        <CardHeader className="pb-2">
          <div className="flex items-center gap-2">
            <CaseSensitive className="size-5 text-muted-foreground" aria-hidden />
            <CardTitle className="text-base font-medium">
              <Link
                href={adminIndividualsHrefForGivenName(record.givenName)}
                className={adminCatalogToIndividualsLinkClass}
              >
                {record.givenName}
              </Link>
            </CardTitle>
          </div>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground">
          <p>Frequency: {record.frequency.toLocaleString()}</p>
        </CardContent>
        <CardActionFooter onView={onView} />
      </Card>
    ),
    actions: {
      view: {
        label: "View",
        handler: (r) => router.push(`/admin/given-names/${r.id}`),
      },
    },
  };
}

export default function AdminGivenNamesPage() {
  const router = useRouter();
  const [draftQ, setDraftQ] = useState("");
  const [appliedQ, setAppliedQ] = useState("");
  const applyFilters = useCallback(() => setAppliedQ(draftQ), [draftQ]);
  const clearFilters = useCallback(() => {
    setDraftQ("");
    setAppliedQ("");
  }, []);

  const { data, isLoading } = useAdminGivenNames({
    q: appliedQ.trim() || undefined,
    limit: ADMIN_LIST_MAX_LIMIT,
    offset: 0,
  });

  const rows = useMemo(() => (data ? mapApiToRows(data) : []), [data]);
  const config = useMemo(() => buildGivenNamesConfig(router), [router]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Given names</h1>
        <p className="text-muted-foreground">
          Deduplicated given-name tokens for this tree (read-only). Click a name to open Individuals already filtered to
          people whose structured given names contain that token. Change names on individual records to alter catalog
          entries.
        </p>
      </div>

      <FilterPanel onApply={applyFilters} onClear={clearFilters}>
        <div className="space-y-2">
          <Label htmlFor="given-names-filter-q">Search given names</Label>
          <Input
            id="given-names-filter-q"
            value={draftQ}
            onChange={(e) => setDraftQ(e.target.value)}
            placeholder="Substring in catalog token"
          />
          <p className="text-xs text-muted-foreground">
            Click Apply to narrow the list before opening links to Individuals.
          </p>
        </div>
      </FilterPanel>

      {data && (
        <ResultCount
          total={data.total}
          hasMore={data.hasMore}
          shown={data.givenNames.length}
          isLoading={isLoading}
        />
      )}

      <DataViewer
        config={config}
        data={rows}
        isLoading={isLoading}
        viewModeKey="admin-given-names-view"
        paginationResetKey={appliedQ}
      />
    </div>
  );
}
