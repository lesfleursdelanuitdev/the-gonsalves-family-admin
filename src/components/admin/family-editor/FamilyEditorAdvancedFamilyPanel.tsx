"use client";

import type { Dispatch, SetStateAction } from "react";
import Link from "next/link";
import { ChevronDown, ChevronUp } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import {
  FAMILY_PARTNER_ASSIGNMENT_RULES,
  FAMILY_PARTNER_SLOT_SUBTITLE,
} from "@/lib/gedcom/family-partner-slots";
import { FamilyEditorOtherFamilyEventsPanel } from "@/components/admin/family-editor/FamilyEditorOtherFamilyEventsPanel";
import type { PaginationState, Updater } from "@tanstack/react-table";
import type { AdminFamilyEventRow } from "@/hooks/useAdminFamilyEvents";

export function FamilyEditorAdvancedFamilyPanel({
  mode,
  xref,
  familyId,
  isDivorced,
  setIsDivorced,
  parentSlotRulesOpen,
  setParentSlotRulesOpen,
  parentSlotRulesPanelId,
  eventsLoading,
  eventsErr,
  events,
  paginatedEvents,
  eventPagination,
  eventPageCount,
  onEventPaginationChange,
}: {
  mode: "create" | "edit";
  xref: string;
  familyId: string;
  isDivorced: boolean;
  setIsDivorced: (v: boolean) => void;
  parentSlotRulesOpen: boolean;
  setParentSlotRulesOpen: Dispatch<SetStateAction<boolean>>;
  parentSlotRulesPanelId: string;
  eventsLoading: boolean;
  eventsErr: string | null;
  events: AdminFamilyEventRow[];
  paginatedEvents: AdminFamilyEventRow[];
  eventPagination: PaginationState;
  eventPageCount: number;
  onEventPaginationChange: (updater: Updater<PaginationState>) => void;
}) {
  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <Label className="text-xs text-muted-foreground">Family record id (XREF)</Label>
        <p className="font-mono text-sm text-foreground">{xref.trim() || "—"}</p>
        {mode === "edit" && familyId ? (
          <p className="text-sm">
            <Link href={`/admin/families/${familyId}`} className="link link-primary font-medium">
              View family record
            </Link>
          </p>
        ) : null}
      </div>

      <div className="rounded-lg border border-base-content/10 bg-base-content/[0.02]">
        <button
          type="button"
          className="flex w-full items-center justify-between gap-2 rounded-lg px-3 py-2.5 text-left text-sm transition-colors hover:bg-base-content/[0.04] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-base-content/20"
          aria-expanded={parentSlotRulesOpen}
          aria-controls={parentSlotRulesPanelId}
          onClick={() => setParentSlotRulesOpen((o) => !o)}
        >
          <span className="font-medium text-base-content">Partner slot assignment (GEDCOM)</span>
          {parentSlotRulesOpen ? (
            <ChevronUp className="size-4 shrink-0 text-muted-foreground" aria-hidden />
          ) : (
            <ChevronDown className="size-4 shrink-0 text-muted-foreground" aria-hidden />
          )}
        </button>
        <div
          id={parentSlotRulesPanelId}
          hidden={!parentSlotRulesOpen}
          className="space-y-2 border-t border-base-content/10 px-3 pb-3 pt-2"
          role="region"
          aria-label="Partner slot assignment rules"
        >
          <p className="text-sm text-muted-foreground">{FAMILY_PARTNER_SLOT_SUBTITLE}</p>
          <ul className="list-inside list-disc space-y-1 text-xs text-muted-foreground">
            {FAMILY_PARTNER_ASSIGNMENT_RULES.map((rule, i) => (
              <li key={i}>{rule}</li>
            ))}
          </ul>
        </div>
      </div>

      <div className="flex min-h-11 items-start gap-3 sm:min-h-0">
        <Checkbox
          id="family-is-divorced-advanced"
          checked={isDivorced}
          onCheckedChange={(v) => setIsDivorced(v === true)}
          className="mt-0.5 shrink-0"
        />
        <Label htmlFor="family-is-divorced-advanced" className="cursor-pointer font-normal leading-snug">
          Divorced flag on the family record (GEDCOM). Use together with a divorce date in the timeline when you have
          one.
        </Label>
      </div>

      <FamilyEditorOtherFamilyEventsPanel
        eventsLoading={eventsLoading}
        eventsErr={eventsErr}
        events={events}
        paginatedEvents={paginatedEvents}
        eventPagination={eventPagination}
        eventPageCount={eventPageCount}
        onEventPaginationChange={onEventPaginationChange}
      />
    </div>
  );
}
