"use client";

import { useCallback, useLayoutEffect, useMemo, useRef, useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  DataViewer,
  type DataViewerConfig,
} from "@/components/data-viewer";
import { FilterPanel } from "@/components/data-viewer/FilterPanel";
import { selectClassName } from "@/components/data-viewer/constants";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Eye, Pencil, Trash2 } from "lucide-react";
import { deleteJson } from "@/lib/infra/api";
import { cn } from "@/lib/utils";
import { useFilterState } from "@/hooks/useFilterState";
import { ADMIN_LIST_MAX_LIMIT } from "@/constants/admin";
import { formatDisplayNameFromNameForms, stripSlashesFromName } from "@/lib/gedcom/display-name";
import {
  GEDCOM_ATTRIBUTE_TYPE_LABELS,
  INDIVIDUAL_ATTRIBUTE_TAG_LIST,
  labelGedcomAttributeType,
} from "@/lib/gedcom/gedcom-attribute-labels";
import {
  ADMIN_ATTRIBUTES_FILTER_DEFAULTS,
  adminAttributesPathWithFilters,
  hasAdminAttributesFilterQueryKeys,
  mergeAdminAttributesFilterDefaults,
  parseAdminAttributesFiltersFromSearchParams,
  type AdminAttributesUrlFilterState,
} from "@/lib/admin/admin-attributes-url-filters";
import {
  ADMIN_ATTRIBUTES_QUERY_KEY,
  useAdminAttributes,
  useDeleteAttribute,
  type AdminAttributesListResponse,
  type UseAdminAttributesOpts,
} from "@/hooks/useAdminAttributes";

const ATTRIBUTE_TYPE_TAGS = [...INDIVIDUAL_ATTRIBUTE_TAG_LIST].sort();

type FilterState = AdminAttributesUrlFilterState;
const FILTER_DEFAULTS = ADMIN_ATTRIBUTES_FILTER_DEFAULTS;

interface LinkedRef { id: string; label: string }

interface AttributeRow {
  id: string;
  attributeType: string;
  typeLabel: string;
  customType: string;
  value: string;
  date: string;
  place: string;
  linkedTo: string;
  linkedType: "individual" | "family" | "none";
  linkedIndividualId: string | null;
}

function mapApiToRows(api: AdminAttributesListResponse): AttributeRow[] {
  return (api?.attributes ?? []).map((attr) => {
    const dateStr =
      attr.date?.original ??
      (attr.date?.year != null
        ? [attr.date.year, attr.date.month, attr.date.day].filter(Boolean).join("-")
        : "");
    const placeStr = (attr.place?.original ?? attr.place?.name ?? "").trim();
    const typeLabel = labelGedcomAttributeType(attr.attributeType, attr.customType);
    const customType = (attr.customType ?? "").trim();

    let linkedTo = "—";
    let linkedType: AttributeRow["linkedType"] = "none";
    let linkedIndividualId: string | null = null;

    if (attr.individualAttributes?.length) {
      const people: LinkedRef[] = attr.individualAttributes.map((ia) => ({
        id: ia.individual.id,
        label:
          formatDisplayNameFromNameForms(ia.individual.individualNameForms, ia.individual.fullName) ||
          stripSlashesFromName(ia.individual.fullName ?? "") || "—",
      }));
      linkedIndividualId = people[0].id;
      linkedTo = people.map((p) => p.label).join(" · ");
      linkedType = "individual";
    } else if (attr.familyAttributes?.[0]) {
      const fam = attr.familyAttributes[0].family;
      const h = fam.husband ? stripSlashesFromName(fam.husband.fullName ?? "") : null;
      const w = fam.wife ? stripSlashesFromName(fam.wife.fullName ?? "") : null;
      linkedTo = [h, w].filter(Boolean).join(" · ") || "Family";
      linkedType = "family";
    }

    return {
      id: attr.id,
      attributeType: attr.attributeType,
      typeLabel,
      customType,
      value: (attr.value ?? "").trim(),
      date: dateStr,
      place: placeStr,
      linkedTo,
      linkedType,
      linkedIndividualId,
    };
  });
}

function buildAttributesConfig(
  router: ReturnType<typeof useRouter>,
  onDelete: (r: AttributeRow) => void,
  bulkDeleteOne: (id: string) => Promise<void>,
): DataViewerConfig<AttributeRow> {
  return {
    id: "attributes",
    labels: { singular: "Attribute", plural: "Attributes" },
    getRowId: (row) => row.id,
    enableRowSelection: false,
    columns: [
      {
        accessorKey: "id",
        header: "UUID",
        cell: ({ row }) => (
          <span
            className="font-mono text-[11px] text-muted-foreground max-w-[8rem] truncate block"
            title={row.getValue("id") as string}
          >
            {(row.getValue("id") as string).slice(0, 8)}…
          </span>
        ),
      },
      {
        accessorKey: "attributeType",
        header: "Type",
        enableSorting: true,
        cell: ({ row }) => {
          const r = row.original;
          return (
            <span className="inline-flex flex-wrap items-center gap-2">
              <span className="font-medium text-base-content">{r.typeLabel}</span>
              {r.customType ? (
                <span className="text-xs text-muted-foreground">({r.customType})</span>
              ) : null}
            </span>
          );
        },
      },
      {
        accessorKey: "value",
        header: "Value",
        cell: ({ row }) => {
          const v = (row.getValue("value") as string).trim();
          return v ? (
            <span className="max-w-[16rem] truncate block" title={v}>{v}</span>
          ) : (
            <span className="text-muted-foreground">—</span>
          );
        },
      },
      {
        accessorKey: "date",
        header: "Date",
        cell: ({ row }) => {
          const v = (row.getValue("date") as string).trim();
          return v || <span className="text-muted-foreground">—</span>;
        },
      },
      {
        accessorKey: "place",
        header: "Place",
        cell: ({ row }) => {
          const v = (row.getValue("place") as string).trim();
          return v ? (
            <span className="max-w-[14rem] truncate block" title={v}>{v}</span>
          ) : (
            <span className="text-muted-foreground">—</span>
          );
        },
      },
      { accessorKey: "linkedTo", header: "Linked to", enableSorting: true },
    ],
    renderCard: ({ record, onView, onEdit, onDelete: onDel }) => {
      const actionCount = [onView, onEdit, onDel].filter(Boolean).length;
      return (
        <Card className="group overflow-hidden border-base-content/12 bg-base-100/95 transition-all hover:-translate-y-0.5 hover:border-primary/30 hover:shadow-md hover:shadow-black/20">
          <CardHeader className="space-y-1 pb-2 pt-3">
            <div className="flex items-center gap-2">
              <span className="rounded bg-primary/10 px-2 py-0.5 text-xs font-semibold text-primary">
                {record.attributeType}
              </span>
              {record.customType ? (
                <span className="text-xs text-muted-foreground">({record.customType})</span>
              ) : null}
            </div>
            <CardTitle className="text-balance text-base font-semibold leading-tight text-base-content">
              {record.typeLabel}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 pb-3 pt-1 text-sm">
            {record.value ? (
              <p className="line-clamp-2 text-base-content/80">{record.value}</p>
            ) : null}
            <div className="grid grid-cols-2 gap-1.5 text-xs text-muted-foreground">
              <span>{record.date || "No date"}</span>
              <span className="truncate">{record.place || "No place"}</span>
            </div>
            <p className="truncate text-xs text-muted-foreground">{record.linkedTo}</p>
          </CardContent>
          {actionCount > 0 ? (
            <div
              className={cn(
                "grid divide-x divide-base-content/10 border-t border-base-content/10 bg-base-content/[0.015]",
                actionCount === 1 ? "grid-cols-1" : actionCount === 2 ? "grid-cols-2" : "grid-cols-3",
              )}
            >
              {onView ? (
                <Button variant="ghost" size="icon-sm" className="h-9 w-full rounded-none border-0 text-base-content/70 hover:bg-base-content/[0.04] hover:text-base-content" onClick={onView} title="View">
                  <Eye className="size-4" />
                </Button>
              ) : null}
              {onEdit ? (
                <Button variant="ghost" size="icon-sm" className="h-9 w-full rounded-none border-0 text-base-content/70 hover:bg-base-content/[0.04] hover:text-base-content" onClick={onEdit} title="Edit">
                  <Pencil className="size-4" />
                </Button>
              ) : null}
              {onDel ? (
                <Button variant="ghost" size="icon-sm" className="h-9 w-full rounded-none border-0 text-base-content/55 hover:bg-destructive/10 hover:text-destructive" onClick={onDel} title="Delete">
                  <Trash2 className="size-4" />
                </Button>
              ) : null}
            </div>
          ) : null}
        </Card>
      );
    },
    actions: {
      add: { label: "Add attribute", handler: () => router.push("/admin/attributes/new") },
      view: { label: "View", handler: (r) => router.push(`/admin/attributes/${r.id}`) },
      edit: { label: "Edit", handler: (r) => router.push(`/admin/attributes/${r.id}/edit`) },
      delete: { label: "Delete", handler: onDelete, bulkDeleteOne },
    },
  };
}

function filterStateToQueryOpts(applied: FilterState): UseAdminAttributesOpts {
  const opts: UseAdminAttributesOpts = { limit: ADMIN_LIST_MAX_LIMIT, offset: 0 };
  if (applied.attributeType) opts.attributeType = applied.attributeType;
  if (applied.customTypeContains.trim()) opts.customTypeContains = applied.customTypeContains.trim();
  if (applied.valueContains.trim()) opts.valueContains = applied.valueContains.trim();
  if (applied.placeContains.trim()) opts.placeContains = applied.placeContains.trim();
  if (applied.linkType === "individual" || applied.linkType === "family") opts.linkType = applied.linkType;
  if (applied.linkedGiven.trim()) opts.linkedGiven = applied.linkedGiven.trim();
  if (applied.linkedLast.trim()) opts.linkedLast = applied.linkedLast.trim();
  return opts;
}

function AdminAttributesPageInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const queryClient = useQueryClient();
  const deleteAttribute = useDeleteAttribute();
  const lastHydratedQsRef = useRef<string | null>(null);

  const { draft: filterDraft, queryOpts, updateDraft, apply, clear, replace } = useFilterState(
    FILTER_DEFAULTS,
    filterStateToQueryOpts,
  );

  const qs = searchParams.toString();
  useLayoutEffect(() => {
    if (!hasAdminAttributesFilterQueryKeys(searchParams)) {
      if (lastHydratedQsRef.current != null && lastHydratedQsRef.current !== "" && qs === "") {
        replace({ ...FILTER_DEFAULTS });
      }
      lastHydratedQsRef.current = qs;
      return;
    }
    if (lastHydratedQsRef.current === qs) return;
    lastHydratedQsRef.current = qs;
    replace(mergeAdminAttributesFilterDefaults(parseAdminAttributesFiltersFromSearchParams(searchParams)));
  }, [qs, replace, searchParams]);

  const applyFilters = useCallback(() => {
    apply();
    router.replace(adminAttributesPathWithFilters(filterDraft), { scroll: false });
  }, [apply, filterDraft, router]);

  const clearFilters = useCallback(() => {
    clear();
    router.replace("/admin/attributes", { scroll: false });
  }, [clear, router]);

  const { data, isLoading } = useAdminAttributes(queryOpts);

  const handleDelete = useCallback(
    (r: AttributeRow) => {
      const label = `${r.typeLabel}${r.customType ? ` (${r.customType})` : ""}`;
      if (!window.confirm(`Delete attribute "${label}" — linked to: ${r.linkedTo}?\n\nThis cannot be undone.`)) return;
      deleteAttribute.mutate(r.id, {
        onSuccess: () => toast.success(`Deleted attribute: ${label}.`),
        onError: (err) => toast.error(err instanceof Error ? err.message : "Failed to delete."),
      });
    },
    [deleteAttribute],
  );

  const bulkDeleteOne = useCallback(async (id: string) => {
    await deleteJson(`/api/admin/attributes/${id}`);
  }, []);

  const handleBulkDeleteFinished = useCallback(() => {
    void queryClient.invalidateQueries({ queryKey: [...ADMIN_ATTRIBUTES_QUERY_KEY] });
  }, [queryClient]);

  const rows = useMemo(() => (data ? mapApiToRows(data) : []), [data]);
  const config = useMemo(
    () => buildAttributesConfig(router, handleDelete, bulkDeleteOne),
    [router, handleDelete, bulkDeleteOne],
  );

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Attributes</h1>
        <p className="text-muted-foreground">
          Personal and family characteristics — occupation, education, religion, nationality, and other
          GEDCOM attribute tags. Separate from events; attributes describe a state rather than an occurrence.
        </p>
      </div>

      <FilterPanel onApply={applyFilters} onClear={clearFilters}>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <div className="space-y-2">
            <Label htmlFor="filter-attr-type">Attribute type</Label>
            <select
              id="filter-attr-type"
              className={selectClassName}
              value={filterDraft.attributeType}
              onChange={(e) => updateDraft("attributeType", e.target.value)}
            >
              <option value="">Any</option>
              {ATTRIBUTE_TYPE_TAGS.map((tag) => (
                <option key={tag} value={tag}>
                  {tag} — {GEDCOM_ATTRIBUTE_TYPE_LABELS[tag] ?? tag}
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="filter-custom-type">Custom type (TYPE) contains</Label>
            <Input
              id="filter-custom-type"
              value={filterDraft.customTypeContains}
              onChange={(e) => updateDraft("customTypeContains", e.target.value)}
              placeholder="e.g. Military service"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="filter-value">Value contains</Label>
            <Input
              id="filter-value"
              value={filterDraft.valueContains}
              onChange={(e) => updateDraft("valueContains", e.target.value)}
              placeholder="e.g. Farmer"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="filter-place">Place contains</Label>
            <Input
              id="filter-place"
              value={filterDraft.placeContains}
              onChange={(e) => updateDraft("placeContains", e.target.value)}
              placeholder="Substring in place text"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="filter-link-type">Link type</Label>
            <select
              id="filter-link-type"
              className={selectClassName}
              value={filterDraft.linkType}
              onChange={(e) => updateDraft("linkType", e.target.value)}
            >
              <option value="">Any</option>
              <option value="individual">Individual</option>
              <option value="family">Family</option>
            </select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="filter-linked-given">Linked person — given name</Label>
            <Input
              id="filter-linked-given"
              value={filterDraft.linkedGiven}
              onChange={(e) => updateDraft("linkedGiven", e.target.value)}
              placeholder="e.g. Maria"
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

      <DataViewer
        config={config}
        data={rows}
        isLoading={isLoading}
        viewModeKey="admin-attributes-view"
        paginationResetKey={JSON.stringify(queryOpts)}
        totalCount={data?.total}
        onBulkDeleteFinished={handleBulkDeleteFinished}
        statisticsAnalyticsSegment="attributes"
      />
    </div>
  );
}

export default function AdminAttributesPage() {
  return (
    <Suspense
      fallback={
        <div className="space-y-6">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">Attributes</h1>
            <p className="text-muted-foreground">Loading…</p>
          </div>
        </div>
      }
    >
      <AdminAttributesPageInner />
    </Suspense>
  );
}
