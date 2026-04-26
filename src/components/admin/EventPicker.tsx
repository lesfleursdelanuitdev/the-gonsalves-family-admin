"use client";

import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { Loader2 } from "lucide-react";
import { fetchJson } from "@/lib/infra/api";
import { ADMIN_PICKER_DEBOUNCE_MS, useDebouncedValue } from "@/hooks/useDebouncedValue";
import {
  ADMIN_EVENTS_QUERY_KEY,
  buildEventsParams,
  type AdminEventListItem,
  type AdminEventsListResponse,
  type UseAdminEventsOpts,
} from "@/hooks/useAdminEvents";
import { GEDCOM_EVENT_TYPE_LABELS } from "@/lib/gedcom/gedcom-event-labels";
import { formatNoteEventPickerLabel } from "@/lib/forms/note-event-picker-label";
import { selectClassName } from "@/components/data-viewer/constants";
import { IndividualNameSearchFields } from "@/components/admin/IndividualNameSearchFields";
import { FamilyPartnerSearchFields } from "@/components/admin/FamilyPartnerSearchFields";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

const EVENT_TYPE_TAGS = Object.keys(GEDCOM_EVENT_TYPE_LABELS).sort();

export type EventPickerProps = {
  idPrefix?: string;
  /** When true, a GEDCOM tag must be chosen before search runs (e.g. media editor). */
  requireEventType?: boolean;
  eventType: string;
  onEventTypeChange: (value: string) => void;
  linkScope: "individual" | "family";
  onLinkScopeChange: (value: "individual" | "family") => void;
  indGiven: string;
  indLast: string;
  onIndGivenChange: (value: string) => void;
  onIndLastChange: (value: string) => void;
  famP1Given: string;
  famP1Last: string;
  famP2Given: string;
  famP2Last: string;
  onFamP1GivenChange: (value: string) => void;
  onFamP1LastChange: (value: string) => void;
  onFamP2GivenChange: (value: string) => void;
  onFamP2LastChange: (value: string) => void;
  onPick: (event: AdminEventListItem) => void;
  isPickDisabled?: (event: AdminEventListItem) => boolean;
  excludeEventIds?: Set<string>;
  limit?: number;
  /** Defaults to {@link formatNoteEventPickerLabel}. */
  formatRowLabel?: (event: AdminEventListItem) => string;
  className?: string;
  /** Use radios instead of a select for individual vs family (e.g. media editor). */
  linkScopeAsRadios?: boolean;
  partner1Legend?: string;
  partner2Legend?: string;
};

/**
 * Reusable event search: GEDCOM type, linked to individual or family, name fields aligned with
 * {@link IndividualNameSearchFields} / {@link FamilyPartnerSearchFields}, then matching events from
 * the admin events API.
 */
export function EventPicker({
  idPrefix = "event-picker",
  requireEventType = false,
  eventType,
  onEventTypeChange,
  linkScope,
  onLinkScopeChange,
  indGiven,
  indLast,
  onIndGivenChange,
  onIndLastChange,
  famP1Given,
  famP1Last,
  famP2Given,
  famP2Last,
  onFamP1GivenChange,
  onFamP1LastChange,
  onFamP2GivenChange,
  onFamP2LastChange,
  onPick,
  isPickDisabled,
  excludeEventIds,
  limit = 25,
  formatRowLabel = formatNoteEventPickerLabel,
  className,
  linkScopeAsRadios = false,
  partner1Legend,
  partner2Legend,
}: EventPickerProps) {
  const debouncedIndGiven = useDebouncedValue(indGiven.trim().toLowerCase(), ADMIN_PICKER_DEBOUNCE_MS);
  const debouncedIndLast = useDebouncedValue(indLast.trim(), ADMIN_PICKER_DEBOUNCE_MS);
  const debouncedP1Given = useDebouncedValue(famP1Given.trim().toLowerCase(), ADMIN_PICKER_DEBOUNCE_MS);
  const debouncedP1Last = useDebouncedValue(famP1Last.trim(), ADMIN_PICKER_DEBOUNCE_MS);
  const debouncedP2Given = useDebouncedValue(famP2Given.trim().toLowerCase(), ADMIN_PICKER_DEBOUNCE_MS);
  const debouncedP2Last = useDebouncedValue(famP2Last.trim(), ADMIN_PICKER_DEBOUNCE_MS);

  const etTrim = eventType.trim();
  const typeOk = !requireEventType || etTrim.length > 0;
  const hasIndName = !!(debouncedIndGiven || debouncedIndLast);
  const hasFamName = !!(debouncedP1Given || debouncedP1Last || debouncedP2Given || debouncedP2Last);
  const nameOk = linkScope === "individual" ? hasIndName : hasFamName;
  const queryEnabled = typeOk && nameOk;

  const listOpts: UseAdminEventsOpts = useMemo(
    () => ({
      eventType: etTrim || undefined,
      linkType: linkScope,
      linkedGiven: linkScope === "individual" ? debouncedIndGiven || undefined : undefined,
      linkedLast: linkScope === "individual" ? debouncedIndLast || undefined : undefined,
      p1Given: linkScope === "family" ? debouncedP1Given || undefined : undefined,
      p1Last: linkScope === "family" ? debouncedP1Last || undefined : undefined,
      p2Given: linkScope === "family" ? debouncedP2Given || undefined : undefined,
      p2Last: linkScope === "family" ? debouncedP2Last || undefined : undefined,
      limit,
      offset: 0,
    }),
    [
      etTrim,
      linkScope,
      debouncedIndGiven,
      debouncedIndLast,
      debouncedP1Given,
      debouncedP1Last,
      debouncedP2Given,
      debouncedP2Last,
      limit,
    ],
  );

  const qs = useMemo(() => buildEventsParams(listOpts).toString(), [listOpts]);

  const { data, isLoading, isFetching } = useQuery({
    queryKey: [...ADMIN_EVENTS_QUERY_KEY, "picker", qs],
    queryFn: () => fetchJson<AdminEventsListResponse>(`/api/admin/events${qs ? `?${qs}` : ""}`),
    enabled: queryEnabled,
  });

  const rows = useMemo(() => {
    const all = data?.events ?? [];
    if (!excludeEventIds?.size) return all;
    return all.filter((r) => !excludeEventIds.has(r.id));
  }, [data?.events, excludeEventIds]);

  const loading = isLoading || isFetching;

  return (
    <div className={cn("space-y-3", className)}>
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-1">
          <Label htmlFor={`${idPrefix}-evt-type`}>Event type</Label>
          <select
            id={`${idPrefix}-evt-type`}
            className={selectClassName}
            value={eventType}
            onChange={(e) => onEventTypeChange(e.target.value)}
          >
            {requireEventType ? (
              <option value="">Select type…</option>
            ) : (
              <option value="">Any type</option>
            )}
            {EVENT_TYPE_TAGS.map((tag) => (
              <option key={tag} value={tag}>
                {tag} — {GEDCOM_EVENT_TYPE_LABELS[tag] ?? tag}
              </option>
            ))}
          </select>
        </div>
        <div className="space-y-1">
          <Label htmlFor={linkScopeAsRadios ? undefined : `${idPrefix}-link-scope`}>Linked to</Label>
          {linkScopeAsRadios ? (
            <fieldset className="space-y-2">
              <legend className="sr-only">This event is linked to</legend>
              <div className="flex flex-wrap gap-4 pt-1">
                <label className="flex cursor-pointer items-center gap-2 text-sm">
                  <input
                    type="radio"
                    name={`${idPrefix}-link-scope`}
                    className="radio radio-sm"
                    checked={linkScope === "individual"}
                    onChange={() => onLinkScopeChange("individual")}
                  />
                  Individual
                </label>
                <label className="flex cursor-pointer items-center gap-2 text-sm">
                  <input
                    type="radio"
                    name={`${idPrefix}-link-scope`}
                    className="radio radio-sm"
                    checked={linkScope === "family"}
                    onChange={() => onLinkScopeChange("family")}
                  />
                  Family
                </label>
              </div>
            </fieldset>
          ) : (
            <>
              <select
                id={`${idPrefix}-link-scope`}
                className={selectClassName}
                value={linkScope}
                onChange={(e) => onLinkScopeChange(e.target.value as "individual" | "family")}
              >
                <option value="individual">Individual (person event)</option>
                <option value="family">Family (e.g. marriage)</option>
              </select>
              <p className="text-xs text-muted-foreground">
                Filters match events attached to a person vs. a family, same as the events list.
              </p>
            </>
          )}
        </div>
      </div>

      {linkScope === "individual" ? (
        <IndividualNameSearchFields
          idPrefix={`${idPrefix}-ind`}
          givenValue={indGiven}
          lastValue={indLast}
          onGivenChange={onIndGivenChange}
          onLastChange={onIndLastChange}
          showLastNameHint
        />
      ) : (
        <FamilyPartnerSearchFields
          idPrefix={`${idPrefix}-fam`}
          p1Given={famP1Given}
          p1Last={famP1Last}
          p2Given={famP2Given}
          p2Last={famP2Last}
          onP1GivenChange={onFamP1GivenChange}
          onP1LastChange={onFamP1LastChange}
          onP2GivenChange={onFamP2GivenChange}
          onP2LastChange={onFamP2LastChange}
          partner1Legend={partner1Legend ?? "Partner 1 (family)"}
          partner2Legend={partner2Legend ?? "Partner 2 (family)"}
        />
      )}

      {!queryEnabled ? (
        <p className="text-sm text-muted-foreground">
          {requireEventType && !etTrim
            ? "Choose an event type, then enter name filters to search."
            : linkScope === "individual"
              ? "Enter at least one of given name contains or last name prefix for the linked person."
              : "Enter name filters for one or both partners (same rules as the families list)."}
        </p>
      ) : null}

      {queryEnabled ? (
        <div className="max-h-60 overflow-auto rounded-box border border-base-content/10 bg-base-100 py-1 text-sm shadow-md">
          {loading ? (
            <p className="flex items-center gap-2 px-3 py-2 text-muted-foreground">
              <Loader2 className="size-4 shrink-0 animate-spin" aria-hidden />
              Searching…
            </p>
          ) : rows.length === 0 ? (
            <p className="px-3 py-2 text-muted-foreground">No matches.</p>
          ) : (
            <ul className="divide-y divide-base-content/[0.06]">
              {rows.map((ev) => {
                const label = formatRowLabel(ev);
                const disabled = isPickDisabled?.(ev) ?? false;
                return (
                  <li key={ev.id}>
                    <button
                      type="button"
                      disabled={disabled}
                      className="flex w-full flex-col items-start gap-0.5 px-3 py-2 text-left hover:bg-base-200/80 disabled:cursor-not-allowed disabled:opacity-50"
                      onClick={() => onPick(ev)}
                    >
                      <span className="line-clamp-2 whitespace-normal font-medium text-base-content">{label}</span>
                      {disabled ? <span className="text-xs text-muted-foreground">(already linked)</span> : null}
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      ) : null}
    </div>
  );
}
