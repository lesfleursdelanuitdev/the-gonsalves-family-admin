"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { BookOpen, ChevronDown, ChevronUp, Plus, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ApiError, deleteJson, fetchJson, postJson } from "@/lib/infra/api";
import { QUAY_OPTIONS, quayBadgeClass, quayLabel } from "@/lib/gedcom/citation-quality";
import {
  SOURCE_TEMPLATES,
  TEMPLATE_CATEGORIES_ORDER,
  TEMPLATE_CATEGORY_LABELS,
  getTemplateById,
  type SourceTemplate,
  type TemplateCategory,
} from "@/lib/gedcom/source-templates";

export type CitationTargetType = "individual" | "family" | "event" | "attribute";

export type EntityCitationPanelProps = {
  targetType: CitationTargetType;
  targetId: string;
  mode: "create" | "edit";
  onChange?: () => void;
};

interface CitationSource {
  id: string;
  xref: string;
  title: string | null;
  author: string | null;
  abbreviation: string | null;
}

interface CitationLink {
  id: string;
  page: string | null;
  quality: number | null;
  citationText: string | null;
  source: CitationSource;
}

interface SourceSearchResult {
  id: string;
  xref: string;
  title: string | null;
  author: string | null;
  abbreviation: string | null;
}

function apiBase(targetType: CitationTargetType, targetId: string): string {
  switch (targetType) {
    case "individual": return `/api/admin/individuals/${targetId}/individual-sources`;
    case "family": return `/api/admin/families/${targetId}/family-sources`;
    case "event": return `/api/admin/events/${targetId}/event-sources`;
    case "attribute": return `/api/admin/attributes/${targetId}/attribute-sources`;
  }
}

function responseKey(targetType: CitationTargetType): string {
  switch (targetType) {
    case "individual": return "individualSources";
    case "family": return "familySources";
    case "event": return "eventSources";
    case "attribute": return "attributeSources";
  }
}

function sourceLabel(s: CitationSource): string {
  return s.title?.trim() || s.abbreviation?.trim() || s.xref;
}

// ── Template picker ────────────────────────────────────────────────────────────

function TemplatePicker({ onSelect }: { onSelect: (template: SourceTemplate | null) => void }) {
  const [activeCategory, setActiveCategory] = useState<TemplateCategory | null>(null);

  const categories = TEMPLATE_CATEGORIES_ORDER.filter(
    (cat) => cat !== "custom" && SOURCE_TEMPLATES.some((t) => t.category === cat)
  );

  const templatesForCategory = activeCategory
    ? SOURCE_TEMPLATES.filter((t) => t.category === activeCategory)
    : [];

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
          Choose a template <span className="normal-case font-normal">(optional)</span>
        </p>
        <button
          type="button"
          onClick={() => onSelect(null)}
          className="text-xs text-muted-foreground hover:text-foreground underline underline-offset-2"
        >
          Skip
        </button>
      </div>

      {/* Category chips */}
      <div className="flex flex-wrap gap-1.5">
        {categories.map((cat) => (
          <button
            key={cat}
            type="button"
            onClick={() => setActiveCategory((prev) => (prev === cat ? null : cat))}
            className={`rounded-full border px-3 py-1 text-xs font-medium transition-colors ${
              activeCategory === cat
                ? "border-primary bg-primary text-primary-foreground"
                : "border-border bg-background text-foreground hover:bg-muted"
            }`}
          >
            {TEMPLATE_CATEGORY_LABELS[cat]}
          </button>
        ))}
      </div>

      {/* Templates for selected category */}
      {templatesForCategory.length > 0 && (
        <ul className="divide-y divide-border rounded-md border border-border bg-background">
          {templatesForCategory.map((tpl) => (
            <li key={tpl.id}>
              <button
                type="button"
                onClick={() => onSelect(tpl)}
                className="w-full px-3 py-2.5 text-left hover:bg-muted focus-visible:bg-muted focus-visible:outline-none"
              >
                <p className="text-sm font-medium">{tpl.label}</p>
                <p className="mt-0.5 text-xs text-muted-foreground">{tpl.description}</p>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

// ── Source search dropdown ────────────────────────────────────────────────────

function SourceSearchDropdown({
  onSelect,
  excludeIds,
}: {
  onSelect: (source: SourceSearchResult) => void;
  excludeIds: Set<string>;
}) {
  const [q, setQ] = useState("");
  const [results, setResults] = useState<SourceSearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const search = useCallback(async (query: string) => {
    if (!query.trim()) { setResults([]); return; }
    setLoading(true);
    try {
      const data = await fetchJson<{ sources: SourceSearchResult[] }>(
        `/api/admin/sources?q=${encodeURIComponent(query)}&limit=10`
      );
      setResults((data.sources ?? []).filter((s) => !excludeIds.has(s.id)));
    } catch {
      setResults([]);
    } finally {
      setLoading(false);
    }
  }, [excludeIds]);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => { void search(q); }, 300);
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  }, [q, search]);

  return (
    <div className="space-y-2">
      <Label className="text-xs">Search sources</Label>
      <Input
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder="Search by title, author, or XREF…"
        className="text-sm"
      />
      {loading && <p className="text-xs text-muted-foreground">Searching…</p>}
      {!loading && results.length === 0 && q.trim() && (
        <p className="text-xs text-muted-foreground">
          No sources found. Try a different search or{" "}
          <Link href="/admin/sources/new" className="text-primary hover:underline">
            create one
          </Link>
          .
        </p>
      )}
      {results.length > 0 && (
        <ul className="divide-y divide-base-content/10 rounded-md border border-base-content/10 bg-background">
          {results.map((s) => (
            <li key={s.id}>
              <button
                type="button"
                className="w-full px-3 py-2 text-left text-sm hover:bg-base-content/[0.04] focus-visible:bg-base-content/[0.04] focus-visible:outline-none"
                onClick={() => { onSelect(s); setQ(""); setResults([]); }}
              >
                <span className="font-medium">{sourceLabel(s)}</span>
                {s.author ? <span className="ml-2 text-xs text-muted-foreground">{s.author}</span> : null}
                <span className="ml-2 font-mono text-xs text-muted-foreground">{s.xref}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

// ── Add-citation form ─────────────────────────────────────────────────────────

type AddStep = "template" | "fields";

interface AddCitationFormProps {
  excludeIds: Set<string>;
  busy: boolean;
  onAttach: (payload: {
    sourceId: string;
    page?: string;
    quality?: number;
    citationText?: string;
  }) => Promise<void>;
  onCancel: () => void;
}

function AddCitationForm({ excludeIds, busy, onAttach, onCancel }: AddCitationFormProps) {
  const [step, setStep] = useState<AddStep>("template");
  const [template, setTemplate] = useState<SourceTemplate | null>(null);
  const [selectedSource, setSelectedSource] = useState<SourceSearchResult | null>(null);
  const [page, setPage] = useState("");
  const [quality, setQuality] = useState<string>("");
  const [citationText, setCitationText] = useState("");

  const handleTemplateSelect = (tpl: SourceTemplate | null) => {
    setTemplate(tpl);
    if (tpl?.defaultQuality !== undefined) {
      setQuality(String(tpl.defaultQuality));
    }
    setStep("fields");
  };

  const pageLabel = template?.pageLabel ?? "Page / film frame";
  const pagePlaceholder = template?.pagePlaceholder ?? "e.g. p. 42";
  const citationLabel = template?.citationLabel ?? "Citation text / transcription";
  const citationPlaceholder = template?.citationPlaceholder ?? "Specific reference, quotation, or assessment…";

  const handleAttach = () => {
    if (!selectedSource) { toast.error("Pick a source first."); return; }
    void onAttach({
      sourceId: selectedSource.id,
      page: page.trim() || undefined,
      quality: quality !== "" ? Number(quality) : undefined,
      citationText: citationText.trim() || undefined,
    });
  };

  if (step === "template") {
    return <TemplatePicker onSelect={handleTemplateSelect} />;
  }

  return (
    <div className="space-y-4">
      {/* Template badge */}
      {template ? (
        <div className="flex items-center justify-between rounded-md border border-border bg-muted/40 px-3 py-2">
          <div>
            <p className="text-xs font-medium">{template.label}</p>
            <p className="text-xs text-muted-foreground">{template.description}</p>
          </div>
          <button
            type="button"
            onClick={() => { setTemplate(null); setStep("template"); }}
            className="ml-2 shrink-0 text-xs text-muted-foreground hover:text-foreground underline underline-offset-2"
          >
            Change
          </button>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => setStep("template")}
          className="text-xs text-muted-foreground hover:text-foreground underline underline-offset-2"
        >
          ← Choose a template
        </button>
      )}

      <SourceSearchDropdown onSelect={setSelectedSource} excludeIds={excludeIds} />

      {selectedSource ? (
        <div className="rounded-md border border-primary/20 bg-primary/5 px-3 py-2 text-sm">
          <p className="font-medium">{sourceLabel(selectedSource)}</p>
          {selectedSource.author ? <p className="text-xs text-muted-foreground">{selectedSource.author}</p> : null}
        </div>
      ) : null}

      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-1">
          <Label htmlFor="ecp-page" className="text-xs">{pageLabel}</Label>
          <Input
            id="ecp-page"
            value={page}
            onChange={(e) => setPage(e.target.value)}
            placeholder={pagePlaceholder}
            className="text-sm"
          />
        </div>
        <div className="space-y-1">
          <Label htmlFor="ecp-quality" className="text-xs">Evidence quality</Label>
          <select
            id="ecp-quality"
            value={quality}
            onChange={(e) => setQuality(e.target.value)}
            className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <option value="">— Not set —</option>
            {QUAY_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>{opt.label}</option>
            ))}
          </select>
        </div>
        <div className="space-y-1 sm:col-span-2">
          <Label htmlFor="ecp-cite" className="text-xs">{citationLabel}</Label>
          <textarea
            id="ecp-cite"
            value={citationText}
            onChange={(e) => setCitationText(e.target.value)}
            rows={2}
            placeholder={citationPlaceholder}
            className="flex min-h-[4rem] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          />
        </div>
      </div>

      <div className="flex gap-2">
        <Button
          type="button"
          size="sm"
          disabled={!selectedSource || busy}
          onClick={handleAttach}
        >
          {busy ? "Attaching…" : "Attach citation"}
        </Button>
        <Button type="button" size="sm" variant="ghost" onClick={onCancel}>
          Cancel
        </Button>
      </div>
    </div>
  );
}

// ── Main panel ────────────────────────────────────────────────────────────────

export function EntityCitationPanel({
  targetType,
  targetId,
  mode,
  onChange,
}: EntityCitationPanelProps) {
  const [citations, setCitations] = useState<CitationLink[]>([]);
  const [loadingCitations, setLoadingCitations] = useState(false);
  const [showAdd, setShowAdd] = useState(false);
  const [busy, setBusy] = useState(false);

  const excludeIds = new Set(citations.map((c) => c.source.id));
  const base = apiBase(targetType, targetId);
  const key = responseKey(targetType);

  const load = useCallback(async () => {
    if (mode === "create") return;
    setLoadingCitations(true);
    try {
      const data = await fetchJson<Record<string, CitationLink[]>>(base);
      setCitations(data[key] ?? []);
    } catch {
      // silently fail — panel shows empty
    } finally {
      setLoadingCitations(false);
    }
  }, [base, key, mode]);

  useEffect(() => { void load(); }, [load]);

  const attach = async (payload: {
    sourceId: string;
    page?: string;
    quality?: number;
    citationText?: string;
  }) => {
    setBusy(true);
    try {
      await postJson(base, payload);
      toast.success("Citation added.");
      setShowAdd(false);
      await load();
      onChange?.();
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : "Could not add citation.");
    } finally {
      setBusy(false);
    }
  };

  const remove = async (linkId: string) => {
    setBusy(true);
    try {
      await deleteJson(`${base}/${linkId}`);
      toast.success("Citation removed.");
      await load();
      onChange?.();
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : "Could not remove citation.");
    } finally {
      setBusy(false);
    }
  };

  if (mode === "create") {
    return (
      <p className="text-sm text-muted-foreground">Save this record first to attach source citations.</p>
    );
  }

  return (
    <div className="space-y-4">
      {loadingCitations ? (
        <p className="text-sm text-muted-foreground">Loading…</p>
      ) : citations.length === 0 ? (
        <div className="rounded-lg border border-dashed border-base-content/15 bg-base-content/[0.02] px-4 py-6 text-center">
          <BookOpen className="mx-auto mb-2 size-5 text-muted-foreground" />
          <p className="text-sm text-muted-foreground">No source citations yet.</p>
        </div>
      ) : (
        <ul className="space-y-2">
          {citations.map((c) => {
            const ql = quayLabel(c.quality);
            return (
              <li
                key={c.id}
                className="flex flex-col gap-2 rounded-lg border border-base-content/[0.08] bg-base-content/[0.02] px-3 py-2.5 sm:flex-row sm:items-start sm:justify-between"
              >
                <div className="min-w-0 flex-1 space-y-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <Link
                      href={`/admin/sources/${c.source.id}/edit`}
                      className="font-medium text-primary underline-offset-2 hover:underline"
                    >
                      {sourceLabel(c.source)}
                    </Link>
                    {ql ? (
                      <span className={`inline-block rounded-full px-2 py-0.5 text-[11px] font-medium ${quayBadgeClass(c.quality)}`}>
                        {ql}
                      </span>
                    ) : null}
                  </div>
                  {c.source.author ? (
                    <p className="text-xs text-muted-foreground">{c.source.author}</p>
                  ) : null}
                  {c.page ? (
                    <p className="text-xs text-muted-foreground">Page: {c.page}</p>
                  ) : null}
                  {c.citationText ? (
                    <p className="whitespace-pre-wrap text-xs text-muted-foreground">{c.citationText}</p>
                  ) : null}
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-xs"
                  className="shrink-0 text-muted-foreground hover:text-destructive"
                  disabled={busy}
                  onClick={() => void remove(c.id)}
                  aria-label="Remove citation"
                >
                  <X className="size-3.5" />
                </Button>
              </li>
            );
          })}
        </ul>
      )}

      {showAdd ? (
        <div className="rounded-lg border border-base-content/[0.08] bg-base-content/[0.02] p-4 space-y-4">
          <div className="flex items-center justify-between">
            <p className="text-sm font-medium">Add citation</p>
            <Button
              type="button"
              variant="ghost"
              size="icon-xs"
              onClick={() => setShowAdd(false)}
            >
              <ChevronUp className="size-4" />
            </Button>
          </div>

          <AddCitationForm
            excludeIds={excludeIds}
            busy={busy}
            onAttach={attach}
            onCancel={() => setShowAdd(false)}
          />
        </div>
      ) : (
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="gap-1.5 border-dashed"
          onClick={() => setShowAdd(true)}
        >
          <Plus className="size-3.5" />
          Add citation
          {citations.length > 0 ? <ChevronDown className="size-3.5" /> : null}
        </Button>
      )}
    </div>
  );
}
