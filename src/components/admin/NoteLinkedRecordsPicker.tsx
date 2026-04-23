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
import { useAdminIndividuals, type AdminIndividualListItem } from "@/hooks/useAdminIndividuals";
import { useAdminFamilies, type AdminFamilyListItem } from "@/hooks/useAdminFamilies";
import { useAdminEvents, type AdminEventListItem } from "@/hooks/useAdminEvents";
import { useAdminSources, type AdminSourceListItem } from "@/hooks/useAdminSources";
import { formatDisplayNameFromNameForms, stripSlashesFromName } from "@/lib/gedcom/display-name";
import { GEDCOM_EVENT_TYPE_LABELS } from "@/lib/gedcom/gedcom-event-labels";
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

const EVENT_TYPE_TAGS = Object.keys(GEDCOM_EVENT_TYPE_LABELS).sort();

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

function familySearchLabel(f: AdminFamilyListItem): string {
  const h = stripSlashesFromName(f.husband?.fullName) ?? "";
  const w = stripSlashesFromName(f.wife?.fullName) ?? "";
  return `${h} & ${w}`.replace(/^ & | & $/g, "").trim() || f.xref || f.id;
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
  const given = model.indGiven.trim().toLowerCase();
  const last = model.indLast.trim();
  const { data, isLoading } = useAdminIndividuals({
    givenName: given || undefined,
    lastName: last || undefined,
    limit: 25,
    offset: 0,
  });
  const rows = data?.individuals ?? [];

  return (
    <>
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-1">
          <Label htmlFor={`ig-${model.id}`}>Given name contains</Label>
          <Input
            id={`ig-${model.id}`}
            value={model.indGiven}
            onChange={(e) => onPatch({ indGiven: e.target.value })}
            placeholder="e.g. Maria"
          />
        </div>
        <div className="space-y-1">
          <Label htmlFor={`il-${model.id}`}>Last name prefix</Label>
          <Input
            id={`il-${model.id}`}
            value={model.indLast}
            onChange={(e) => onPatch({ indLast: e.target.value })}
            placeholder="GEDCOM slash-aware prefix"
          />
          <p className="text-xs text-muted-foreground">Matches surnames in slashes, same as the individuals list.</p>
        </div>
      </div>
      <ResultsList loading={isLoading} empty={rows.length === 0}>
        {(rows as AdminIndividualListItem[]).map((ind) => {
          const label =
            formatDisplayNameFromNameForms(ind.individualNameForms, ind.fullName) ||
            stripSlashesFromName(ind.fullName) ||
            ind.xref ||
            ind.id;
          const picked = isPicked("individual", ind.id);
          return (
            <li key={ind.id}>
              <button
                type="button"
                disabled={picked}
                className="w-full px-3 py-2 text-left text-sm hover:bg-base-200 disabled:opacity-50"
                onClick={() => onPick({ kind: "individual", id: ind.id, label })}
              >
                {label}
                <span className="ml-1 font-mono text-xs text-muted-foreground">({ind.xref})</span>
                {picked ? <span className="ml-2 text-xs text-muted-foreground">(already linked)</span> : null}
              </button>
            </li>
          );
        })}
      </ResultsList>
    </>
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
  const { data, isLoading } = useAdminFamilies({
    p1Given: model.famP1Given.trim().toLowerCase() || undefined,
    p1Last: model.famP1Last.trim() || undefined,
    p2Given: model.famP2Given.trim().toLowerCase() || undefined,
    p2Last: model.famP2Last.trim() || undefined,
    limit: 25,
    offset: 0,
  });
  const rows = data?.families ?? [];

  return (
    <>
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-2 rounded-md border border-base-content/10 bg-base-100/40 p-3">
          <p className="text-xs font-medium text-muted-foreground">Partner 1</p>
          <div className="space-y-1">
            <Label htmlFor={`f1g-${model.id}`}>Given name contains</Label>
            <Input
              id={`f1g-${model.id}`}
              value={model.famP1Given}
              onChange={(e) => onPatch({ famP1Given: e.target.value })}
              placeholder="e.g. Alex"
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor={`f1l-${model.id}`}>Last name prefix</Label>
            <Input
              id={`f1l-${model.id}`}
              value={model.famP1Last}
              onChange={(e) => onPatch({ famP1Last: e.target.value })}
              placeholder="GEDCOM slash-aware"
            />
          </div>
        </div>
        <div className="space-y-2 rounded-md border border-base-content/10 bg-base-100/40 p-3">
          <p className="text-xs font-medium text-muted-foreground">Partner 2</p>
          <div className="space-y-1">
            <Label htmlFor={`f2g-${model.id}`}>Given name contains</Label>
            <Input
              id={`f2g-${model.id}`}
              value={model.famP2Given}
              onChange={(e) => onPatch({ famP2Given: e.target.value })}
              placeholder="e.g. Jordan"
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor={`f2l-${model.id}`}>Last name prefix</Label>
            <Input
              id={`f2l-${model.id}`}
              value={model.famP2Last}
              onChange={(e) => onPatch({ famP2Last: e.target.value })}
              placeholder="GEDCOM slash-aware"
            />
          </div>
        </div>
      </div>
      <ResultsList loading={isLoading} empty={rows.length === 0}>
        {(rows as AdminFamilyListItem[]).map((f) => {
          const label = familySearchLabel(f);
          const picked = isPicked("family", f.id);
          return (
            <li key={f.id}>
              <button
                type="button"
                disabled={picked}
                className="w-full px-3 py-2 text-left text-sm hover:bg-base-200 disabled:opacity-50"
                onClick={() => onPick({ kind: "family", id: f.id, label })}
              >
                {label}
                <span className="ml-1 font-mono text-xs text-muted-foreground">({f.xref})</span>
                {picked ? <span className="ml-2 text-xs text-muted-foreground">(already linked)</span> : null}
              </button>
            </li>
          );
        })}
      </ResultsList>
    </>
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
  const eventOpts = useMemo(() => {
    const et = model.evEventType.trim();
    return {
      eventType: et || undefined,
      linkType: model.evScope,
      linkedGiven:
        model.evScope === "individual" ? model.evIndGiven.trim().toLowerCase() || undefined : undefined,
      linkedLast: model.evScope === "individual" ? model.evIndLast.trim() || undefined : undefined,
      p1Given: model.evScope === "family" ? model.evP1Given.trim().toLowerCase() || undefined : undefined,
      p1Last: model.evScope === "family" ? model.evP1Last.trim() || undefined : undefined,
      p2Given: model.evScope === "family" ? model.evP2Given.trim().toLowerCase() || undefined : undefined,
      p2Last: model.evScope === "family" ? model.evP2Last.trim() || undefined : undefined,
      limit: 25,
      offset: 0,
    };
  }, [
    model.evEventType,
    model.evScope,
    model.evIndGiven,
    model.evIndLast,
    model.evP1Given,
    model.evP1Last,
    model.evP2Given,
    model.evP2Last,
  ]);

  const { data, isLoading } = useAdminEvents(eventOpts);
  const rows = data?.events ?? [];

  return (
    <>
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-1">
          <Label htmlFor={`evt-${model.id}`}>Event type</Label>
          <select
            id={`evt-${model.id}`}
            className={selectClassName}
            value={model.evEventType}
            onChange={(e) => onPatch({ evEventType: e.target.value })}
          >
            <option value="">Any type</option>
            {EVENT_TYPE_TAGS.map((tag) => (
              <option key={tag} value={tag}>
                {tag} — {GEDCOM_EVENT_TYPE_LABELS[tag] ?? tag}
              </option>
            ))}
          </select>
        </div>
        <div className="space-y-1">
          <Label htmlFor={`evs-${model.id}`}>Linked to</Label>
          <select
            id={`evs-${model.id}`}
            className={selectClassName}
            value={model.evScope}
            onChange={(e) => onPatch({ evScope: e.target.value as "individual" | "family" })}
          >
            <option value="individual">Individual (person event)</option>
            <option value="family">Family (e.g. marriage)</option>
          </select>
          <p className="text-xs text-muted-foreground">
            Filters match events attached to a person vs. a family, same as the events list.
          </p>
        </div>
      </div>

      {model.evScope === "individual" ? (
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-1">
            <Label htmlFor={`eig-${model.id}`}>Linked person — given contains</Label>
            <Input
              id={`eig-${model.id}`}
              value={model.evIndGiven}
              onChange={(e) => onPatch({ evIndGiven: e.target.value })}
              placeholder="Structured given tokens"
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor={`eil-${model.id}`}>Linked person — last name prefix</Label>
            <Input
              id={`eil-${model.id}`}
              value={model.evIndLast}
              onChange={(e) => onPatch({ evIndLast: e.target.value })}
              placeholder="GEDCOM slash-aware prefix"
            />
          </div>
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-2 rounded-md border border-base-content/10 bg-base-100/40 p-3">
            <p className="text-xs font-medium text-muted-foreground">Partner 1 (family)</p>
            <div className="space-y-1">
              <Label htmlFor={`ef1g-${model.id}`}>Given contains</Label>
              <Input
                id={`ef1g-${model.id}`}
                value={model.evP1Given}
                onChange={(e) => onPatch({ evP1Given: e.target.value })}
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor={`ef1l-${model.id}`}>Last name prefix</Label>
              <Input
                id={`ef1l-${model.id}`}
                value={model.evP1Last}
                onChange={(e) => onPatch({ evP1Last: e.target.value })}
              />
            </div>
          </div>
          <div className="space-y-2 rounded-md border border-base-content/10 bg-base-100/40 p-3">
            <p className="text-xs font-medium text-muted-foreground">Partner 2 (family)</p>
            <div className="space-y-1">
              <Label htmlFor={`ef2g-${model.id}`}>Given contains</Label>
              <Input
                id={`ef2g-${model.id}`}
                value={model.evP2Given}
                onChange={(e) => onPatch({ evP2Given: e.target.value })}
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor={`ef2l-${model.id}`}>Last name prefix</Label>
              <Input
                id={`ef2l-${model.id}`}
                value={model.evP2Last}
                onChange={(e) => onPatch({ evP2Last: e.target.value })}
              />
            </div>
          </div>
        </div>
      )}

      <ResultsList loading={isLoading} empty={rows.length === 0}>
        {(rows as AdminEventListItem[]).map((ev) => {
          const label = formatNoteEventPickerLabel(ev);
          const picked = isPicked("event", ev.id);
          return (
            <li key={ev.id}>
              <button
                type="button"
                disabled={picked}
                className="w-full px-3 py-2 text-left text-sm hover:bg-base-200 disabled:opacity-50"
                onClick={() => onPick({ kind: "event", id: ev.id, label })}
              >
                <span className="font-medium text-base-content">{label}</span>
                {picked ? <span className="ml-2 text-xs text-muted-foreground">(already linked)</span> : null}
              </button>
            </li>
          );
        })}
      </ResultsList>
    </>
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
