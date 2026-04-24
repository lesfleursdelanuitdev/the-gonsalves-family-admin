"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type Dispatch,
  type ReactNode,
  type SetStateAction,
} from "react";
import { Plus, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { selectClassName } from "@/components/data-viewer/constants";
import { EventPicker } from "@/components/admin/EventPicker";
import { FamilySearchPicker } from "@/components/admin/FamilySearchPicker";
import { useAdminSources, type AdminSourceListItem } from "@/hooks/useAdminSources";
import { formatDisplayNameFromNameForms } from "@/lib/gedcom/display-name";
import { familyUnionPrimaryLine } from "@/lib/gedcom/family-search-display";
import { individualSearchDisplayName } from "@/lib/gedcom/individual-search-display";
import { IndividualSearchPicker } from "@/components/admin/IndividualSearchPicker";
import { formatNoteEventPickerLabel } from "@/lib/forms/note-event-picker-label";
import {
  type NoteLinkKind,
  type SelectedNoteLink,
} from "@/lib/forms/note-form-links";
import { cn } from "@/lib/utils";

const ALL_NOTE_LINK_KINDS: NoteLinkKind[] = ["individual", "family", "event", "source"];

const LINK_KIND_OPTIONS: { value: NoteLinkKind; label: string }[] = [
  { value: "individual", label: "Individual" },
  { value: "family", label: "Family" },
  { value: "event", label: "Event" },
  { value: "source", label: "Source" },
];

function newBuilderId(): string {
  return crypto.randomUUID();
}

export type LinkBuilderModel = {
  id: string;
  kind: NoteLinkKind;
  indGiven: string;
  indLast: string;
  famP1Given: string;
  famP1Last: string;
  famP2Given: string;
  famP2Last: string;
  evEventType: string;
  evScope: "individual" | "family";
  evIndGiven: string;
  evIndLast: string;
  evP1Given: string;
  evP1Last: string;
  evP2Given: string;
  evP2Last: string;
  srcQ: string;
};

function createEmptyBuilder(kind: NoteLinkKind): LinkBuilderModel {
  return {
    id: newBuilderId(),
    kind,
    indGiven: "",
    indLast: "",
    famP1Given: "",
    famP1Last: "",
    famP2Given: "",
    famP2Last: "",
    evEventType: "",
    evScope: "individual",
    evIndGiven: "",
    evIndLast: "",
    evP1Given: "",
    evP1Last: "",
    evP2Given: "",
    evP2Last: "",
    srcQ: "",
  };
}

export interface NoteLinkedRecordsPickerProps {
  value: SelectedNoteLink[];
  onChange: Dispatch<SetStateAction<SelectedNoteLink[]>>;
  /** If set, only these link types appear (e.g. events: individual + family only). */
  allowedLinkKinds?: NoteLinkKind[];
  /** Replaces the default helper text under the section label. */
  linkingHint?: string;
}

function normalizeAllowedLinkKinds(allowed?: NoteLinkKind[]): NoteLinkKind[] {
  if (!allowed?.length) return [...ALL_NOTE_LINK_KINDS];
  const filtered = allowed.filter((k) => ALL_NOTE_LINK_KINDS.includes(k));
  return filtered.length > 0 ? filtered : [...ALL_NOTE_LINK_KINDS];
}

export function NoteLinkedRecordsPicker({
  value,
  onChange,
  allowedLinkKinds,
  linkingHint,
}: NoteLinkedRecordsPickerProps) {
  const normalizedKinds = useMemo(() => normalizeAllowedLinkKinds(allowedLinkKinds), [allowedLinkKinds]);
  const kindOptions = useMemo(
    () => LINK_KIND_OPTIONS.filter((o) => normalizedKinds.includes(o.value)),
    [normalizedKinds],
  );
  const defaultKind = kindOptions[0]?.value ?? "individual";

  const [builders, setBuilders] = useState<LinkBuilderModel[]>([]);

  const addBuilder = useCallback(() => {
    setBuilders((prev) => [...prev, createEmptyBuilder(defaultKind)]);
  }, [defaultKind]);

  const removeBuilder = useCallback((id: string) => {
    setBuilders((prev) => prev.filter((b) => b.id !== id));
  }, []);

  const patchBuilder = useCallback((id: string, patch: Partial<LinkBuilderModel>) => {
    setBuilders((prev) => prev.map((b) => (b.id === id ? { ...b, ...patch } : b)));
  }, []);

  const pickLink = useCallback(
    (builderId: string, link: SelectedNoteLink) => {
      onChange((prev) => {
        if (prev.some((p) => p.kind === link.kind && p.id === link.id)) return prev;
        return [...prev, link];
      });
      removeBuilder(builderId);
    },
    [onChange, removeBuilder],
  );

  const removeSelectedLink = useCallback(
    (kind: NoteLinkKind, id: string) => {
      onChange((prev) => prev.filter((p) => !(p.kind === kind && p.id === id)));
    },
    [onChange],
  );

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-end justify-between gap-2">
        <div>
          <Label>Linked records</Label>
          <p className="text-xs text-muted-foreground">
            {linkingHint ??
              "Add one or more links. Each block searches independently; pick a row to attach. Saving the note replaces all links."}
          </p>
        </div>
        <Button type="button" variant="outline" size="sm" className="gap-1" onClick={addBuilder}>
          <Plus className="size-4" />
          Add link
        </Button>
      </div>

      {value.length > 0 ? (
        <ul className="flex flex-wrap gap-2">
          {value.map((l) => (
            <li
              key={`${l.kind}-${l.id}`}
              className="inline-flex items-center gap-1 rounded-full border border-base-content/15 bg-base-200/50 px-2.5 py-1 text-sm"
            >
              <span className="text-muted-foreground">{l.kind}:</span>
              <span className="max-w-[220px] truncate font-medium">{l.label}</span>
              <button
                type="button"
                className="rounded p-0.5 text-muted-foreground hover:bg-base-300 hover:text-base-content"
                aria-label={`Remove ${l.label}`}
                onClick={() => removeSelectedLink(l.kind, l.id)}
              >
                <X className="size-3.5" />
              </button>
            </li>
          ))}
        </ul>
      ) : null}

      {builders.length === 0 ? (
        <p className="text-sm text-muted-foreground">No active link search. Click &quot;Add link&quot; to find a record.</p>
      ) : null}

      {builders.map((b) => (
        <LinkBuilderCard
          key={b.id}
          model={b}
          kindOptions={kindOptions}
          onPatch={(patch) => patchBuilder(b.id, patch)}
          onRemove={() => removeBuilder(b.id)}
          onPick={(link) => pickLink(b.id, link)}
          isPicked={(kind, id) => value.some((p) => p.kind === kind && p.id === id)}
        />
      ))}
    </div>
  );
}

function LinkBuilderCard({
  model,
  kindOptions,
  onPatch,
  onRemove,
  onPick,
  isPicked,
}: {
  model: LinkBuilderModel;
  kindOptions: { value: NoteLinkKind; label: string }[];
  onPatch: (patch: Partial<LinkBuilderModel>) => void;
  onRemove: () => void;
  onPick: (link: SelectedNoteLink) => void;
  isPicked: (kind: NoteLinkKind, id: string) => boolean;
}) {
  useEffect(() => {
    if (!kindOptions.some((o) => o.value === model.kind)) {
      onPatch({ kind: kindOptions[0]?.value ?? "individual" });
    }
  }, [kindOptions, model.kind, model.id, onPatch]);

  const displayKind: NoteLinkKind = kindOptions.some((o) => o.value === model.kind)
    ? model.kind
    : (kindOptions[0]?.value ?? "individual");

  return (
    <div className="relative space-y-3 rounded-lg border border-base-content/12 bg-base-content/[0.03] p-4">
      <button
        type="button"
        className="absolute right-2 top-2 rounded p-1 text-muted-foreground hover:bg-base-300 hover:text-base-content"
        aria-label="Remove this link search"
        onClick={onRemove}
      >
        <X className="size-4" />
      </button>

      <div className="pr-8">
        <Label htmlFor={`link-kind-${model.id}`}>Link type</Label>
        <select
          id={`link-kind-${model.id}`}
          className={cn(selectClassName, "mt-1 max-w-xs")}
          value={displayKind}
          onChange={(e) => onPatch({ kind: e.target.value as NoteLinkKind })}
        >
          {kindOptions.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
      </div>

      {displayKind === "individual" ? (
        <IndividualLinkSearch model={model} onPatch={onPatch} onPick={onPick} isPicked={isPicked} />
      ) : null}
      {displayKind === "family" ? (
        <FamilyLinkSearch model={model} onPatch={onPatch} onPick={onPick} isPicked={isPicked} />
      ) : null}
      {displayKind === "event" ? (
        <EventLinkSearch model={model} onPatch={onPatch} onPick={onPick} isPicked={isPicked} />
      ) : null}
      {displayKind === "source" ? (
        <SourceLinkSearch model={model} onPatch={onPatch} onPick={onPick} isPicked={isPicked} />
      ) : null}
    </div>
  );
}

function IndividualLinkSearch({
  model,
  onPatch,
  onPick,
  isPicked,
}: {
  model: LinkBuilderModel;
  onPatch: (patch: Partial<LinkBuilderModel>) => void;
  onPick: (link: SelectedNoteLink) => void;
  isPicked: (kind: NoteLinkKind, id: string) => boolean;
}) {
  return (
    <IndividualSearchPicker
      idPrefix={`ilink-${model.id}`}
      givenValue={model.indGiven}
      lastValue={model.indLast}
      onGivenChange={(v) => onPatch({ indGiven: v })}
      onLastChange={(v) => onPatch({ indLast: v })}
      isPickDisabled={(ind) => isPicked("individual", ind.id)}
      onPick={(ind) =>
        onPick({ kind: "individual", id: ind.id, label: individualSearchDisplayName(ind) })
      }
      limit={25}
    />
  );
}

function FamilyLinkSearch({
  model,
  onPatch,
  onPick,
  isPicked,
}: {
  model: LinkBuilderModel;
  onPatch: (patch: Partial<LinkBuilderModel>) => void;
  onPick: (link: SelectedNoteLink) => void;
  isPicked: (kind: NoteLinkKind, id: string) => boolean;
}) {
  return (
    <FamilySearchPicker
      idPrefix={`note-fam-${model.id}`}
      p1GivenValue={model.famP1Given}
      p1LastValue={model.famP1Last}
      p2GivenValue={model.famP2Given}
      p2LastValue={model.famP2Last}
      onP1GivenChange={(v) => onPatch({ famP1Given: v })}
      onP1LastChange={(v) => onPatch({ famP1Last: v })}
      onP2GivenChange={(v) => onPatch({ famP2Given: v })}
      onP2LastChange={(v) => onPatch({ famP2Last: v })}
      limit={25}
      isPickDisabled={(f) => isPicked("family", f.id)}
      onPick={(f) => onPick({ kind: "family", id: f.id, label: familyUnionPrimaryLine(f) })}
    />
  );
}

function EventLinkSearch({
  model,
  onPatch,
  onPick,
  isPicked,
}: {
  model: LinkBuilderModel;
  onPatch: (patch: Partial<LinkBuilderModel>) => void;
  onPick: (link: SelectedNoteLink) => void;
  isPicked: (kind: NoteLinkKind, id: string) => boolean;
}) {
  return (
    <EventPicker
      idPrefix={`note-ev-${model.id}`}
      requireEventType={false}
      eventType={model.evEventType}
      onEventTypeChange={(v) => onPatch({ evEventType: v })}
      linkScope={model.evScope}
      onLinkScopeChange={(v) =>
        onPatch({
          evScope: v,
          ...(v === "individual"
            ? { evP1Given: "", evP1Last: "", evP2Given: "", evP2Last: "" }
            : { evIndGiven: "", evIndLast: "" }),
        })
      }
      indGiven={model.evIndGiven}
      indLast={model.evIndLast}
      onIndGivenChange={(v) => onPatch({ evIndGiven: v })}
      onIndLastChange={(v) => onPatch({ evIndLast: v })}
      famP1Given={model.evP1Given}
      famP1Last={model.evP1Last}
      famP2Given={model.evP2Given}
      famP2Last={model.evP2Last}
      onFamP1GivenChange={(v) => onPatch({ evP1Given: v })}
      onFamP1LastChange={(v) => onPatch({ evP1Last: v })}
      onFamP2GivenChange={(v) => onPatch({ evP2Given: v })}
      onFamP2LastChange={(v) => onPatch({ evP2Last: v })}
      isPickDisabled={(ev) => isPicked("event", ev.id)}
      onPick={(ev) => onPick({ kind: "event", id: ev.id, label: formatNoteEventPickerLabel(ev) })}
      limit={25}
    />
  );
}

function SourceLinkSearch({
  model,
  onPatch,
  onPick,
  isPicked,
}: {
  model: LinkBuilderModel;
  onPatch: (patch: Partial<LinkBuilderModel>) => void;
  onPick: (link: SelectedNoteLink) => void;
  isPicked: (kind: NoteLinkKind, id: string) => boolean;
}) {
  const q = model.srcQ.trim() || undefined;
  const { data, isLoading } = useAdminSources({ q, limit: 25, offset: 0 });
  const rows = data?.sources ?? [];

  return (
    <>
      <div className="space-y-1">
        <Label htmlFor={`sq-${model.id}`}>Search title or xref</Label>
        <Input
          id={`sq-${model.id}`}
          value={model.srcQ}
          onChange={(e) => onPatch({ srcQ: e.target.value })}
          placeholder="Substring…"
        />
      </div>
      <ResultsList loading={isLoading} empty={rows.length === 0}>
        {(rows as AdminSourceListItem[]).map((s) => {
          const label = s.title?.trim() || s.xref || s.id;
          const picked = isPicked("source", s.id);
          return (
            <li key={s.id}>
              <button
                type="button"
                disabled={picked}
                className="w-full px-3 py-2 text-left text-sm hover:bg-base-200 disabled:opacity-50"
                onClick={() => onPick({ kind: "source", id: s.id, label })}
              >
                {label}
                <span className="ml-1 font-mono text-xs text-muted-foreground">({s.xref})</span>
                {picked ? <span className="ml-2 text-xs text-muted-foreground">(already linked)</span> : null}
              </button>
            </li>
          );
        })}
      </ResultsList>
    </>
  );
}

function ResultsList({
  loading,
  empty,
  children,
}: {
  loading: boolean;
  empty: boolean;
  children: ReactNode;
}) {
  if (loading) {
    return <p className="text-sm text-muted-foreground">Loading…</p>;
  }
  return (
    <ul className="max-h-52 overflow-auto rounded-lg border border-base-content/12">
      {empty ? (
        <li className="px-3 py-2 text-sm text-muted-foreground">No results. Adjust search.</li>
      ) : (
        children
      )}
    </ul>
  );
}
