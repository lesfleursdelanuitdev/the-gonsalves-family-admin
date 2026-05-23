"use client";

import { useState } from "react";
import { MapPin, Plus, Pencil, Trash2, X, ArrowRight } from "lucide-react";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import {
  useResolvedPlaces,
  useResolvedPlace,
  useCreateResolvedPlace,
  usePatchResolvedPlace,
  useDeleteResolvedPlace,
  useCreateAlias,
  useDeleteAlias,
  useDeleteLink,
  useCreateLink,
  useBatchMoveLinks,
  type ResolvedPlaceListItem,
  type ResolvedPlaceDetail,
} from "@/hooks/usePlaceResolution";
import { useAdminPlaces } from "@/hooks/useAdminGedcomCatalogs";

const ALIAS_TYPE_OPTIONS = [
  { value: "historical", label: "Historical" },
  { value: "colonial",   label: "Colonial" },
  { value: "local",      label: "Local" },
  { value: "variant",    label: "Variant" },
  { value: "abbreviation", label: "Abbreviation" },
  { value: "transliteration", label: "Transliteration" },
];

// ── Small usage total helper ───────────────────────────────────────────────────

function usageTotalOf(c: Record<string, number> | undefined): number {
  if (!c) return 0;
  return Object.values(c).reduce((s, v) => s + v, 0);
}

// ── Create / Edit form ────────────────────────────────────────────────────────

type FormState = {
  displayName: string;
  name: string;
  county: string;
  state: string;
  country: string;
  latitude: string;
  longitude: string;
  notes: string;
};

function emptyForm(): FormState {
  return { displayName: "", name: "", county: "", state: "", country: "", latitude: "", longitude: "", notes: "" };
}

function formFromDetail(p: ResolvedPlaceListItem | ResolvedPlaceDetail): FormState {
  return {
    displayName: p.displayName,
    name: p.name ?? "",
    county: p.county ?? "",
    state: p.state ?? "",
    country: p.country ?? "",
    latitude: p.latitude != null ? String(p.latitude) : "",
    longitude: p.longitude != null ? String(p.longitude) : "",
    notes: p.notes ?? "",
  };
}

function ResolvedPlaceForm({
  initial,
  onSave,
  onCancel,
  busy,
  error,
  title,
}: {
  initial: FormState;
  onSave: (f: FormState) => void;
  onCancel: () => void;
  busy: boolean;
  error: string | null;
  title: string;
}) {
  const [f, setF] = useState<FormState>(initial);
  const set = (k: keyof FormState, v: string) => setF((prev) => ({ ...prev, [k]: v }));

  return (
    <form
      onSubmit={(e) => { e.preventDefault(); onSave(f); }}
      className="space-y-3 text-sm"
    >
      <p className="font-semibold text-base-content">{title}</p>
      <div className="space-y-1">
        <Label className="text-xs">Display name *</Label>
        <Input value={f.displayName} onChange={(e) => set("displayName", e.target.value)} className="h-7 text-xs" />
        <p className="text-xs text-muted-foreground">Authoritative human-readable label — never auto-overwritten by scans.</p>
      </div>
      <div className="grid grid-cols-2 gap-2">
        <div className="space-y-1">
          <Label className="text-xs">Name (specific)</Label>
          <Input value={f.name} onChange={(e) => set("name", e.target.value)} className="h-7 text-xs" placeholder="e.g. Georgetown" />
        </div>
        <div className="space-y-1">
          <Label className="text-xs">County</Label>
          <Input value={f.county} onChange={(e) => set("county", e.target.value)} className="h-7 text-xs" />
        </div>
        <div className="space-y-1">
          <Label className="text-xs">State / province</Label>
          <Input value={f.state} onChange={(e) => set("state", e.target.value)} className="h-7 text-xs" placeholder="e.g. Demerara" />
        </div>
        <div className="space-y-1">
          <Label className="text-xs">Country</Label>
          <Input value={f.country} onChange={(e) => set("country", e.target.value)} className="h-7 text-xs" placeholder="e.g. Guyana" />
        </div>
        <div className="space-y-1">
          <Label className="text-xs">Latitude</Label>
          <Input value={f.latitude} onChange={(e) => set("latitude", e.target.value)} className="h-7 text-xs" placeholder="6.8013" />
        </div>
        <div className="space-y-1">
          <Label className="text-xs">Longitude</Label>
          <Input value={f.longitude} onChange={(e) => set("longitude", e.target.value)} className="h-7 text-xs" placeholder="-58.1551" />
        </div>
      </div>
      <div className="space-y-1">
        <Label className="text-xs">Notes</Label>
        <Input value={f.notes} onChange={(e) => set("notes", e.target.value)} className="h-7 text-xs" placeholder="Historical context, disambiguation notes…" />
      </div>
      {error && <p className="text-xs text-destructive">{error}</p>}
      <div className="flex gap-2">
        <Button type="submit" size="sm" className="h-7 text-xs" disabled={busy}>
          {busy ? "Saving…" : "Save"}
        </Button>
        <Button type="button" variant="ghost" size="sm" className="h-7 text-xs" onClick={onCancel} disabled={busy}>
          Cancel
        </Button>
      </div>
    </form>
  );
}

// ── Unlinked place picker ─────────────────────────────────────────────────────

function LinkPlacesPicker({ resolvedPlaceId, onLinked }: { resolvedPlaceId: string; onLinked: () => void }) {
  const [q, setQ] = useState("");
  const { data, isFetching } = useAdminPlaces({ q: q.trim() || undefined, unlinked: true, limit: 20 });
  const createLink = useCreateLink();
  const places = data?.places ?? [];

  return (
    <div className="space-y-2">
      <Input
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder="Search unlinked GEDCOM places…"
        className="h-7 text-xs"
      />
      {isFetching && <p className="py-1 text-center text-xs text-muted-foreground">Searching…</p>}
      {!isFetching && q.trim() && places.length === 0 && (
        <p className="py-1 text-center text-xs text-muted-foreground">No unlinked places found.</p>
      )}
      {places.length > 0 && (
        <ul className="max-h-52 overflow-y-auto rounded-sm border border-base-content/10">
          {places.map((p) => (
            <li key={p.id} className="border-b border-base-content/5 last:border-0">
              <button
                type="button"
                disabled={createLink.isPending}
                onClick={async () => {
                  await createLink.mutateAsync({
                    gedcomPlaceId: p.id,
                    resolvedPlaceId,
                    matchMethod: "manual",
                    confidence: 100,
                  });
                  onLinked();
                }}
                className="w-full px-2 py-1.5 text-left text-xs hover:bg-base-content/8 disabled:opacity-50"
              >
                <span className="block truncate font-medium">{p.original}</span>
                {(p.name || p.state || p.country) && (
                  <span className="block truncate text-muted-foreground">
                    {[p.name, p.state, p.country].filter(Boolean).join(", ")}
                  </span>
                )}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

// ── Move links picker ─────────────────────────────────────────────────────────

function MoveLinksPicker({
  selectedCount,
  currentResolvedPlaceId,
  onMove,
  onCancel,
  busy,
}: {
  selectedCount: number;
  currentResolvedPlaceId: string;
  onMove: (targetId: string) => void;
  onCancel: () => void;
  busy: boolean;
}) {
  const [q, setQ] = useState("");
  const { data, isFetching } = useResolvedPlaces(q.trim() || undefined);
  const places = (data?.resolved ?? []).filter((p) => p.id !== currentResolvedPlaceId);

  return (
    <div className="rounded-md border border-primary/20 bg-primary/[0.03] p-3 space-y-2">
      <div className="flex items-center justify-between gap-2">
        <p className="text-xs font-medium">
          Move {selectedCount} selected {selectedCount === 1 ? "place" : "places"} to:
        </p>
        <button
          type="button"
          onClick={onCancel}
          className="text-muted-foreground hover:text-foreground"
          aria-label="Cancel move"
        >
          <X className="size-3.5" />
        </button>
      </div>
      <Input
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder="Search resolved places…"
        className="h-7 text-xs"
        autoFocus
      />
      {isFetching && <p className="py-1 text-center text-xs text-muted-foreground">Searching…</p>}
      {!isFetching && places.length === 0 && (
        <p className="py-1 text-center text-xs text-muted-foreground">No other resolved places found.</p>
      )}
      {places.length > 0 && (
        <ul className="max-h-52 overflow-y-auto rounded-sm border border-base-content/10">
          {places.map((p) => (
            <li key={p.id} className="border-b border-base-content/5 last:border-0">
              <button
                type="button"
                disabled={busy}
                onClick={() => onMove(p.id)}
                className="w-full px-2 py-1.5 text-left text-xs hover:bg-base-content/8 disabled:opacity-50"
              >
                <span className="block truncate font-medium">{p.displayName}</span>
                {(p.state || p.country) && (
                  <span className="block truncate text-muted-foreground">
                    {[p.state, p.country].filter(Boolean).join(", ")}
                  </span>
                )}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

// ── Detail pane ───────────────────────────────────────────────────────────────

function ResolvedPlaceDetailPane({ id, onDeleted }: { id: string; onDeleted: () => void }) {
  const { data, isLoading } = useResolvedPlace(id);
  const patchResolved = usePatchResolvedPlace();
  const deleteResolved = useDeleteResolvedPlace();
  const createAlias = useCreateAlias();
  const deleteAlias = useDeleteAlias();
  const deleteLink = useDeleteLink();
  const batchMove = useBatchMoveLinks();

  const [editing, setEditing] = useState(false);
  const [showPicker, setShowPicker] = useState(false);
  const [showMovePanel, setShowMovePanel] = useState(false);
  const [selectedLinkIds, setSelectedLinkIds] = useState<Set<string>>(new Set());
  const [formError, setFormError] = useState<string | null>(null);
  const [aliasInput, setAliasInput] = useState("");
  const [aliasType, setAliasType] = useState("historical");

  const p = data?.resolved;

  if (isLoading) return <p className="p-4 text-sm text-muted-foreground">Loading…</p>;
  if (!p) return <p className="p-4 text-sm text-muted-foreground">Not found.</p>;

  async function handleSave(f: FormState) {
    setFormError(null);
    try {
      await patchResolved.mutateAsync({
        id: p!.id,
        displayName: f.displayName,
        name: f.name || null,
        county: f.county || null,
        state: f.state || null,
        country: f.country || null,
        latitude: f.latitude ? parseFloat(f.latitude) : null,
        longitude: f.longitude ? parseFloat(f.longitude) : null,
        notes: f.notes || null,
      });
      setEditing(false);
    } catch (err) {
      setFormError(err instanceof Error ? err.message : String(err));
    }
  }

  async function handleDelete() {
    if (!window.confirm(`Delete "${p!.displayName}"? This cannot be undone.`)) return;
    try {
      await deleteResolved.mutateAsync(p!.id);
      onDeleted();
    } catch (err) {
      alert(err instanceof Error ? err.message : String(err));
    }
  }

  function toggleLinkSelection(linkId: string) {
    setSelectedLinkIds((prev) => {
      const next = new Set(prev);
      if (next.has(linkId)) next.delete(linkId);
      else next.add(linkId);
      return next;
    });
  }

  function toggleSelectAll() {
    if (!p) return;
    if (selectedLinkIds.size === p.links.length) {
      setSelectedLinkIds(new Set());
    } else {
      setSelectedLinkIds(new Set(p.links.map((l) => l.id)));
    }
  }

  async function handleMoveSelected(targetResolvedPlaceId: string) {
    const count = selectedLinkIds.size;
    try {
      await batchMove.mutateAsync({
        linkIds: Array.from(selectedLinkIds),
        targetResolvedPlaceId,
      });
      setSelectedLinkIds(new Set());
      setShowMovePanel(false);
      toast.success(`${count} ${count === 1 ? "place" : "places"} moved.`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Move failed.");
    }
  }

  return (
    <div className="flex flex-col gap-4 overflow-y-auto p-1">
      {editing ? (
        <ResolvedPlaceForm
          initial={formFromDetail(p)}
          onSave={handleSave}
          onCancel={() => setEditing(false)}
          busy={patchResolved.isPending}
          error={formError}
          title="Edit resolved place"
        />
      ) : (
        <div className="space-y-2">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0 flex-1">
              <h3 className="font-semibold leading-tight">{p.displayName}</h3>
              {(p.state || p.country) && (
                <p className="text-xs text-muted-foreground">
                  {[p.state, p.country].filter(Boolean).join(", ")}
                </p>
              )}
            </div>
            <div className="flex shrink-0 gap-1">
              <Button variant="ghost" size="icon-sm" onClick={() => setEditing(true)} title="Edit">
                <Pencil className="size-3.5" />
              </Button>
              <Button
                variant="ghost"
                size="icon-sm"
                className="hover:text-destructive"
                onClick={handleDelete}
                disabled={deleteResolved.isPending}
                title="Delete"
              >
                <Trash2 className="size-3.5" />
              </Button>
            </div>
          </div>
          <dl className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs">
            {p.name && <><dt className="text-muted-foreground">Name</dt><dd>{p.name}</dd></>}
            {p.county && <><dt className="text-muted-foreground">County</dt><dd>{p.county}</dd></>}
            {p.state && <><dt className="text-muted-foreground">State</dt><dd>{p.state}</dd></>}
            {p.country && <><dt className="text-muted-foreground">Country</dt><dd>{p.country}</dd></>}
            {p.latitude && <><dt className="text-muted-foreground">Lat</dt><dd className="font-mono">{p.latitude}</dd></>}
            {p.longitude && <><dt className="text-muted-foreground">Lon</dt><dd className="font-mono">{p.longitude}</dd></>}
          </dl>
          {p.notes && <p className="text-xs text-muted-foreground italic">{p.notes}</p>}
        </div>
      )}

      {/* Aliases */}
      <section className="space-y-2">
        <h4 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Historical / variant names
        </h4>
        {p.aliases.length > 0 ? (
          <ul className="space-y-1">
            {p.aliases.map((a) => (
              <li key={a.id} className="flex items-center justify-between gap-2 rounded-sm border border-base-content/10 bg-base-content/[0.02] px-2.5 py-1.5 text-xs">
                <div>
                  <span className="font-medium">{a.alias}</span>
                  <span className="ml-1.5 text-muted-foreground">({a.aliasType})</span>
                </div>
                <button
                  type="button"
                  onClick={() => deleteAlias.mutate({ id: a.id, resolvedPlaceId: p.id })}
                  className="text-muted-foreground hover:text-destructive"
                  aria-label={`Remove alias ${a.alias}`}
                >
                  <X className="size-3" />
                </button>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-xs text-muted-foreground">No aliases yet.</p>
        )}
        <div className="flex gap-1.5">
          <Input
            value={aliasInput}
            onChange={(e) => setAliasInput(e.target.value)}
            placeholder="Add alias…"
            className="h-7 flex-1 text-xs"
          />
          <select
            value={aliasType}
            onChange={(e) => setAliasType(e.target.value)}
            className="h-7 rounded-md border border-base-content/20 bg-base-100 px-1.5 text-xs"
          >
            {ALIAS_TYPE_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>
          <Button
            size="sm"
            className="h-7 text-xs"
            disabled={!aliasInput.trim() || createAlias.isPending}
            onClick={() => {
              if (!aliasInput.trim()) return;
              createAlias.mutate({ resolvedPlaceId: p.id, alias: aliasInput.trim(), aliasType });
              setAliasInput("");
            }}
          >
            Add
          </Button>
        </div>
      </section>

      {/* Linked GEDCOM places */}
      <section className="space-y-2">
        <div className="flex items-center justify-between gap-2">
          <h4 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Linked GEDCOM places ({p.links.length})
          </h4>
          <div className="flex items-center gap-2">
            {selectedLinkIds.size > 0 && (
              <button
                type="button"
                onClick={() => setShowMovePanel((v) => !v)}
                className={cn(
                  "flex items-center gap-1 text-xs font-medium text-primary underline-offset-2 hover:underline",
                  showMovePanel && "underline",
                )}
              >
                <ArrowRight className="size-3" />
                Move {selectedLinkIds.size}
              </button>
            )}
            <button
              type="button"
              onClick={() => { setShowPicker((v) => !v); setShowMovePanel(false); }}
              className="text-xs text-primary underline"
            >
              {showPicker ? "Cancel" : "+ Link more"}
            </button>
          </div>
        </div>

        {p.links.length > 0 && (
          <button
            type="button"
            onClick={toggleSelectAll}
            className="text-xs text-muted-foreground underline-offset-2 hover:underline"
          >
            {selectedLinkIds.size === p.links.length ? "Deselect all" : "Select all"}
          </button>
        )}

        {showMovePanel && selectedLinkIds.size > 0 && (
          <MoveLinksPicker
            selectedCount={selectedLinkIds.size}
            currentResolvedPlaceId={p.id}
            onMove={handleMoveSelected}
            onCancel={() => setShowMovePanel(false)}
            busy={batchMove.isPending}
          />
        )}

        {p.links.length === 0 && !showPicker && (
          <p className="text-xs text-muted-foreground">No GEDCOM places linked yet.</p>
        )}
        {p.links.length > 0 && (
          <ul className="space-y-1">
            {p.links.map((link) => {
              const total = usageTotalOf(link.gedcomPlace._count as Record<string, number> | undefined);
              const checked = selectedLinkIds.has(link.id);
              return (
                <li
                  key={link.id}
                  className={cn(
                    "flex cursor-pointer items-center gap-2 rounded-sm border border-base-content/10 bg-base-content/[0.02] px-2.5 py-1.5 text-xs transition-colors",
                    checked && "border-primary/30 bg-primary/[0.04]",
                  )}
                  onClick={() => toggleLinkSelection(link.id)}
                >
                  <input
                    type="checkbox"
                    readOnly
                    checked={checked}
                    className="shrink-0 accent-primary"
                    aria-label={`Select ${link.gedcomPlace.original}`}
                  />
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-medium">{link.gedcomPlace.original}</p>
                    <p className="text-muted-foreground">
                      {link.matchMethod} · {total} use{total !== 1 ? "s" : ""}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={(e) => { e.stopPropagation(); deleteLink.mutate(link.id); }}
                    className="shrink-0 text-muted-foreground hover:text-destructive"
                    disabled={deleteLink.isPending}
                    aria-label="Unlink"
                  >
                    <X className="size-3" />
                  </button>
                </li>
              );
            })}
          </ul>
        )}
        {showPicker && (
          <LinkPlacesPicker
            resolvedPlaceId={p.id}
            onLinked={() => setShowPicker(false)}
          />
        )}
      </section>
    </div>
  );
}

// ── List card ─────────────────────────────────────────────────────────────────

function ResolvedPlaceCard({
  place,
  active,
  onClick,
}: {
  place: ResolvedPlaceListItem;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "w-full rounded-md border px-3 py-2.5 text-left text-sm transition-colors",
        active
          ? "border-primary/40 bg-primary/8 shadow-sm"
          : "border-base-content/10 bg-base-content/[0.02] hover:border-primary/20 hover:bg-base-content/5",
      )}
    >
      <div className="flex min-w-0 items-start justify-between gap-2">
        <span className="min-w-0 flex-1 truncate font-medium leading-tight">{place.displayName}</span>
        <div className="flex shrink-0 gap-1">
          {place._count.links > 0 && (
            <span className="badge badge-success badge-sm">{place._count.links} linked</span>
          )}
          {place._count.aliases > 0 && (
            <span className="badge badge-ghost badge-sm">{place._count.aliases} alias{place._count.aliases !== 1 ? "es" : ""}</span>
          )}
        </div>
      </div>
      {(place.state || place.country) && (
        <p className="mt-0.5 text-xs text-muted-foreground">
          {[place.state, place.country].filter(Boolean).join(", ")}
        </p>
      )}
    </button>
  );
}

// ── Main panel ────────────────────────────────────────────────────────────────

export function ResolvedPlacesPanel() {
  const [q, setQ] = useState("");
  const [debouncedQ, setDebouncedQ] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);

  const { data, isLoading } = useResolvedPlaces(debouncedQ || undefined);
  const createResolved = useCreateResolvedPlace();

  const places = data?.resolved ?? [];

  async function handleCreate(f: FormState) {
    setCreateError(null);
    try {
      const result = await createResolved.mutateAsync({
        displayName: f.displayName,
        name: f.name || null,
        county: f.county || null,
        state: f.state || null,
        country: f.country || null,
        latitude: f.latitude ? parseFloat(f.latitude) : null,
        longitude: f.longitude ? parseFloat(f.longitude) : null,
        notes: f.notes || null,
      });
      setSelectedId(result.resolved.id);
      setCreating(false);
    } catch (err) {
      setCreateError(err instanceof Error ? err.message : String(err));
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground">
          Curated canonical places. Each one can be linked to many GEDCOM place records and carry
          historical variant names (aliases).
        </p>
        <Button
          size="sm"
          onClick={() => { setCreating(true); setSelectedId(null); }}
        >
          <Plus className="mr-1.5 size-3.5" />
          New resolved place
        </Button>
      </div>

      <Input
        value={q}
        onChange={(e) => {
          setQ(e.target.value);
          setDebouncedQ(e.target.value);
        }}
        placeholder="Search resolved places…"
        className="h-8"
      />

      {creating && (
        <Card>
          <CardContent className="pt-4">
            <ResolvedPlaceForm
              initial={emptyForm()}
              onSave={handleCreate}
              onCancel={() => setCreating(false)}
              busy={createResolved.isPending}
              error={createError}
              title="Create resolved place"
            />
          </CardContent>
        </Card>
      )}

      {isLoading ? (
        <p className="py-4 text-center text-sm text-muted-foreground">Loading…</p>
      ) : places.length === 0 ? (
        <div className="rounded-md border border-base-content/10 bg-base-content/[0.02] px-4 py-8 text-center text-sm text-muted-foreground">
          {debouncedQ ? `No results for "${debouncedQ}".` : "No resolved places yet. Create one above or resolve a suggestion."}
        </div>
      ) : (
        <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)]">
          <div className="flex flex-col gap-2 overflow-y-auto">
            {places.map((p) => (
              <ResolvedPlaceCard
                key={p.id}
                place={p}
                active={selectedId === p.id}
                onClick={() => { setSelectedId(p.id === selectedId ? null : p.id); setCreating(false); }}
              />
            ))}
          </div>
          <div>
            {selectedId ? (
              <Card>
                <CardContent className="pt-4">
                  <ResolvedPlaceDetailPane
                    id={selectedId}
                    onDeleted={() => setSelectedId(null)}
                  />
                </CardContent>
              </Card>
            ) : (
              <div className="rounded-md border border-dashed border-base-content/15 px-4 py-8 text-center text-sm text-muted-foreground">
                Select a resolved place to view or edit it.
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
