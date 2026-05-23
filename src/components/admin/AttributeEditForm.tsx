"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { ArrowLeft } from "lucide-react";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { selectClassName } from "@/components/data-viewer/constants";
import { GedcomDateInput } from "@/components/admin/GedcomDateInput";
import { GedcomPlaceInput } from "@/components/admin/GedcomPlaceInput";
import {
  INDIVIDUAL_ATTRIBUTE_TAG_LIST,
  GEDCOM_ATTRIBUTE_TYPE_LABELS,
  ATTRIBUTE_CUSTOM_TYPE_TAGS,
} from "@/lib/gedcom/gedcom-attribute-labels";
import {
  ADMIN_ATTRIBUTES_QUERY_KEY,
  useCreateAttribute,
  useUpdateAttribute,
} from "@/hooks/useAdminAttributes";
import type { GedcomDateFormSlice, GedcomPlaceFormSlice } from "@/lib/forms/individual-editor-form";
import { gedcomDateSpecifierNeedsRange } from "@/lib/gedcom/gedcom-date-specifiers";

// ── Types ─────────────────────────────────────────────────────────────────────

type Mode = "create" | "edit";

export type AttributeEditFormProps = {
  mode: Mode;
  attributeId?: string;
  initialAttribute?: Record<string, unknown>;
};

const EMPTY_DATE: GedcomDateFormSlice = {
  dateSpecifier: "EXACT",
  dateOriginal: "",
  y: "", m: "", d: "", ey: "", em: "", ed: "",
};

const EMPTY_PLACE: GedcomPlaceFormSlice = {
  placeName: "", placeCounty: "", placeState: "",
  placeCountry: "", placeOriginal: "", placeLat: "", placeLng: "",
};

const ATTRIBUTE_TYPE_OPTIONS = INDIVIDUAL_ATTRIBUTE_TAG_LIST.map((tag) => ({
  value: tag,
  label: GEDCOM_ATTRIBUTE_TYPE_LABELS[tag] ?? tag,
}));

// ── Helpers ───────────────────────────────────────────────────────────────────

function parseYm(v: string): number | null {
  const t = v.trim();
  if (!t) return null;
  const n = Number(t);
  return Number.isFinite(n) ? Math.trunc(n) : null;
}

function dateSliceToPayload(
  slice: GedcomDateFormSlice,
): Record<string, unknown> | null {
  const showRange = gedcomDateSpecifierNeedsRange(slice.dateSpecifier);
  const year = parseYm(slice.y);
  const month = parseYm(slice.m);
  const day = parseYm(slice.d);
  const endYear = parseYm(slice.ey);
  const endMonth = parseYm(slice.em);
  const endDay = parseYm(slice.ed);
  const orig = slice.dateOriginal.trim();
  const isEmpty =
    slice.dateSpecifier === "EXACT" &&
    !orig && year == null && month == null && day == null &&
    endYear == null && endMonth == null && endDay == null;
  if (isEmpty) return null;
  return {
    dateType: slice.dateSpecifier,
    calendar: "GREGORIAN",
    original: orig || undefined,
    year, month, day,
    endYear: showRange ? endYear : null,
    endMonth: showRange ? endMonth : null,
    endDay: showRange ? endDay : null,
  };
}

function placeSliceToPayload(slice: GedcomPlaceFormSlice): Record<string, unknown> | null {
  const { placeName, placeCounty, placeState, placeCountry, placeOriginal, placeLat, placeLng } = slice;
  if (!placeName.trim() && !placeCounty.trim() && !placeState.trim() &&
      !placeCountry.trim() && !placeOriginal.trim() && !placeLat.trim() && !placeLng.trim()) {
    return null;
  }
  return {
    original: placeOriginal.trim() || undefined,
    name: placeName.trim() || undefined,
    county: placeCounty.trim() || undefined,
    state: placeState.trim() || undefined,
    country: placeCountry.trim() || undefined,
    latitude: placeLat.trim() ? Number(placeLat.trim()) : undefined,
    longitude: placeLng.trim() ? Number(placeLng.trim()) : undefined,
  };
}

function dateFromRow(row: Record<string, unknown> | null | undefined): GedcomDateFormSlice {
  if (!row) return EMPTY_DATE;
  return {
    dateSpecifier: (row.type as string) || "EXACT",
    dateOriginal: (row.original as string) || "",
    y: row.year != null ? String(row.year) : "",
    m: row.month != null ? String(row.month) : "",
    d: row.day != null ? String(row.day) : "",
    ey: row.endYear != null ? String(row.endYear) : "",
    em: row.endMonth != null ? String(row.endMonth) : "",
    ed: row.endDay != null ? String(row.endDay) : "",
  };
}

function placeFromRow(row: Record<string, unknown> | null | undefined): GedcomPlaceFormSlice {
  if (!row) return EMPTY_PLACE;
  return {
    placeName: (row.name as string) || "",
    placeCounty: (row.county as string) || "",
    placeState: (row.state as string) || "",
    placeCountry: (row.country as string) || "",
    placeOriginal: (row.original as string) || "",
    placeLat: row.latitude != null ? String(row.latitude) : "",
    placeLng: row.longitude != null ? String(row.longitude) : "",
  };
}

// ── Component ─────────────────────────────────────────────────────────────────

export function AttributeEditForm({ mode, attributeId, initialAttribute }: AttributeEditFormProps) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const createAttribute = useCreateAttribute();
  const updateAttribute = useUpdateAttribute();

  // ── Form state ──────────────────────────────────────────────────────────────
  const [attributeType, setAttributeType] = useState<string>(
    () => (initialAttribute?.attributeType as string) || "OCCU",
  );
  const [customType, setCustomType] = useState(
    () => (initialAttribute?.customType as string) || "",
  );
  const [value, setValue] = useState(
    () => (initialAttribute?.value as string) || "",
  );
  const [agency, setAgency] = useState(
    () => (initialAttribute?.agency as string) || "",
  );
  const [dateSlice, setDateSlice] = useState<GedcomDateFormSlice>(
    () => dateFromRow(initialAttribute?.date as Record<string, unknown> | null),
  );
  const [placeSlice, setPlaceSlice] = useState<GedcomPlaceFormSlice>(
    () => placeFromRow(initialAttribute?.place as Record<string, unknown> | null),
  );

  // Individual links (id + display label)
  const [linkedIndividuals, setLinkedIndividuals] = useState<{ id: string; label: string }[]>(() => {
    const rows = initialAttribute?.individualAttributes as Array<{
      individual: { id: string; fullName: string | null };
    }> | undefined;
    return (rows ?? []).map((r) => ({ id: r.individual.id, label: r.individual.fullName ?? "—" }));
  });

  const [newIndividualId, setNewIndividualId] = useState("");

  const showCustomType = ATTRIBUTE_CUSTOM_TYPE_TAGS.has(attributeType);
  const isSubmitting = createAttribute.isPending || updateAttribute.isPending;

  const handleDateChange = useCallback(
    (patch: Partial<GedcomDateFormSlice>) => setDateSlice((d) => ({ ...d, ...patch })),
    [],
  );
  const handlePlaceChange = useCallback(
    (patch: Partial<GedcomPlaceFormSlice>) => setPlaceSlice((p) => ({ ...p, ...patch })),
    [],
  );

  // Reset customType when switching away from FACT/IDNO
  useEffect(() => {
    if (!ATTRIBUTE_CUSTOM_TYPE_TAGS.has(attributeType)) setCustomType("");
  }, [attributeType]);

  const removeIndividual = (id: string) =>
    setLinkedIndividuals((prev) => prev.filter((r) => r.id !== id));

  const addIndividual = () => {
    const trimmed = newIndividualId.trim();
    if (!trimmed || linkedIndividuals.some((r) => r.id === trimmed)) return;
    setLinkedIndividuals((prev) => [...prev, { id: trimmed, label: trimmed }]);
    setNewIndividualId("");
  };

  const buildPayload = useCallback(() => {
    const date = dateSliceToPayload(dateSlice);
    const place = placeSliceToPayload(placeSlice);
    return {
      attributeType,
      customType: showCustomType ? (customType.trim() || null) : null,
      value: value.trim() || null,
      agency: agency.trim() || null,
      date: date ?? null,
      place: place ?? null,
      individualIds: linkedIndividuals.map((r) => r.id),
      familyIds: [] as string[],
    };
  }, [attributeType, customType, showCustomType, value, agency, dateSlice, placeSlice, linkedIndividuals]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const payload = buildPayload();

    if (mode === "create") {
      createAttribute.mutate(payload, {
        onSuccess: (data) => {
          const newId = (data as Record<string, unknown>)?.attribute
            ? ((data as Record<string, { id: string }>).attribute.id)
            : undefined;
          toast.success("Attribute created.");
          void queryClient.invalidateQueries({ queryKey: [...ADMIN_ATTRIBUTES_QUERY_KEY] });
          if (newId) router.push(`/admin/attributes/${newId}`);
          else router.push("/admin/attributes");
        },
        onError: (err) => toast.error(err instanceof Error ? err.message : "Failed to create attribute."),
      });
    } else {
      if (!attributeId) return;
      updateAttribute.mutate(
        { id: attributeId, ...payload, links: { individualIds: payload.individualIds, familyIds: payload.familyIds } },
        {
          onSuccess: () => {
            toast.success("Attribute saved.");
            void queryClient.invalidateQueries({ queryKey: [...ADMIN_ATTRIBUTES_QUERY_KEY] });
            router.push(`/admin/attributes/${attributeId}`);
          },
          onError: (err) => toast.error(err instanceof Error ? err.message : "Failed to save attribute."),
        },
      );
    }
  };

  return (
    <form id="admin-attribute-editor-form" onSubmit={handleSubmit} className="space-y-8">
      {/* Back link */}
      <Link
        href={mode === "edit" && attributeId ? `/admin/attributes/${attributeId}` : "/admin/attributes"}
        className={cn(buttonVariants({ variant: "ghost", size: "sm" }), "gap-1.5")}
      >
        <ArrowLeft className="size-4" />
        {mode === "edit" ? "Back to attribute" : "Back to attributes"}
      </Link>

      {/* ── Core fields ─────────────────────────────────────────────────── */}
      <section className="space-y-4 rounded-lg border border-border bg-card p-5">
        <h2 className="text-base font-semibold">Attribute details</h2>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="attr-type">Type</Label>
            <select
              id="attr-type"
              className={selectClassName}
              value={attributeType}
              onChange={(e) => setAttributeType(e.target.value)}
            >
              {ATTRIBUTE_TYPE_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label} ({opt.value})
                </option>
              ))}
            </select>
          </div>

          {showCustomType && (
            <div className="space-y-2">
              <Label htmlFor="attr-custom-type">Custom type (TYPE)</Label>
              <Input
                id="attr-custom-type"
                value={customType}
                onChange={(e) => setCustomType(e.target.value)}
                placeholder="e.g. Military service"
              />
              <p className="text-xs text-muted-foreground">
                Free text stored in the GEDCOM TYPE sub-tag.
              </p>
            </div>
          )}
        </div>

        <div className="space-y-2">
          <Label htmlFor="attr-value">Value</Label>
          <textarea
            id="attr-value"
            value={value}
            onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setValue(e.target.value)}
            placeholder="e.g. Farmer, Bachelor's degree, Roman Catholic…"
            rows={3}
            className="flex min-h-[80px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="attr-agency">Agency</Label>
          <Input
            id="attr-agency"
            value={agency}
            onChange={(e) => setAgency(e.target.value)}
            placeholder="e.g. County records office"
          />
        </div>
      </section>

      {/* ── Date ────────────────────────────────────────────────────────── */}
      <section className="space-y-4 rounded-lg border border-border bg-card p-5">
        <h2 className="text-base font-semibold">Date</h2>
        <GedcomDateInput
          value={dateSlice}
          onChange={handleDateChange}
          idPrefix="attr-date-"
          dateSuggestions
        />
      </section>

      {/* ── Place ───────────────────────────────────────────────────────── */}
      <section className="space-y-4 rounded-lg border border-border bg-card p-5">
        <h2 className="text-base font-semibold">Place</h2>
        <GedcomPlaceInput
          value={placeSlice}
          onChange={handlePlaceChange}
          idPrefix="attr-place-"
          placeSuggestions
        />
      </section>

      {/* ── Individual links ─────────────────────────────────────────────── */}
      <section className="space-y-4 rounded-lg border border-border bg-card p-5">
        <h2 className="text-base font-semibold">Linked individuals</h2>
        {linkedIndividuals.length > 0 ? (
          <ul className="space-y-1.5">
            {linkedIndividuals.map((r) => (
              <li
                key={r.id}
                className="flex items-center justify-between gap-3 rounded border border-border px-3 py-2 text-sm"
              >
                <span className="min-w-0 truncate">{r.label}</span>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="shrink-0 text-muted-foreground hover:text-destructive"
                  onClick={() => removeIndividual(r.id)}
                >
                  Remove
                </Button>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-muted-foreground">No individuals linked yet.</p>
        )}
        <div className="flex gap-2">
          <Input
            value={newIndividualId}
            onChange={(e) => setNewIndividualId(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addIndividual(); } }}
            placeholder="Individual UUID"
            className="font-mono text-sm"
          />
          <Button type="button" variant="outline" onClick={addIndividual}>
            Add
          </Button>
        </div>
        <p className="text-xs text-muted-foreground">
          Paste the individual's UUID (visible on their profile page).
        </p>
      </section>

      {/* ── Submit ──────────────────────────────────────────────────────── */}
      <div className="flex items-center gap-3">
        <Button type="submit" disabled={isSubmitting}>
          {isSubmitting
            ? mode === "create" ? "Creating…" : "Saving…"
            : mode === "create" ? "Create attribute" : "Save changes"}
        </Button>
        <Link
          href={mode === "edit" && attributeId ? `/admin/attributes/${attributeId}` : "/admin/attributes"}
          className={cn(buttonVariants({ variant: "ghost" }))}
        >
          Cancel
        </Link>
      </div>
    </form>
  );
}
