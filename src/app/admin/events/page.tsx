"use client";

import { useMemo, useCallback, useLayoutEffect, useRef, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { toast } from "sonner";
import { DataViewer, type DataViewerConfig } from "@/components/data-viewer";
import {
  EventCard,
  EVENT_CARD_MAX_LINKED_INDIVIDUALS,
  type EventCardRecord,
} from "@/components/admin/EventCard";
import { FilterPanel } from "@/components/data-viewer/FilterPanel";
import { selectClassName } from "@/components/data-viewer/constants";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  useAdminEvents,
  useDeleteEvent,
  type AdminEventsListResponse,
  type UseAdminEventsOpts,
} from "@/hooks/useAdminEvents";
import { useFilterState } from "@/hooks/useFilterState";
import { ADMIN_LIST_MAX_LIMIT } from "@/constants/admin";
import { formatDisplayNameFromNameForms, stripSlashesFromName } from "@/lib/gedcom/display-name";
import { labelGedcomEventType, GEDCOM_EVENT_TYPE_LABELS } from "@/lib/gedcom/gedcom-event-labels";
import { GedcomEventTypeIcon } from "@/components/admin/GedcomEventTypeIcon";
import {
  ADMIN_EVENTS_FILTER_DEFAULTS,
  adminEventsPathWithFilters,
  hasAdminEventsFilterQueryKeys,
  mergeAdminEventsFilterDefaults,
  parseAdminEventsFiltersFromSearchParams,
  type AdminEventsUrlFilterState,
} from "@/lib/admin/admin-events-url-filters";

const EVENT_TYPE_TAGS = Object.keys(GEDCOM_EVENT_TYPE_LABELS).sort();

interface LinkedPersonRef {
  id: string;
  label: string;
}

interface EventRow extends EventCardRecord {
  linkedTo: string;
  linkedFamilyXref: string | null;
}

type FilterState = AdminEventsUrlFilterState;
const FILTER_DEFAULTS = ADMIN_EVENTS_FILTER_DEFAULTS;

function formatLinkedIndividualsTableText(people: readonly { label: string }[]): string {
  const labels = people.map((p) => p.label.trim()).filter((l) => l && l !== "—");
  if (labels.length === 0) return "—";
  const head = labels.slice(0, EVENT_CARD_MAX_LINKED_INDIVIDUALS);
  const extra = labels.length - EVENT_CARD_MAX_LINKED_INDIVIDUALS;
  if (extra <= 0) return head.join(" · ");
  return `${head.join(" · ")} +${extra} more`;
}

function mapApiToRows(api: AdminEventsListResponse): EventRow[] {
  return (api?.events ?? []).map((ev) => {
    const dateStr =
      ev.date?.original ??
      (ev.date?.year != null
        ? [ev.date.year, ev.date.month, ev.date.day].filter((x) => x != null).join("-")
        : "");
    const placeStr = (ev.place?.original ?? ev.place?.name ?? "").trim();
    const typeLabel = labelGedcomEventType(ev.eventType ?? "");
    const customType = (ev.customType ?? "").trim();

    let linkedTo = "—";
    let linkedPersonDisplay: string | null = null;
    let linkedType: EventRow["linkedType"] = "none";
    let linkedIndividualId: string | null = null;
    let linkedFamilyId: string | null = null;
    let linkedFamilyXref: string | null = null;
    let linkedFamilyHusband: LinkedPersonRef | null = null;
    let linkedFamilyWife: LinkedPersonRef | null = null;
    let linkedIndividuals: LinkedPersonRef[] = [];

    if (ev.individualEvents?.length) {
      const seen = new Set<string>();
      for (const ie of ev.individualEvents) {
        const ind = ie?.individual;
        if (!ind?.id || seen.has(ind.id)) continue;
        seen.add(ind.id);
        const label =
          formatDisplayNameFromNameForms(ind.individualNameForms, ind.fullName) ||
          stripSlashesFromName(ind.fullName) ||
          "—";
        linkedIndividuals.push({ id: ind.id, label });
      }
    }
    if (linkedIndividuals.length > 0) {
      linkedIndividualId = linkedIndividuals[0].id;
      linkedTo = formatLinkedIndividualsTableText(linkedIndividuals);
      const first = linkedIndividuals[0].label;
      linkedPersonDisplay = first && first !== "—" ? first : null;
      linkedType = "individual";
    } else if (ev.familyEvents?.[0]) {
      const fam = ev.familyEvents[0].family;
      linkedFamilyId = fam.id;
      linkedFamilyXref = (fam.xref ?? "").trim() || null;
      const h = fam.husband;
      const w = fam.wife;
      if (h?.id) {
        linkedFamilyHusband = {
          id: h.id,
          label: stripSlashesFromName(h.fullName) || "—",
        };
      }
      if (w?.id) {
        linkedFamilyWife = {
          id: w.id,
          label: stripSlashesFromName(w.fullName) || "—",
        };
      }
      const hLabel = linkedFamilyHusband?.label;
      const wLabel = linkedFamilyWife?.label;
      const partners = [hLabel, wLabel].filter((x) => x && x !== "—") as string[];
      linkedTo = partners.length > 0 ? partners.join(" · ") : "Family";
      linkedType = "family";
    }

    return {
      id: ev.id,
      eventType: ev.eventType ?? "",
      typeLabel,
      customType,
      date: dateStr,
      place: placeStr,
      linkedTo,
      linkedPersonDisplay,
      linkedType,
      linkedIndividualId,
      linkedIndividuals,
      linkedFamilyId,
      linkedFamilyXref,
      linkedFamilyHusband,
      linkedFamilyWife,
    };
  });
}

function buildEventsConfig(
  router: ReturnType<typeof useRouter>,
  onDelete: (r: EventRow) => void,
): DataViewerConfig<EventRow> {
  return {
    id: "events",
    labels: { singular: "Event", plural: "Events" },
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
      {
        accessorKey: "eventType",
        header: "Type",
        enableSorting: true,
        cell: ({ row }) => {
          const r = row.original;
          return (
            <span className="inline-flex max-w-[min(100%,18rem)] flex-wrap items-center gap-2">
              <GedcomEventTypeIcon eventType={r.eventType} />
              <span className="font-medium text-base-content">{r.typeLabel}</span>
              {r.customType ? (
                <span className="text-xs text-muted-foreground">({r.customType})</span>
              ) : null}
            </span>
          );
        },
      },
      {
        accessorKey: "date",
        header: "Date",
        enableSorting: true,
        cell: ({ row }) => {
          const v = (row.getValue("date") as string).trim();
          return v || <span className="text-muted-foreground">—</span>;
        },
      },
      {
        accessorKey: "place",
        header: "Place",
        enableSorting: true,
        cell: ({ row }) => {
          const v = (row.getValue("place") as string).trim();
          return v || <span className="text-muted-foreground">—</span>;
        },
      },
      { accessorKey: "linkedTo", header: "Linked to", enableSorting: true },
      {
        accessorKey: "linkedType",
        header: "Link type",
        cell: ({ row }) => {
          const v = row.getValue("linkedType") as EventRow["linkedType"];
          if (v === "none") {
            return <span className="text-muted-foreground">—</span>;
          }
          return <span className="capitalize">{v}</span>;
        },
      },
    ],
    renderCard: ({ record, onView, onEdit, onDelete }) => (
      <EventCard record={record} onView={onView} onEdit={onEdit} onDelete={onDelete} />
    ),
    actions: {
      add: { label: "Add event", handler: () => router.push("/admin/events/new") },
      view: {
        label: "View",
        handler: (r) => router.push(`/admin/events/${r.id}`),
      },
      edit: { label: "Edit", handler: (r) => router.push(`/admin/events/${r.id}/edit`) },
      delete: { label: "Delete", handler: onDelete },
    },
  };
}

function filterStateToQueryOpts(applied: FilterState): UseAdminEventsOpts {
  const opts: UseAdminEventsOpts = {
    limit: ADMIN_LIST_MAX_LIMIT,
    offset: 0,
  };
  if (applied.eventType) opts.eventType = applied.eventType;
  const pc = applied.placeContains.trim();
  if (pc) opts.placeContains = pc;
  const dmin = applied.dateYearMin.trim();
  const dmax = applied.dateYearMax.trim();
  if (dmin) opts.dateYearMin = dmin;
  if (dmax) opts.dateYearMax = dmax;
  if (applied.linkType === "individual" || applied.linkType === "family") {
    opts.linkType = applied.linkType;
  }
  const lg = applied.linkedGiven.trim();
  const ll = applied.linkedLast.trim();
  if (lg) opts.linkedGiven = lg;
  if (ll) opts.linkedLast = ll;
  return opts;
}

function AdminEventsPageInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const deleteEvent = useDeleteEvent();
  const lastHydratedQsRef = useRef<string | null>(null);
  const { draft: filterDraft, queryOpts, updateDraft, apply, clear, replace } = useFilterState(
    FILTER_DEFAULTS,
    filterStateToQueryOpts,
  );

  const qs = searchParams.toString();
  useLayoutEffect(() => {
    if (!hasAdminEventsFilterQueryKeys(searchParams)) {
      if (lastHydratedQsRef.current != null && lastHydratedQsRef.current !== "" && qs === "") {
        replace({ ...FILTER_DEFAULTS });
      }
      lastHydratedQsRef.current = qs;
      return;
    }
    if (lastHydratedQsRef.current === qs) return;
    lastHydratedQsRef.current = qs;
    replace(
      mergeAdminEventsFilterDefaults(parseAdminEventsFiltersFromSearchParams(searchParams)),
    );
  }, [qs, replace, searchParams]);

  const applyFilters = useCallback(() => {
    apply();
    router.replace(adminEventsPathWithFilters(filterDraft), { scroll: false });
  }, [apply, filterDraft, router]);

  const clearFilters = useCallback(() => {
    clear();
    router.replace("/admin/events", { scroll: false });
  }, [clear, router]);

  const { data, isLoading } = useAdminEvents(queryOpts);

  const handleDelete = useCallback(
    (r: EventRow) => {
      const label = `${r.typeLabel}${r.customType ? ` (${r.customType})` : ""} — linked: ${r.linkedTo}`;
      if (
        !window.confirm(
          `Delete this event?\n\n${label}\n\nThis removes the event from the tree and refreshes related birth/death/marriage fields where applicable. This cannot be undone.`,
        )
      ) {
        return;
      }
      deleteEvent.mutate(r.id, {
        onSuccess: () => toast.success(`Deleted event: ${r.typeLabel}.`),
        onError: (err) => {
          const msg = err instanceof Error ? err.message : "Unknown error";
          toast.error(`Failed to delete event: ${msg}`);
        },
      });
    },
    [deleteEvent],
  );

  const rows = useMemo(() => (data ? mapApiToRows(data) : []), [data]);
  const config = useMemo(() => buildEventsConfig(router, handleDelete), [router, handleDelete]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Events</h1>
        <p className="text-muted-foreground">
          Life events linked to people or families. Use filters to narrow by type, place, date year, and link. Applying
          filters updates the URL so you can bookmark or open the same view from Places or Dates.
        </p>
      </div>

      {hasAdminEventsFilterQueryKeys(searchParams) ? (
        <div
          role="status"
          className="rounded-md border border-base-content/[0.12] bg-base-content/[0.04] px-4 py-3 text-sm text-muted-foreground"
        >
          <span className="font-medium text-base-content">Filters are active</span> — this list was opened with query
          parameters in the URL. The panel below reflects those values; use <span className="font-medium">Clear</span> to
          remove them from the URL and reset the form.
        </div>
      ) : null}

      <FilterPanel onApply={applyFilters} onClear={clearFilters}>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <div className="space-y-2">
            <Label htmlFor="filter-event-type">Event type</Label>
            <select
              id="filter-event-type"
              className={selectClassName}
              value={filterDraft.eventType}
              onChange={(e) => updateDraft("eventType", e.target.value)}
            >
              <option value="">Any</option>
              {EVENT_TYPE_TAGS.map((tag) => (
                <option key={tag} value={tag}>
                  {tag} — {GEDCOM_EVENT_TYPE_LABELS[tag] ?? tag}
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-2 sm:col-span-2">
            <Label htmlFor="filter-place">Place contains</Label>
            <Input
              id="filter-place"
              value={filterDraft.placeContains}
              onChange={(e) => updateDraft("placeContains", e.target.value)}
              placeholder="Substring in place text"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="filter-year-min">Date year from</Label>
            <Input
              id="filter-year-min"
              type="number"
              inputMode="numeric"
              value={filterDraft.dateYearMin}
              onChange={(e) => updateDraft("dateYearMin", e.target.value)}
              placeholder="e.g. 1900"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="filter-year-max">Date year to</Label>
            <Input
              id="filter-year-max"
              type="number"
              inputMode="numeric"
              value={filterDraft.dateYearMax}
              onChange={(e) => updateDraft("dateYearMax", e.target.value)}
              placeholder="e.g. 1950"
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
          <div className="space-y-2 sm:col-span-2 lg:col-span-3 grid gap-4 sm:grid-cols-2">
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
            <p className="text-xs text-muted-foreground sm:col-span-2">
              Matches events attached to an individual whose name satisfies any filled name fields. Not applied when
              link type is <strong>Family</strong> only.
            </p>
          </div>
        </div>
      </FilterPanel>

      <DataViewer
        config={config}
        data={rows}
        isLoading={isLoading}
        viewModeKey="admin-events-view"
        paginationResetKey={JSON.stringify(queryOpts)}
        totalCount={data?.total}
      />
    </div>
  );
}

export default function AdminEventsPage() {
  return (
    <Suspense
      fallback={
        <div className="space-y-6">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">Events</h1>
            <p className="text-muted-foreground">Loading…</p>
          </div>
        </div>
      }
    >
      <AdminEventsPageInner />
    </Suspense>
  );
}
