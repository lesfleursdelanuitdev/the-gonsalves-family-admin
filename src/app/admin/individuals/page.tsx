"use client";

import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  IconGenderFemale,
  IconGenderMale,
  IconHelpCircle,
} from "@tabler/icons-react";
import { GedcomEventTypeIcon } from "@/components/admin/GedcomEventTypeIcon";
import {
  DataViewer,
  DataViewerGedcomBatchEditModal,
  type DataViewerConfig,
} from "@/components/data-viewer";
import { FilterPanel } from "@/components/data-viewer/FilterPanel";
import { selectClassName } from "@/components/data-viewer/constants";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  useAdminIndividuals,
  type AdminIndividualsListResponse,
  type UseAdminIndividualsOpts,
} from "@/hooks/useAdminIndividuals";
import { useFilterState } from "@/hooks/useFilterState";
import { ADMIN_LIST_MAX_LIMIT } from "@/constants/admin";
import { formatDisplayNameFromNameForms, initialsFromPersonLabel } from "@/lib/gedcom/display-name";
import {
  ADMIN_INDIVIDUALS_FILTER_DEFAULTS,
  adminIndividualsPathWithFilters,
  hasAdminIndividualsFilterQueryKeys,
  mergeAdminIndividualsFilterDefaults,
  parseAdminIndividualsFiltersFromSearchParams,
  type AdminIndividualsUrlFilterState,
} from "@/lib/admin/admin-individuals-url-filters";
import { Eye, Pencil, Trash2 } from "lucide-react";
import { deleteJson } from "@/lib/infra/api";
import {
  photoUrlFromProfileRow,
  type ProfileMediaSelectionShape,
} from "@/components/admin/EntityGedcomProfileMediaSection";

interface IndividualRow {
  id: string;
  xref: string;
  displayName: string;
  sex: string;
  birthYear: string;
  deathYear: string;
  profileMediaSelection: ProfileMediaSelectionShape;
}

function IndividualGridAvatar({
  initials,
  profileSelection,
}: {
  initials: string;
  profileSelection: ProfileMediaSelectionShape;
}) {
  const url = useMemo(() => photoUrlFromProfileRow(profileSelection), [profileSelection]);
  const [imgFailed, setImgFailed] = useState(false);
  useEffect(() => {
    setImgFailed(false);
  }, [url]);

  const circleClass =
    "mx-auto flex size-11 shrink-0 items-center justify-center overflow-hidden rounded-full border border-base-content/12 bg-white/8 text-sm font-bold text-base-content";

  if (url && !imgFailed) {
    return (
      <div className={circleClass} aria-hidden>
        <img src={url} alt="" className="size-full object-cover" onError={() => setImgFailed(true)} />
      </div>
    );
  }
  return (
    <div className={circleClass} aria-hidden>
      {initials}
    </div>
  );
}

type FilterState = AdminIndividualsUrlFilterState;

const tablerIconSm = { size: 18, stroke: 1.5, className: "shrink-0 text-muted-foreground" as const };

const FILTER_DEFAULTS = ADMIN_INDIVIDUALS_FILTER_DEFAULTS;

function mapApiToRows(api: AdminIndividualsListResponse): IndividualRow[] {
  return (api?.individuals ?? []).map((ind) => ({
    id: ind.id,
    xref: ind.xref ?? "",
    displayName: formatDisplayNameFromNameForms(ind.individualNameForms, ind.fullName),
    sex: ind.sex ?? "",
    birthYear: ind.birthYear != null ? String(ind.birthYear) : "",
    deathYear: ind.deathYear != null ? String(ind.deathYear) : "",
    profileMediaSelection: (ind.profileMediaSelection ?? null) as ProfileMediaSelectionShape,
  }));
}

function buildIndividualsConfig(
  router: ReturnType<typeof useRouter>,
  onDelete: (r: IndividualRow) => void,
  bulkDeleteOne: (id: string) => Promise<void>,
  onBulkEdit: (ids: string[]) => void,
): DataViewerConfig<IndividualRow> {
  return {
    id: "individuals",
    labels: { singular: "Individual", plural: "Individuals" },
    getRowId: (row) => row.id,
    enableRowSelection: true,
    columns: [
      {
        accessorKey: "id",
        header: "UUID",
        enableSorting: true,
        cell: ({ row }) => (
          <span
            className="font-mono text-[11px] text-muted-foreground max-w-[8rem] truncate block"
            title={row.getValue("id") as string}
          >
            {(row.getValue("id") as string).slice(0, 8)}…
          </span>
        ),
      },
      { accessorKey: "xref", header: "XREF", enableSorting: true },
      { accessorKey: "displayName", header: "Name", enableSorting: true },
      {
        accessorKey: "sex",
        header: "Sex",
        cell: ({ row }) => {
          const v = row.getValue("sex") as string;
          return v === "M" ? "Male" : v === "F" ? "Female" : v || "—";
        },
      },
      { accessorKey: "birthYear", header: "Birth" },
      { accessorKey: "deathYear", header: "Death", cell: ({ row }) => (row.getValue("deathYear") as string) || "—" },
    ],
    renderCard: ({ record, onView, onEdit, onDelete }) => {
      const xrefDisplay = record.xref.trim() || "—";
      const nameDisplay = record.displayName.trim() || "—";
      const birthDisplay = record.birthYear.trim() || "—";
      const deathDisplay = record.deathYear.trim() || "—";
      const sexLabel =
        record.sex === "M" ? "Male" : record.sex === "F" ? "Female" : "Unknown";
      const sexIcon =
        record.sex === "M" ? (
          <IconGenderMale {...tablerIconSm} aria-hidden />
        ) : record.sex === "F" ? (
          <IconGenderFemale {...tablerIconSm} aria-hidden />
        ) : (
          <IconHelpCircle {...tablerIconSm} aria-hidden />
        );
      const avatarInitials = initialsFromPersonLabel(nameDisplay);

      return (
      <Card className="group overflow-hidden border-base-content/12 bg-base-100/95 transition-all hover:-translate-y-0.5 hover:border-primary/30 hover:shadow-md hover:shadow-black/20">
        <CardHeader className="space-y-2 pb-2 pt-3 text-center">
          <div className="flex justify-center">
            <span
              className="inline-flex max-w-full items-center rounded-full border border-base-content/15 bg-base-content/[0.03] px-2.5 py-0.5 font-mono text-[10px] leading-tight tracking-wide text-base-content/70"
              title={xrefDisplay}
            >
              {xrefDisplay}
            </span>
          </div>
          <IndividualGridAvatar initials={avatarInitials} profileSelection={record.profileMediaSelection} />
          <CardTitle className="text-balance text-base font-semibold leading-tight text-base-content sm:text-lg">
            {nameDisplay}
          </CardTitle>
          <p className="flex flex-wrap items-center justify-center gap-1.5 text-xs text-muted-foreground">
            {sexIcon}
            <span>{sexLabel}</span>
          </p>
        </CardHeader>
        <CardContent className="space-y-3 pb-3 pt-1 text-sm">
          <div className="grid grid-cols-2 gap-2 rounded-md border border-base-content/10 bg-base-content/[0.02] px-2.5 py-2">
            <p className="flex min-w-0 items-center gap-1.5 text-xs">
              <GedcomEventTypeIcon eventType="BIRT" className="size-4 shrink-0 text-muted-foreground" />
              <span className="font-medium text-base-content/80">Birth</span>
              <span className="ml-auto text-muted-foreground">{birthDisplay}</span>
            </p>
            <p className="flex min-w-0 items-center gap-1.5 text-xs">
              <GedcomEventTypeIcon
                eventType="DEAT"
                className="size-4 shrink-0 text-muted-foreground"
              />
              <span className="font-medium text-base-content/80">Death</span>
              <span className="ml-auto text-muted-foreground">{deathDisplay}</span>
            </p>
          </div>
          <div
            className="truncate rounded-md border border-base-content/10 bg-base-content/[0.015] px-2 py-1 text-center font-mono text-[10px] leading-tight text-base-content/45"
            title={record.id}
          >
            {record.id}
          </div>
        </CardContent>
        <div className="grid grid-cols-3 divide-x divide-base-content/10 border-t border-base-content/10 bg-base-content/[0.015]">
          <Button
            variant="ghost"
            size="icon-sm"
            className="h-9 w-full rounded-none border-0 text-base-content/70 hover:bg-base-content/[0.04] hover:text-base-content focus-visible:z-10"
            onClick={onView}
            aria-label={`View ${nameDisplay}`}
            title="View"
          >
            <Eye className="size-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon-sm"
            className="h-9 w-full rounded-none border-0 text-base-content/70 hover:bg-base-content/[0.04] hover:text-base-content focus-visible:z-10"
            onClick={onEdit}
            aria-label={`Edit ${nameDisplay}`}
            title="Edit"
          >
            <Pencil className="size-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon-sm"
            className="h-9 w-full rounded-none border-0 text-base-content/55 hover:bg-destructive/10 hover:text-destructive focus-visible:z-10 focus-visible:text-destructive"
            onClick={onDelete}
            aria-label={`Delete ${nameDisplay}`}
            title="Delete"
          >
            <Trash2 className="size-4" />
          </Button>
        </div>
      </Card>
      );
    },
    actions: {
      add: { label: "Add individual", handler: () => router.push("/admin/individuals/new") },
      view: { label: "View", handler: (r) => router.push(`/admin/individuals/${r.id}`) },
      edit: { label: "Edit", handler: (r) => router.push(`/admin/individuals/${r.id}/edit`) },
      bulkEdit: { label: "Edit selected", handler: onBulkEdit },
      delete: { label: "Delete", handler: onDelete, bulkDeleteOne },
    },
  };
}

function filterStateToQueryOpts(applied: FilterState): UseAdminIndividualsOpts {
  const opts: UseAdminIndividualsOpts = {
    limit: ADMIN_LIST_MAX_LIMIT,
    offset: 0,
  };
  const qq = applied.q.trim();
  if (qq) opts.q = qq;
  if (applied.sex) opts.sex = applied.sex;
  if (applied.living === "true" || applied.living === "false") {
    opts.living = applied.living;
  }
  const gn = applied.givenName.trim();
  const ln = applied.lastName.trim();
  if (gn) opts.givenName = gn;
  if (ln) opts.lastName = ln;
  const byMin = applied.birthYearMin.trim();
  const byMax = applied.birthYearMax.trim();
  const dyMin = applied.deathYearMin.trim();
  const dyMax = applied.deathYearMax.trim();
  if (byMin) opts.birthYearMin = byMin;
  if (byMax) opts.birthYearMax = byMax;
  if (dyMin) opts.deathYearMin = dyMin;
  if (dyMax) opts.deathYearMax = dyMax;
  return opts;
}

function AdminIndividualsPageInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const queryClient = useQueryClient();
  const lastHydratedQsRef = useRef<string | null>(null);
  const [batchEditOpen, setBatchEditOpen] = useState(false);
  const [batchEditIds, setBatchEditIds] = useState<string[]>([]);
  const [batchApplyKey, setBatchApplyKey] = useState<number | undefined>();
  const { draft: filterDraft, queryOpts, updateDraft, apply, clear, replace } = useFilterState(
    FILTER_DEFAULTS,
    filterStateToQueryOpts,
  );

  const qs = searchParams.toString();
  useLayoutEffect(() => {
    if (!hasAdminIndividualsFilterQueryKeys(searchParams)) {
      if (lastHydratedQsRef.current != null && lastHydratedQsRef.current !== "" && qs === "") {
        replace({ ...FILTER_DEFAULTS });
      }
      lastHydratedQsRef.current = qs;
      return;
    }
    if (lastHydratedQsRef.current === qs) return;
    lastHydratedQsRef.current = qs;
    replace(
      mergeAdminIndividualsFilterDefaults(parseAdminIndividualsFiltersFromSearchParams(searchParams)),
    );
  }, [qs, replace, searchParams]);

  const applyFilters = useCallback(() => {
    apply();
    router.replace(adminIndividualsPathWithFilters(filterDraft), { scroll: false });
  }, [apply, filterDraft, router]);

  const clearFilters = useCallback(() => {
    clear();
    router.replace("/admin/individuals", { scroll: false });
  }, [clear, router]);

  const { data, isLoading } = useAdminIndividuals(queryOpts);

  const handleDelete = useCallback(
    async (r: IndividualRow) => {
      const name = r.displayName || r.xref || r.id;
      if (!window.confirm(`Are you sure you want to delete ${name}? This will remove them and all their associated data (events, family links, etc.). This action cannot be undone.`)) {
        return;
      }
      try {
        const res = await fetch(`/api/admin/individuals/${r.id}`, { method: "DELETE" });
        if (!res.ok) {
          const body = await res.json().catch(() => null);
          throw new Error(body?.error ?? `Server returned ${res.status}`);
        }
        toast.success(`Deleted ${name}.`);
        await queryClient.invalidateQueries({ queryKey: ["admin", "individuals"] });
      } catch (err) {
        const msg = err instanceof Error ? err.message : "Unknown error";
        toast.error(`Failed to delete ${name}: ${msg}`);
      }
    },
    [queryClient],
  );

  const bulkDeleteOneIndividual = useCallback(async (id: string) => {
    await deleteJson(`/api/admin/individuals/${id}`);
  }, []);

  const handleBulkDeleteFinished = useCallback(() => {
    void queryClient.invalidateQueries({ queryKey: ["admin", "individuals"] });
  }, [queryClient]);

  const openBulkEdit = useCallback((ids: string[]) => {
    setBatchEditIds(ids);
    setBatchEditOpen(true);
  }, []);

  const rows = useMemo(() => (data ? mapApiToRows(data) : []), [data]);
  const config = useMemo(
    () => buildIndividualsConfig(router, handleDelete, bulkDeleteOneIndividual, openBulkEdit),
    [router, handleDelete, bulkDeleteOneIndividual, openBulkEdit],
  );

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Individuals</h1>
        <p className="text-muted-foreground">
          Add, edit, and remove people. The toolbar search and filters share one Apply step; applying updates the URL so
          views can be bookmarked or opened from Given names.
        </p>
      </div>

      <FilterPanel onApply={applyFilters} onClear={clearFilters}>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <div className="space-y-2 sm:col-span-2 lg:col-span-3">
            <Label htmlFor="filter-q">Search (q)</Label>
            <Input
              id="filter-q"
              value={filterDraft.q}
              onChange={(e) => updateDraft("q", e.target.value)}
              placeholder="Matches display / name text (same as API q)"
            />
            <p className="text-xs text-muted-foreground">
              Click <span className="font-medium">Apply filters</span> to run search and filters together.
            </p>
          </div>
          <div className="space-y-2">
            <Label htmlFor="filter-given">Given name contains</Label>
            <Input
              id="filter-given"
              value={filterDraft.givenName}
              onChange={(e) => updateDraft("givenName", e.target.value)}
              placeholder="e.g. Maria"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="filter-last">Last name prefix</Label>
            <Input
              id="filter-last"
              value={filterDraft.lastName}
              onChange={(e) => updateDraft("lastName", e.target.value)}
              placeholder="GEDCOM slash-aware prefix"
            />
            <p className="text-xs text-muted-foreground">Matches surnames in slashes, same idea as the public tree.</p>
          </div>
          <div className="space-y-2">
            <Label htmlFor="filter-sex">Sex</Label>
            <select
              id="filter-sex"
              className={selectClassName}
              value={filterDraft.sex}
              onChange={(e) => updateDraft("sex", e.target.value)}
            >
              <option value="">Any</option>
              <option value="M">Male</option>
              <option value="F">Female</option>
              <option value="U">Unknown</option>
              <option value="X">Other</option>
            </select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="filter-living">Living status</Label>
            <select
              id="filter-living"
              className={selectClassName}
              value={filterDraft.living}
              onChange={(e) => updateDraft("living", e.target.value)}
            >
              <option value="">Any</option>
              <option value="true">Living</option>
              <option value="false">Deceased</option>
            </select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="filter-bymin">Birth year min</Label>
            <Input
              id="filter-bymin"
              type="number"
              inputMode="numeric"
              value={filterDraft.birthYearMin}
              onChange={(e) => updateDraft("birthYearMin", e.target.value)}
              placeholder="e.g. 1850"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="filter-bymax">Birth year max</Label>
            <Input
              id="filter-bymax"
              type="number"
              inputMode="numeric"
              value={filterDraft.birthYearMax}
              onChange={(e) => updateDraft("birthYearMax", e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="filter-dymin">Death year min</Label>
            <Input
              id="filter-dymin"
              type="number"
              inputMode="numeric"
              value={filterDraft.deathYearMin}
              onChange={(e) => updateDraft("deathYearMin", e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="filter-dymax">Death year max</Label>
            <Input
              id="filter-dymax"
              type="number"
              inputMode="numeric"
              value={filterDraft.deathYearMax}
              onChange={(e) => updateDraft("deathYearMax", e.target.value)}
            />
          </div>
        </div>
      </FilterPanel>

      <DataViewerGedcomBatchEditModal
        open={batchEditOpen}
        onOpenChange={setBatchEditOpen}
        entityKind="individual"
        selectedIds={batchEditIds}
        onApplied={() => {
          setBatchApplyKey((k) => (k ?? 0) + 1);
          void queryClient.invalidateQueries({ queryKey: ["admin", "individuals"] });
        }}
      />

      <DataViewer
        config={config}
        data={rows}
        isLoading={isLoading}
        viewModeKey="admin-individuals-view"
        paginationResetKey={JSON.stringify(queryOpts)}
        totalCount={data?.total}
        batchApplyKey={batchApplyKey}
        onBulkDeleteFinished={handleBulkDeleteFinished}
      />
    </div>
  );
}

export default function AdminIndividualsPage() {
  return (
    <Suspense
      fallback={
        <div className="space-y-6">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">Individuals</h1>
            <p className="text-muted-foreground">Loading…</p>
          </div>
        </div>
      }
    >
      <AdminIndividualsPageInner />
    </Suspense>
  );
}
