"use client";

import { useState, type ReactNode } from "react";
import { X, Plus, ChevronDown, ChevronUp } from "lucide-react";
import { FamilySearchPicker } from "@/components/admin/FamilySearchPicker";
import { IndividualSearchPicker } from "@/components/admin/IndividualSearchPicker";
import { NotesPicker } from "@/components/admin/NotesPicker";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import type {
  TimelineEventRule,
  TimelineEventRuleFilters,
  TimelineGlobalFilters,
  TimelineRelationship,
} from "@/lib/admin/story-creator/story-types";
import { cn } from "@/lib/utils";

type Props = {
  rules: TimelineEventRule[];
  globalFilters?: TimelineGlobalFilters;
  onRulesChange: (rules: TimelineEventRule[]) => void;
  onGlobalFiltersChange: (filters: TimelineGlobalFilters) => void;
};

type RuleKind = TimelineEventRule["kind"];

const RULE_KIND_LABELS: Record<RuleKind, string> = {
  personEvents: "Person's events",
  familyEvents: "Family events",
  memberEvents: "Family members' events",
  noteEvents: "Research note events",
  relativeEvents: "Relative events",
};

const RULE_KIND_DESCRIPTIONS: Record<RuleKind, string> = {
  personEvents: "All events linked directly to a specific person.",
  familyEvents: "All events linked directly to a specific family.",
  memberEvents: "All events linked to every member of a specific family.",
  noteEvents: "All events linked to a specific research note.",
  relativeEvents: "Birth and death events for a person's relatives.",
};

const RELATIONSHIP_LABELS: Record<TimelineRelationship, string> = {
  parents: "Parents",
  siblings: "Siblings",
  children: "Children",
  grandchildren: "Grandchildren",
};

const ALL_RELATIONSHIPS: TimelineRelationship[] = ["parents", "siblings", "children", "grandchildren"];
const RULE_KINDS: RuleKind[] = ["personEvents", "familyEvents", "memberEvents", "noteEvents", "relativeEvents"];

function FieldLabel({ children }: { children: ReactNode }) {
  return <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-base-content/50">{children}</p>;
}

function segBtn(on: boolean) {
  return cn(
    "cursor-pointer rounded-md border-0 px-2.5 py-1 text-[11px] font-medium transition-all",
    on
      ? "bg-base-100 text-base-content shadow-sm shadow-base-content/10"
      : "bg-transparent text-muted-foreground hover:text-foreground",
  );
}

function csvToList(value: string): string[] {
  return value.split(/\s*,\s*/).map((v) => v.trim()).filter(Boolean);
}

function optionalYear(value: string): number | undefined {
  if (!value.trim()) return undefined;
  const n = Number(value);
  return Number.isFinite(n) ? n : undefined;
}

function ruleSubjectLabel(rule: TimelineEventRule): string {
  switch (rule.kind) {
    case "personEvents":
    case "relativeEvents":
      return rule.personLabel ?? rule.personId;
    case "familyEvents":
    case "memberEvents":
      return rule.familyLabel ?? rule.familyId;
    case "noteEvents":
      return rule.noteLabel ?? rule.noteId;
  }
}

function ruleSummaryLine(rule: TimelineEventRule): string {
  switch (rule.kind) {
    case "personEvents":   return `Person's events — ${ruleSubjectLabel(rule)}`;
    case "familyEvents":   return `Family events — ${ruleSubjectLabel(rule)}`;
    case "memberEvents":   return `Family members' events — ${ruleSubjectLabel(rule)}`;
    case "noteEvents":     return `Research note events — ${ruleSubjectLabel(rule)}`;
    case "relativeEvents": {
      const rels = rule.relationships.map((r) => RELATIONSHIP_LABELS[r]).join(", ");
      return `Relative events — ${ruleSubjectLabel(rule)} · ${rels}`;
    }
  }
}

// ── Shared filter fields ──────────────────────────────────────────────────────

function RuleFilterFields({
  filters,
  onChange,
}: {
  filters: TimelineEventRuleFilters | undefined;
  onChange: (f: TimelineEventRuleFilters) => void;
}) {
  const f = filters ?? {};
  const patch = (p: Partial<TimelineEventRuleFilters>) => onChange({ ...f, ...p });
  return (
    <div className="mt-3 space-y-3">
      <div>
        <FieldLabel>Event type filter</FieldLabel>
        <input
          className="input input-bordered input-sm w-full rounded-lg border-base-content/12 bg-base-100"
          placeholder="BIRT, MARR, DEAT (leave blank for all)"
          value={(f.eventTypes ?? []).join(", ")}
          onChange={(e) => patch({ eventTypes: csvToList(e.target.value) })}
        />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <FieldLabel>Start year</FieldLabel>
          <input
            className="input input-bordered input-sm w-full rounded-lg border-base-content/12 bg-base-100"
            placeholder="e.g. 1850"
            value={f.startYear ?? ""}
            onChange={(e) => patch({ startYear: optionalYear(e.target.value) })}
          />
        </div>
        <div>
          <FieldLabel>End year</FieldLabel>
          <input
            className="input input-bordered input-sm w-full rounded-lg border-base-content/12 bg-base-100"
            placeholder="e.g. 1920"
            value={f.endYear ?? ""}
            onChange={(e) => patch({ endYear: optionalYear(e.target.value) })}
          />
        </div>
      </div>
    </div>
  );
}

// ── Saved rule card (in the main picker) ─────────────────────────────────────

function RuleCard({
  rule,
  onRemove,
  onFiltersChange,
}: {
  rule: TimelineEventRule;
  onRemove: () => void;
  onFiltersChange: (f: TimelineEventRuleFilters) => void;
}) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="rounded-lg border border-base-content/12 bg-base-100">
      <div className="flex items-start gap-2 px-3 py-2.5">
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium text-base-content">{RULE_KIND_LABELS[rule.kind]}</p>
          <p className="mt-0.5 truncate text-xs text-base-content/55">{ruleSummaryLine(rule)}</p>
        </div>
        <button
          type="button"
          className="shrink-0 rounded p-0.5 text-base-content/40 hover:bg-base-200 hover:text-base-content"
          onClick={() => setExpanded((v) => !v)}
          aria-label="Toggle filters"
        >
          {expanded ? <ChevronUp className="size-4" /> : <ChevronDown className="size-4" />}
        </button>
        <button
          type="button"
          className="shrink-0 rounded p-0.5 text-base-content/40 hover:bg-error/10 hover:text-error"
          onClick={onRemove}
          aria-label="Remove rule"
        >
          <X className="size-4" />
        </button>
      </div>
      {expanded ? (
        <div className="border-t border-base-content/10 px-3 pb-3">
          <RuleFilterFields filters={rule.filters} onChange={onFiltersChange} />
        </div>
      ) : null}
    </div>
  );
}

// ── Pending rule row (inside modal, before saving) ────────────────────────────

function PendingRuleRow({ rule, onRemove }: { rule: TimelineEventRule; onRemove: () => void }) {
  return (
    <div className="flex items-center gap-2 rounded-lg border border-base-content/10 bg-base-200/40 px-3 py-2">
      <div className="min-w-0 flex-1">
        <p className="text-xs font-medium text-base-content">{RULE_KIND_LABELS[rule.kind]}</p>
        <p className="truncate text-xs text-base-content/55">{ruleSummaryLine(rule)}</p>
      </div>
      <button
        type="button"
        className="shrink-0 rounded p-0.5 text-base-content/40 hover:bg-error/10 hover:text-error"
        onClick={onRemove}
        aria-label="Remove rule"
      >
        <X className="size-3.5" />
      </button>
    </div>
  );
}

// ── Rule builder form ─────────────────────────────────────────────────────────

type DraftRule =
  | { kind: "personEvents"; personId?: string; personLabel?: string; filters?: TimelineEventRuleFilters }
  | { kind: "familyEvents"; familyId?: string; familyLabel?: string; filters?: TimelineEventRuleFilters }
  | { kind: "memberEvents"; familyId?: string; familyLabel?: string; filters?: TimelineEventRuleFilters }
  | { kind: "noteEvents"; noteId?: string; noteLabel?: string; filters?: TimelineEventRuleFilters }
  | { kind: "relativeEvents"; personId?: string; personLabel?: string; relationships: TimelineRelationship[]; filters?: TimelineEventRuleFilters };

const BLANK_DRAFT: DraftRule = { kind: "personEvents" };

function draftIsComplete(draft: DraftRule): draft is TimelineEventRule {
  switch (draft.kind) {
    case "personEvents":   return !!draft.personId;
    case "familyEvents":   return !!draft.familyId;
    case "memberEvents":   return !!draft.familyId;
    case "noteEvents":     return !!draft.noteId;
    case "relativeEvents": return !!draft.personId && draft.relationships.length > 0;
  }
}

function RuleBuilderForm({ onAdd }: { onAdd: (rule: TimelineEventRule) => void }) {
  const [draft, setDraft] = useState<DraftRule>(BLANK_DRAFT);

  const setKind = (kind: RuleKind) => {
    if (kind === "relativeEvents") setDraft({ kind, relationships: ["parents", "siblings", "children", "grandchildren"] });
    else if (kind === "familyEvents" || kind === "memberEvents") setDraft({ kind });
    else if (kind === "noteEvents") setDraft({ kind });
    else setDraft({ kind: "personEvents" });
  };

  const patchDraft = (p: Partial<DraftRule>) => setDraft((d) => ({ ...d, ...p } as DraftRule));

  const toggleRelationship = (rel: TimelineRelationship) => {
    if (draft.kind !== "relativeEvents") return;
    const next = draft.relationships.includes(rel)
      ? draft.relationships.filter((r) => r !== rel)
      : [...draft.relationships, rel];
    patchDraft({ relationships: next } as Partial<DraftRule>);
  };

  const complete = draftIsComplete(draft);

  const handleAdd = () => {
    if (!complete) return;
    onAdd(draft);
    setDraft(BLANK_DRAFT);
  };

  return (
    <div className="rounded-lg border border-base-content/12 bg-base-100 p-4">
      <FieldLabel>Rule type</FieldLabel>
      <div className="inline-flex flex-wrap gap-0.5 rounded-lg border border-base-content/10 bg-base-200/40 p-0.5">
        {RULE_KINDS.map((k) => (
          <button key={k} type="button" className={segBtn(draft.kind === k)} onClick={() => setKind(k)}>
            {RULE_KIND_LABELS[k]}
          </button>
        ))}
      </div>
      <p className="mt-1.5 text-xs text-base-content/50">{RULE_KIND_DESCRIPTIONS[draft.kind]}</p>

      <div className="mt-3">
        {draft.kind === "personEvents" || draft.kind === "relativeEvents" ? (
          <>
            <FieldLabel>Person</FieldLabel>
            {draft.personId ? (
              <div className="flex items-center gap-2 rounded-lg border border-base-content/10 bg-base-content/[0.03] px-3 py-2">
                <span className="min-w-0 flex-1 text-sm font-medium">{draft.personLabel ?? draft.personId}</span>
                <button
                  type="button"
                  className="shrink-0 text-base-content/40 hover:text-base-content"
                  onClick={() => patchDraft({ personId: undefined, personLabel: undefined } as Partial<DraftRule>)}
                >
                  <X className="size-3.5" />
                </button>
              </div>
            ) : (
              <IndividualSearchPicker
                idPrefix="rule-builder-person"
                onPick={(ind) =>
                  patchDraft({
                    personId: ind.id,
                    personLabel: ind.fullName?.trim() || ind.xref || ind.id,
                  } as Partial<DraftRule>)
                }
              />
            )}
          </>
        ) : null}

        {draft.kind === "familyEvents" || draft.kind === "memberEvents" ? (
          <>
            <FieldLabel>Family</FieldLabel>
            {draft.familyId ? (
              <div className="flex items-center gap-2 rounded-lg border border-base-content/10 bg-base-content/[0.03] px-3 py-2">
                <span className="min-w-0 flex-1 text-sm font-medium">{draft.familyLabel ?? draft.familyId}</span>
                <button
                  type="button"
                  className="shrink-0 text-base-content/40 hover:text-base-content"
                  onClick={() => patchDraft({ familyId: undefined, familyLabel: undefined } as Partial<DraftRule>)}
                >
                  <X className="size-3.5" />
                </button>
              </div>
            ) : (
              <FamilySearchPicker
                idPrefix="rule-builder-family"
                onPick={(fam) => {
                  const husband = fam.husband?.fullName?.trim();
                  const wife = fam.wife?.fullName?.trim();
                  const label = [husband, wife].filter(Boolean).join(" + ") || fam.xref || fam.id;
                  patchDraft({ familyId: fam.id, familyLabel: label } as Partial<DraftRule>);
                }}
              />
            )}
          </>
        ) : null}

        {draft.kind === "noteEvents" ? (
          <>
            <FieldLabel>Research note</FieldLabel>
            {draft.noteId ? (
              <div className="flex items-center gap-2 rounded-lg border border-base-content/10 bg-base-content/[0.03] px-3 py-2">
                <span className="min-w-0 flex-1 text-sm font-medium">{draft.noteLabel ?? draft.noteId}</span>
                <button
                  type="button"
                  className="shrink-0 text-base-content/40 hover:text-base-content"
                  onClick={() => patchDraft({ noteId: undefined, noteLabel: undefined } as Partial<DraftRule>)}
                >
                  <X className="size-3.5" />
                </button>
              </div>
            ) : (
              <NotesPicker
                idPrefix="rule-builder-note"
                onPick={(note) => {
                  const label = note.xref?.trim() || note.id;
                  patchDraft({ noteId: note.id, noteLabel: label } as Partial<DraftRule>);
                }}
              />
            )}
          </>
        ) : null}
      </div>

      {draft.kind === "relativeEvents" ? (
        <div className="mt-3">
          <FieldLabel>Include relatives</FieldLabel>
          <div className="flex flex-wrap gap-x-4 gap-y-2">
            {ALL_RELATIONSHIPS.map((rel) => (
              <label key={rel} className="flex cursor-pointer items-center gap-1.5 text-sm text-base-content/80">
                <input
                  type="checkbox"
                  className="checkbox checkbox-sm"
                  checked={draft.relationships.includes(rel)}
                  onChange={() => toggleRelationship(rel)}
                />
                {RELATIONSHIP_LABELS[rel]}
              </label>
            ))}
          </div>
        </div>
      ) : null}

      <RuleFilterFields
        filters={draft.filters}
        onChange={(f) => patchDraft({ filters: f } as Partial<DraftRule>)}
      />

      <div className="mt-4">
        <Button type="button" size="sm" disabled={!complete} onClick={handleAdd} className="gap-1.5">
          <Plus className="size-3.5" />
          Add this rule
        </Button>
      </div>
    </div>
  );
}

// ── Add rules modal ───────────────────────────────────────────────────────────

function AddRulesModal({
  open,
  onOpenChange,
  onSave,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSave: (rules: TimelineEventRule[]) => void;
}) {
  const [pending, setPending] = useState<TimelineEventRule[]>([]);

  const handleOpenChange = (next: boolean) => {
    if (!next) setPending([]);
    onOpenChange(next);
  };

  const handleSave = () => {
    onSave(pending);
    setPending([]);
    onOpenChange(false);
  };

  const removePending = (index: number) => setPending((p) => p.filter((_, i) => i !== index));

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="flex max-h-[90vh] max-w-xl flex-col overflow-hidden">
        <DialogTitle>Add event rules</DialogTitle>
        <DialogDescription>
          Build rules below and add as many as you need. When you're done, save them all at once.
        </DialogDescription>

        <div className="flex-1 space-y-4 overflow-y-auto pr-1">
          {/* Pending rules */}
          {pending.length > 0 ? (
            <div className="space-y-1.5">
              <p className="text-xs font-semibold uppercase tracking-wide text-base-content/50">
                Rules to add ({pending.length})
              </p>
              {pending.map((rule, i) => (
                <PendingRuleRow key={i} rule={rule} onRemove={() => removePending(i)} />
              ))}
            </div>
          ) : null}

          {/* Rule builder */}
          <div>
            {pending.length > 0 ? (
              <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-base-content/50">
                Add another rule
              </p>
            ) : null}
            <RuleBuilderForm onAdd={(rule) => setPending((p) => [...p, rule])} />
          </div>
        </div>

        <div className="flex items-center justify-between border-t border-base-content/10 pt-4">
          <Button
            type="button"
            disabled={pending.length === 0}
            onClick={handleSave}
          >
            Save {pending.length > 0 ? `${pending.length} rule${pending.length === 1 ? "" : "s"}` : "rules"}
          </Button>
          <Button type="button" variant="ghost" onClick={() => handleOpenChange(false)}>
            Cancel
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

export function EventsListPicker({ rules, globalFilters, onRulesChange, onGlobalFiltersChange }: Props) {
  const [modalOpen, setModalOpen] = useState(false);
  const gf = globalFilters ?? {};

  const patchGlobal = (p: Partial<TimelineGlobalFilters>) => onGlobalFiltersChange({ ...gf, ...p });
  const removeRule = (index: number) => onRulesChange(rules.filter((_, i) => i !== index));
  const updateRuleFilters = (index: number, filters: TimelineEventRuleFilters) =>
    onRulesChange(rules.map((r, i) => (i === index ? { ...r, filters } : r)));

  return (
    <div className="space-y-3">
      {rules.length === 0 ? (
        <p className="text-xs text-base-content/55">
          No event rules yet. Add a rule to define which events appear on this timeline.
        </p>
      ) : null}

      {rules.map((rule, i) => (
        <RuleCard
          key={i}
          rule={rule}
          onRemove={() => removeRule(i)}
          onFiltersChange={(f) => updateRuleFilters(i, f)}
        />
      ))}

      <Button type="button" variant="outline" size="sm" className="gap-1.5" onClick={() => setModalOpen(true)}>
        <Plus className="size-3.5" />
        Add rules
      </Button>

      <AddRulesModal
        open={modalOpen}
        onOpenChange={setModalOpen}
        onSave={(newRules) => onRulesChange([...rules, ...newRules])}
      />

      {rules.length > 0 ? (
        <div className="mt-2 rounded-lg border border-base-content/10 bg-base-200/30 p-3">
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-base-content/50">Global filters</p>
          <p className="mb-3 text-xs text-base-content/50">Applied to the full merged event set after all rules are combined.</p>
          <div>
            <FieldLabel>Event type filter</FieldLabel>
            <input
              className="input input-bordered input-sm w-full rounded-lg border-base-content/12 bg-base-100"
              placeholder="BIRT, MARR, DEAT (leave blank for all)"
              value={(gf.eventTypes ?? []).join(", ")}
              onChange={(e) => patchGlobal({ eventTypes: csvToList(e.target.value) })}
            />
          </div>
          <div className="mt-3 grid grid-cols-2 gap-3">
            <div>
              <FieldLabel>Start year</FieldLabel>
              <input
                className="input input-bordered input-sm w-full rounded-lg border-base-content/12 bg-base-100"
                placeholder="e.g. 1850"
                value={gf.startYear ?? ""}
                onChange={(e) => patchGlobal({ startYear: optionalYear(e.target.value) })}
              />
            </div>
            <div>
              <FieldLabel>End year</FieldLabel>
              <input
                className="input input-bordered input-sm w-full rounded-lg border-base-content/12 bg-base-100"
                placeholder="e.g. 1920"
                value={gf.endYear ?? ""}
                onChange={(e) => patchGlobal({ endYear: optionalYear(e.target.value) })}
              />
            </div>
          </div>
          <label className="mt-3 flex cursor-pointer items-center gap-2 text-sm text-base-content/70">
            <input
              type="checkbox"
              className="checkbox checkbox-sm"
              checked={gf.includeUndated ?? true}
              onChange={(e) => patchGlobal({ includeUndated: e.target.checked })}
            />
            Include undated events
          </label>
        </div>
      ) : null}
    </div>
  );
}
