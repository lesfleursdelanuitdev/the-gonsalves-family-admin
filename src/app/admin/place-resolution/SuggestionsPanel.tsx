"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import {
  useSuggestions,
  useSuggestion,
  usePatchSuggestion,
  useRunScan,
  useCreateResolvedPlace,
  useCreateLink,
  useDeleteLink,
  useResolvedPlaces,
  type SuggestionListItem,
  type SuggestionItem,
} from "@/hooks/usePlaceResolution";
import type { PlaceResolutionScanSummary } from "@/lib/admin/place-resolution-scan";

const REASON_LABELS: Record<string, string> = {
  exact_normalized: "Exact match",
  prefix_match: "Prefix / suffix",
  component_match: "Same region",
  coordinate_proximity: "Near coordinates",
  fuzzy: "Fuzzy name",
};

const STATUS_OPTIONS = [
  { value: "pending",  label: "Pending" },
  { value: "partial",  label: "Partial" },
  { value: "applied",  label: "Applied" },
  { value: "ignored",  label: "Ignored" },
];

function usageTotalOf(item: SuggestionItem): number {
  const c = item.gedcomPlace._count;
  if (!c) return 0;
  return (
    c.events +
    c.individualBirthPlaces +
    c.individualDeathPlaces +
    c.familyMarriagePlaces +
    c.familyDivorcePlaces +
    c.storyPlaces +
    c.mediaLinks
  );
}

function confidenceBadge(n: number) {
  if (n >= 90) return "badge badge-success badge-sm";
  if (n >= 70) return "badge badge-warning badge-sm";
  return "badge badge-ghost badge-sm";
}

function reasonBadge(reason: string) {
  if (reason === "exact_normalized") return "badge badge-info badge-sm";
  if (reason === "fuzzy") return "badge badge-ghost badge-sm";
  return "badge badge-outline badge-sm";
}

// ── Inline "Link to existing" picker for one item ─────────────────────────────

function LinkExistingPicker({
  gedcomPlaceId,
  onLinked,
  onCancel,
}: {
  gedcomPlaceId: string;
  onLinked: () => void;
  onCancel: () => void;
}) {
  const [q, setQ] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const { data } = useResolvedPlaces(q || undefined);
  const createLink = useCreateLink();

  const places = data?.resolved ?? [];

  return (
    <div className="mt-1 rounded-md border border-primary/30 bg-base-200/40 p-3 text-sm">
      <p className="mb-2 font-medium text-base-content/80">Link to existing resolved place</p>
      <Input
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder="Search resolved places…"
        className="mb-2 h-7 text-xs"
      />
      {places.length === 0 && q ? (
        <p className="py-1 text-center text-xs text-muted-foreground">No results</p>
      ) : (
        <ul className="max-h-36 overflow-y-auto rounded-sm border border-base-content/10">
          {places.map((p) => (
            <li key={p.id}>
              <button
                type="button"
                onClick={() => setSelectedId(p.id)}
                className={cn(
                  "w-full px-2 py-1.5 text-left text-xs hover:bg-base-content/8",
                  selectedId === p.id && "bg-primary/10 font-medium",
                )}
              >
                <span className="block truncate">{p.displayName}</span>
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
      <div className="mt-2 flex gap-2">
        <Button
          size="sm"
          className="h-7 text-xs"
          disabled={!selectedId || createLink.isPending}
          onClick={async () => {
            if (!selectedId) return;
            await createLink.mutateAsync({
              gedcomPlaceId,
              resolvedPlaceId: selectedId,
              matchMethod: "manual",
              confidence: 100,
            });
            onLinked();
          }}
        >
          Link
        </Button>
        <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={onCancel}>
          Cancel
        </Button>
      </div>
    </div>
  );
}

// ── "Resolve all to new place" inline form ────────────────────────────────────

function ResolveGroupForm({
  unlinkedIds,
  prefillName,
  onDone,
  onCancel,
}: {
  unlinkedIds: string[];
  prefillName: string;
  onDone: () => void;
  onCancel: () => void;
}) {
  const createResolved = useCreateResolvedPlace();
  const createLink = useCreateLink();

  const [displayName, setDisplayName] = useState(prefillName);
  const [name, setName] = useState("");
  const [county, setCounty] = useState("");
  const [state, setState] = useState("");
  const [country, setCountry] = useState("");
  const [notes, setNotes] = useState("");
  const [aliasInput, setAliasInput] = useState("");
  const [aliases, setAliases] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);

  // Build a live search query from all detail fields so matches update as the
  // user fills in the form. Only search when at least one field has a value.
  const searchQ = [displayName, name, state, country].filter(Boolean).join(" ").trim();
  const { data: matchData, isFetching: matchFetching } = useResolvedPlaces(searchQ || undefined);
  const matchingPlaces = searchQ ? (matchData?.resolved ?? []) : [];

  async function handleUseExisting(resolvedPlaceId: string) {
    setError(null);
    try {
      for (const gedcomPlaceId of unlinkedIds) {
        await createLink.mutateAsync({ gedcomPlaceId, resolvedPlaceId, matchMethod: "manual" });
      }
      onDone();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!displayName.trim()) { setError("Display name is required"); return; }
    setError(null);
    try {
      const result = await createResolved.mutateAsync({
        displayName: displayName.trim(),
        name: name.trim() || null,
        county: county.trim() || null,
        state: state.trim() || null,
        country: country.trim() || null,
        notes: notes.trim() || null,
        aliases: aliases.map((a) => ({ alias: a, aliasType: "historical" })),
      });
      const resolvedPlaceId = result.resolved.id;
      for (const gedcomPlaceId of unlinkedIds) {
        await createLink.mutateAsync({ gedcomPlaceId, resolvedPlaceId, matchMethod: "manual" });
      }
      onDone();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  }

  const busy = createResolved.isPending || createLink.isPending;

  return (
    <form onSubmit={handleSubmit} className="mt-2 space-y-3 rounded-md border border-primary/30 bg-base-200/40 p-3 text-sm">
      <p className="font-medium text-base-content/80">
        Resolve {unlinkedIds.length} item{unlinkedIds.length !== 1 ? "s" : ""} — select an existing place or create a new one
      </p>
      <div className="space-y-1">
        <Label className="text-xs">Display name *</Label>
        <Input value={displayName} onChange={(e) => setDisplayName(e.target.value)} className="h-7 text-xs" />
      </div>
      <div className="grid grid-cols-2 gap-2">
        <div className="space-y-1">
          <Label className="text-xs">City / locality</Label>
          <Input value={name} onChange={(e) => setName(e.target.value)} className="h-7 text-xs" placeholder="e.g. Georgetown" />
        </div>
        <div className="space-y-1">
          <Label className="text-xs">County</Label>
          <Input value={county} onChange={(e) => setCounty(e.target.value)} className="h-7 text-xs" placeholder="e.g. Demerara-Mahaica" />
        </div>
        <div className="space-y-1">
          <Label className="text-xs">State / province</Label>
          <Input value={state} onChange={(e) => setState(e.target.value)} className="h-7 text-xs" placeholder="e.g. Demerara" />
        </div>
        <div className="space-y-1">
          <Label className="text-xs">Country</Label>
          <Input value={country} onChange={(e) => setCountry(e.target.value)} className="h-7 text-xs" placeholder="e.g. Guyana" />
        </div>
      </div>
      <div className="space-y-1">
        <Label className="text-xs">Notes</Label>
        <Input value={notes} onChange={(e) => setNotes(e.target.value)} className="h-7 text-xs" placeholder="Optional notes…" />
      </div>
      <div className="space-y-1">
        <Label className="text-xs">Historical / variant names</Label>
        <div className="flex gap-1.5">
          <Input
            value={aliasInput}
            onChange={(e) => setAliasInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                if (aliasInput.trim()) { setAliases((a) => [...a, aliasInput.trim()]); setAliasInput(""); }
              }
            }}
            placeholder="Add alias, press Enter"
            className="h-7 flex-1 text-xs"
          />
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="h-7 text-xs"
            onClick={() => { if (aliasInput.trim()) { setAliases((a) => [...a, aliasInput.trim()]); setAliasInput(""); } }}
          >
            Add
          </Button>
        </div>
        {aliases.length > 0 && (
          <ul className="flex flex-wrap gap-1 pt-1">
            {aliases.map((a, i) => (
              <li key={i} className="flex items-center gap-0.5 rounded-full border border-base-content/15 bg-base-content/5 px-2 py-0.5 text-xs">
                {a}
                <button
                  type="button"
                  onClick={() => setAliases((prev) => prev.filter((_, j) => j !== i))}
                  className="ml-1 text-muted-foreground hover:text-destructive"
                  aria-label={`Remove ${a}`}
                >×</button>
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* Live matches against existing resolved places */}
      {searchQ && (
        <div className="space-y-1.5">
          <p className="text-xs font-medium text-muted-foreground">
            {matchFetching
              ? "Searching existing places…"
              : matchingPlaces.length > 0
              ? "Existing matches — click to use instead of creating:"
              : "No existing places match — a new one will be created."}
          </p>
          {matchingPlaces.length > 0 && (
            <ul className="max-h-40 overflow-y-auto rounded-sm border border-base-content/10">
              {matchingPlaces.map((p) => (
                <li key={p.id} className="border-b border-base-content/5 last:border-0">
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => handleUseExisting(p.id)}
                    className="w-full px-2 py-1.5 text-left text-xs hover:bg-primary/8 disabled:opacity-50"
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
      )}

      {error && <p className="text-xs text-destructive">{error}</p>}
      <div className="flex gap-2">
        <Button type="submit" size="sm" className="h-7 text-xs" disabled={busy}>
          {busy ? "Saving…" : "Create new & link all"}
        </Button>
        <Button type="button" variant="ghost" size="sm" className="h-7 text-xs" onClick={onCancel} disabled={busy}>
          Cancel
        </Button>
      </div>
    </form>
  );
}

// ── Item row in suggestion detail ─────────────────────────────────────────────

function SuggestionItemRow({
  item,
  selected,
  onToggle,
}: {
  item: SuggestionItem;
  selected?: boolean;
  onToggle?: () => void;
}) {
  const [mode, setMode] = useState<"none" | "link-existing">("none");
  const deleteLink = useDeleteLink();
  const usageTotal = usageTotalOf(item);
  const linked = item.gedcomPlace.resolvedLink;
  const selectable = !linked && mode === "none";

  return (
    <div
      className={cn(
        "rounded-md border px-3 py-2 text-sm transition-colors",
        selected
          ? "border-primary/50 bg-primary/8"
          : item.isPrimary
          ? "border-primary/30 bg-primary/5"
          : "border-base-content/10 bg-base-content/[0.02]",
        selectable && "cursor-pointer hover:border-primary/30 hover:bg-base-content/5",
      )}
      onClick={selectable ? onToggle : undefined}
    >
      <div className="flex min-w-0 flex-wrap items-start justify-between gap-1">
        <div className="flex min-w-0 flex-1 items-start gap-2">
          {selectable && (
            <input
              type="checkbox"
              readOnly
              checked={!!selected}
              className="mt-0.5 shrink-0 accent-primary"
              aria-label={`Select ${item.gedcomPlace.original}`}
            />
          )}
          <div className="min-w-0">
            <p className="truncate font-medium leading-tight">{item.gedcomPlace.original}</p>
            {(item.gedcomPlace.state || item.gedcomPlace.country) && (
              <p className="text-xs text-muted-foreground">
                {[item.gedcomPlace.state, item.gedcomPlace.country].filter(Boolean).join(", ")}
              </p>
            )}
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-1.5">
          {item.isPrimary && <span className="badge badge-primary badge-sm">Primary</span>}
          {usageTotal > 0 && (
            <span className="badge badge-ghost badge-sm">{usageTotal} uses</span>
          )}
        </div>
      </div>

      {linked ? (
        <div className="mt-1.5 flex flex-wrap items-center gap-1.5 text-xs">
          <span className="text-success">Linked to:</span>
          <span className="font-medium">{linked.resolvedPlace?.displayName ?? "—"}</span>
          <button
            type="button"
            className="text-muted-foreground underline hover:text-destructive"
            onClick={(e) => { e.stopPropagation(); deleteLink.mutate(linked.id); }}
            disabled={deleteLink.isPending}
          >
            Unlink
          </button>
        </div>
      ) : mode === "none" ? (
        <div className="mt-1.5 flex gap-1.5">
          <button
            type="button"
            className="text-xs text-primary underline"
            onClick={(e) => { e.stopPropagation(); setMode("link-existing"); }}
          >
            Link to existing…
          </button>
        </div>
      ) : mode === "link-existing" ? (
        <LinkExistingPicker
          gedcomPlaceId={item.gedcomPlace.id}
          onLinked={() => setMode("none")}
          onCancel={() => setMode("none")}
        />
      ) : null}
    </div>
  );
}

// ── Suggestion detail pane ────────────────────────────────────────────────────

function SuggestionDetailPane({ id }: { id: string }) {
  const { data, isLoading } = useSuggestion(id);
  const patchSuggestion = usePatchSuggestion();
  const [mode, setMode] = useState<"none" | "resolve-new">("none");
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  const suggestion = data?.suggestion;

  if (isLoading) return <p className="p-4 text-sm text-muted-foreground">Loading…</p>;
  if (!suggestion) return <p className="p-4 text-sm text-muted-foreground">Not found.</p>;

  const unlinkedItems = suggestion.items.filter((i) => !i.gedcomPlace.resolvedLink);

  function toggleItem(gedcomPlaceId: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(gedcomPlaceId)) next.delete(gedcomPlaceId);
      else next.add(gedcomPlaceId);
      return next;
    });
  }

  function toggleAll() {
    if (selectedIds.size === unlinkedItems.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(unlinkedItems.map((i) => i.gedcomPlace.id)));
    }
  }

  // If the user selected a subset, resolve only those; otherwise resolve all unlinked.
  const effectiveIds =
    selectedIds.size > 0
      ? unlinkedItems.filter((i) => selectedIds.has(i.gedcomPlace.id)).map((i) => i.gedcomPlace.id)
      : unlinkedItems.map((i) => i.gedcomPlace.id);

  const resolveLabel =
    selectedIds.size > 0
      ? `Resolve selected (${selectedIds.size})`
      : `Resolve all (${unlinkedItems.length})`;

  return (
    <div className="flex flex-col gap-4 overflow-y-auto p-1">
      <div className="space-y-1">
        <h3 className="font-semibold leading-tight">{suggestion.groupLabel}</h3>
        <div className="flex flex-wrap items-center gap-1.5">
          <span className={reasonBadge(suggestion.matchReason)}>
            {REASON_LABELS[suggestion.matchReason] ?? suggestion.matchReason}
          </span>
          <span className={confidenceBadge(suggestion.confidence)}>
            {suggestion.confidence}% confidence
          </span>
          <span className="text-xs text-muted-foreground">
            {suggestion.items.length} place{suggestion.items.length !== 1 ? "s" : ""}
          </span>
        </div>
      </div>

      <div className="space-y-2">
        {unlinkedItems.length > 1 && (
          <button
            type="button"
            onClick={toggleAll}
            className="text-xs text-muted-foreground underline-offset-2 hover:underline"
          >
            {selectedIds.size === unlinkedItems.length ? "Deselect all" : "Select all"}
          </button>
        )}
        {suggestion.items.map((item) => (
          <SuggestionItemRow
            key={item.id}
            item={item}
            selected={selectedIds.has(item.gedcomPlace.id)}
            onToggle={() => toggleItem(item.gedcomPlace.id)}
          />
        ))}
      </div>

      {mode === "none" && suggestion.status !== "applied" && (
        <div className="flex flex-wrap gap-2">
          {unlinkedItems.length > 0 && (
            <Button size="sm" className="h-8 text-sm" onClick={() => setMode("resolve-new")}>
              {resolveLabel}
            </Button>
          )}
          {suggestion.status === "pending" || suggestion.status === "partial" ? (
            <Button
              size="sm"
              variant="outline"
              className="h-8 text-sm"
              onClick={() => patchSuggestion.mutate({ id: suggestion.id, action: "ignore" })}
              disabled={patchSuggestion.isPending}
            >
              Ignore
            </Button>
          ) : suggestion.status === "ignored" ? (
            <Button
              size="sm"
              variant="outline"
              className="h-8 text-sm"
              onClick={() => patchSuggestion.mutate({ id: suggestion.id, action: "restore" })}
              disabled={patchSuggestion.isPending}
            >
              Restore to pending
            </Button>
          ) : null}
        </div>
      )}

      {mode === "resolve-new" && (
        <ResolveGroupForm
          unlinkedIds={effectiveIds}
          prefillName={suggestion.groupLabel}
          onDone={() => { setMode("none"); setSelectedIds(new Set()); }}
          onCancel={() => setMode("none")}
        />
      )}
    </div>
  );
}

// ── Main panel ────────────────────────────────────────────────────────────────

export function SuggestionsPanel() {
  const [statusFilter, setStatusFilter] = useState("pending");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const { data, isLoading } = useSuggestions(statusFilter);
  const runScan = useRunScan();
  const [lastScanResult, setLastScanResult] = useState<PlaceResolutionScanSummary | null>(null);

  const suggestions = data?.suggestions ?? [];

  return (
    <div className="flex flex-col gap-4">
      {/* Top bar */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <p className="text-sm text-muted-foreground">
            Machine-generated groups of GEDCOM place rows that may refer to the same location.
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            size="sm"
            variant="outline"
            disabled={runScan.isPending}
            onClick={async () => {
              const result = await runScan.mutateAsync();
              setLastScanResult(result as PlaceResolutionScanSummary);
              setSelectedId(null);
            }}
          >
            {runScan.isPending ? "Scanning…" : "Run scan"}
          </Button>
        </div>
      </div>

      {/* Scan result banner */}
      {lastScanResult && (
        <div className="rounded-md border border-success/30 bg-success/8 px-4 py-2 text-sm">
          <p className="font-medium text-success">Scan complete</p>
          <p className="text-muted-foreground">
            {lastScanResult.totalPlaces} total places, {lastScanResult.unlinkedPlaces} unlinked.{" "}
            {lastScanResult.suggestionsCreated} suggestion{lastScanResult.suggestionsCreated !== 1 ? "s" : ""} created.{" "}
            (exact: {lastScanResult.byReason.exact_normalized}, prefix: {lastScanResult.byReason.prefix_match},
            region: {lastScanResult.byReason.component_match}, coords: {lastScanResult.byReason.coordinate_proximity},
            fuzzy: {lastScanResult.byReason.fuzzy})
          </p>
        </div>
      )}

      {/* Status filter */}
      <div className="flex gap-1 rounded-lg border border-base-content/10 bg-base-200/40 p-1">
        {STATUS_OPTIONS.map((opt) => {
          const active = statusFilter === opt.value;
          return (
            <button
              key={opt.value}
              type="button"
              className={cn(
                "flex-1 rounded-md px-3 py-1.5 text-sm font-medium transition-colors",
                active
                  ? "bg-base-100 text-base-content shadow-sm"
                  : "text-base-content/60 hover:text-base-content",
              )}
              onClick={() => { setStatusFilter(opt.value); setSelectedId(null); }}
            >
              {opt.label}
            </button>
          );
        })}
      </div>

      {isLoading ? (
        <p className="py-4 text-center text-sm text-muted-foreground">Loading…</p>
      ) : suggestions.length === 0 ? (
        <div className="rounded-md border border-base-content/10 bg-base-content/[0.02] px-4 py-8 text-center text-sm text-muted-foreground">
          {statusFilter === "pending"
            ? "No pending suggestions. Run a scan to generate groups."
            : `No ${statusFilter} suggestions.`}
        </div>
      ) : (
        <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)]">
          {/* List */}
          <div className="flex flex-col gap-2 overflow-y-auto">
            {suggestions.map((s) => (
              <SuggestionCard
                key={s.id}
                suggestion={s}
                active={selectedId === s.id}
                onClick={() => setSelectedId(s.id === selectedId ? null : s.id)}
              />
            ))}
          </div>

          {/* Detail */}
          <div>
            {selectedId ? (
              <Card key={selectedId}>
                <CardContent className="pt-4">
                  <SuggestionDetailPane id={selectedId} />
                </CardContent>
              </Card>
            ) : (
              <div className="rounded-md border border-dashed border-base-content/15 px-4 py-8 text-center text-sm text-muted-foreground">
                Select a suggestion to review it.
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function SuggestionCard({
  suggestion,
  active,
  onClick,
}: {
  suggestion: SuggestionListItem;
  active: boolean;
  onClick: () => void;
}) {
  const linkedCount = suggestion.items.filter((i) => i.gedcomPlace.resolvedLink).length;

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
        <span className="min-w-0 flex-1 truncate font-medium leading-tight">{suggestion.groupLabel}</span>
        <span className={cn("shrink-0", confidenceBadge(suggestion.confidence))}>
          {suggestion.confidence}%
        </span>
      </div>
      <div className="mt-1 flex flex-wrap items-center gap-1.5">
        <span className={reasonBadge(suggestion.matchReason)}>
          {REASON_LABELS[suggestion.matchReason] ?? suggestion.matchReason}
        </span>
        <span className="text-xs text-muted-foreground">
          {suggestion.items.length} places
          {linkedCount > 0 ? ` · ${linkedCount} linked` : ""}
        </span>
      </div>
    </button>
  );
}
