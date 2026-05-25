"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { Plus, Trash2, ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { IndividualSearchPicker } from "@/components/admin/IndividualSearchPicker";
import { KeyFactSection } from "@/components/admin/individual-editor/KeyFactSection";
import { selectClassName } from "@/components/data-viewer/constants";
import { fetchJson, postJson, ApiError } from "@/lib/infra/api";
import {
  buildMiniIndividualEditorBody,
  emptyMiniIndividualFields,
  miniIndividualHasNameParts,
  type MiniIndividualFields,
} from "@/lib/forms/family-mini-individual-payload";
import { individualSearchDisplayName } from "@/lib/gedcom/individual-search-display";
import type { AdminIndividualListItem } from "@/hooks/useAdminIndividuals";

// ── Types ─────────────────────────────────────────────────────────────────────

type RelType = {
  id: string;
  key: string;
  label: string;
  roles: { id: string; key: string; label: string }[];
};

type ParticipantRow = {
  clientId: string;
  individualId: string;
  displayLabel: string;
  roleId: string;
  createMode: boolean;
  mini: MiniIndividualFields;
  busyCreating: boolean;
};

export type AssociationFormValues = {
  relationshipTypeId: string;
  notes: string | null;
  participants: { individualId: string; roleId: string; sortOrder: number }[];
};

export type AssociationFormInitialData = {
  relationshipTypeId: string;
  notes: string | null;
  participants: { individualId: string; displayLabel: string; roleId: string }[];
};

type Props = {
  mode: "create" | "edit";
  initialData?: AssociationFormInitialData;
  isSubmitting: boolean;
  onSubmit: (values: AssociationFormValues) => void;
};

// ── Helpers ───────────────────────────────────────────────────────────────────

let _clientIdCounter = 0;
function newClientId() {
  return `row-${++_clientIdCounter}`;
}

function emptyRow(): ParticipantRow {
  return {
    clientId: newClientId(),
    individualId: "",
    displayLabel: "",
    roleId: "",
    createMode: false,
    mini: emptyMiniIndividualFields(),
    busyCreating: false,
  };
}

// ── Component ─────────────────────────────────────────────────────────────────

export function AssociationForm({ mode, initialData, isSubmitting, onSubmit }: Props) {
  const [relationshipTypes, setRelationshipTypes] = useState<RelType[]>([]);
  const [typesLoading, setTypesLoading] = useState(true);
  const [relationshipTypeId, setRelationshipTypeId] = useState(initialData?.relationshipTypeId ?? "");
  const [notes, setNotes] = useState(initialData?.notes ?? "");
  const [rows, setRows] = useState<ParticipantRow[]>(() => {
    if (initialData?.participants.length) {
      return initialData.participants.map((p) => ({
        clientId: newClientId(),
        individualId: p.individualId,
        displayLabel: p.displayLabel,
        roleId: p.roleId,
        createMode: false,
        mini: emptyMiniIndividualFields(),
        busyCreating: false,
      }));
    }
    return [emptyRow(), emptyRow()];
  });

  useEffect(() => {
    fetchJson<{ relationshipTypes: RelType[] }>("/api/admin/relationship-types")
      .then((res) => setRelationshipTypes(res.relationshipTypes ?? []))
      .catch(() => toast.error("Could not load relationship types."))
      .finally(() => setTypesLoading(false));
  }, []);

  const selectedType = relationshipTypes.find((rt) => rt.id === relationshipTypeId) ?? null;

  const updateRow = useCallback((index: number, patch: Partial<ParticipantRow>) => {
    setRows((prev) => prev.map((r, i) => (i === index ? { ...r, ...patch } : r)));
  }, []);

  const pickIndividual = useCallback((index: number, ind: AdminIndividualListItem) => {
    setRows((prev) =>
      prev.map((r, i) =>
        i === index
          ? {
              ...r,
              individualId: ind.id,
              displayLabel: individualSearchDisplayName(ind).trim() || ind.id,
              createMode: false,
            }
          : r,
      ),
    );
  }, []);

  const createAndLink = useCallback(
    async (index: number) => {
      const row = rows[index];
      if (!miniIndividualHasNameParts(row.mini)) {
        toast.error("Given name or surname is required.");
        return;
      }
      updateRow(index, { busyCreating: true });
      try {
        const res = await postJson<{ individual: { id: string; xref: string; fullName: string | null } }>(
          "/api/admin/individuals",
          buildMiniIndividualEditorBody(row.mini),
        );
        const ind = res.individual;
        updateRow(index, {
          individualId: ind.id,
          displayLabel: ind.fullName?.trim() || ind.xref,
          createMode: false,
          busyCreating: false,
        });
        toast.success(`Created ${ind.fullName?.trim() || ind.xref}`);
      } catch (e) {
        updateRow(index, { busyCreating: false });
        toast.error(e instanceof ApiError ? e.message : "Could not create individual");
      }
    },
    [rows, updateRow],
  );

  const removeRow = useCallback(
    (index: number) => {
      if (rows.length <= 2) {
        toast.error("At least two participants are required.");
        return;
      }
      setRows((prev) => prev.filter((_, i) => i !== index));
    },
    [rows.length],
  );

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!relationshipTypeId) {
      toast.error("Select a relationship type.");
      return;
    }
    const filled = rows.filter((r) => r.individualId.trim() && r.roleId.trim());
    if (filled.length < 2) {
      toast.error("At least two participants with roles assigned are required.");
      return;
    }
    onSubmit({
      relationshipTypeId,
      notes: notes.trim() || null,
      participants: filled.map((r, i) => ({
        individualId: r.individualId,
        roleId: r.roleId,
        sortOrder: i,
      })),
    });
  }

  const busy = isSubmitting;

  return (
    <form onSubmit={handleSubmit} className="space-y-8">
      {/* Relationship type */}
      <div className="space-y-2">
        <Label htmlFor="rel-type">Relationship type</Label>
        <select
          id="rel-type"
          className={selectClassName}
          value={relationshipTypeId}
          onChange={(e) => {
            setRelationshipTypeId(e.target.value);
            setRows((prev) => prev.map((r) => ({ ...r, roleId: "" })));
          }}
          disabled={busy || typesLoading}
        >
          <option value="">
            {typesLoading ? "Loading types…" : "Select relationship type…"}
          </option>
          {relationshipTypes.map((rt) => (
            <option key={rt.id} value={rt.id}>
              {rt.label}
            </option>
          ))}
        </select>
      </div>

      {/* Participants */}
      <div className="space-y-3">
        <div className="flex items-center justify-between gap-2">
          <Label>Participants</Label>
          <Button
            type="button"
            variant="secondary"
            size="sm"
            onClick={() => setRows((prev) => [...prev, emptyRow()])}
            disabled={busy}
            className="gap-1.5"
          >
            <Plus className="size-3.5" aria-hidden />
            Add participant
          </Button>
        </div>

        <ul className="space-y-4">
          {rows.map((row, i) => {
            const excludeIds = new Set<string>();
            for (const r of rows) {
              if (r.clientId !== row.clientId && r.individualId.trim()) {
                excludeIds.add(r.individualId);
              }
            }
            const rowBusy = row.busyCreating || busy;

            return (
              <li key={row.clientId} className="rounded-lg border border-border p-4 space-y-3">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-sm font-medium text-muted-foreground">
                    Participant {i + 1}
                  </span>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    onClick={() => removeRow(i)}
                    disabled={rows.length <= 2 || rowBusy}
                    aria-label={`Remove participant ${i + 1}`}
                  >
                    <Trash2 className="size-4" aria-hidden />
                  </Button>
                </div>

                {/* Person selection */}
                {row.individualId ? (
                  <div className="space-y-1">
                    <Label>Person</Label>
                    <div className="flex items-center justify-between gap-2">
                      <Link
                        href={`/admin/individuals/${row.individualId}`}
                        className="link link-primary text-sm font-medium truncate"
                      >
                        {row.displayLabel || row.individualId}
                      </Link>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() =>
                          updateRow(i, {
                            individualId: "",
                            displayLabel: "",
                            roleId: "",
                            createMode: false,
                          })
                        }
                        disabled={rowBusy}
                        className="shrink-0 text-xs"
                      >
                        Change
                      </Button>
                    </div>
                  </div>
                ) : row.createMode ? (
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <Label>New person</Label>
                      <Button
                        type="button"
                        variant="link"
                        className="h-auto p-0 text-xs text-primary"
                        disabled={rowBusy}
                        onClick={() => updateRow(i, { createMode: false })}
                      >
                        Search the tree instead
                      </Button>
                    </div>
                    <div className="grid gap-3 sm:grid-cols-2">
                      <div className="space-y-2 sm:col-span-2">
                        <Label htmlFor={`mini-given-${row.clientId}`}>Given names</Label>
                        <Input
                          id={`mini-given-${row.clientId}`}
                          value={row.mini.givenNamesLine}
                          onChange={(e) =>
                            updateRow(i, { mini: { ...row.mini, givenNamesLine: e.target.value } })
                          }
                          disabled={rowBusy}
                          className="min-h-11 sm:min-h-10"
                        />
                      </div>
                      <div className="space-y-2 sm:col-span-2">
                        <Label htmlFor={`mini-sur-${row.clientId}`}>Surname</Label>
                        <Input
                          id={`mini-sur-${row.clientId}`}
                          value={row.mini.surnameLine}
                          onChange={(e) =>
                            updateRow(i, { mini: { ...row.mini, surnameLine: e.target.value } })
                          }
                          disabled={rowBusy}
                          className="min-h-11 sm:min-h-10"
                        />
                      </div>
                      <div className="space-y-2 sm:col-span-2">
                        <Label htmlFor={`mini-sex-${row.clientId}`}>Sex</Label>
                        <select
                          id={`mini-sex-${row.clientId}`}
                          className={selectClassName}
                          value={row.mini.sex}
                          onChange={(e) =>
                            updateRow(i, { mini: { ...row.mini, sex: e.target.value } })
                          }
                          disabled={rowBusy}
                        >
                          <option value="">Unknown</option>
                          <option value="M">Male</option>
                          <option value="F">Female</option>
                          <option value="U">Unknown (U)</option>
                          <option value="X">Other (X)</option>
                        </select>
                      </div>
                    </div>
                    <KeyFactSection
                      title="Birth (optional)"
                      fact={row.mini.birth}
                      onChange={(n) => updateRow(i, { mini: { ...row.mini, birth: n } })}
                    />
                    <KeyFactSection
                      title="Death (optional)"
                      fact={row.mini.death}
                      onChange={(n) => updateRow(i, { mini: { ...row.mini, death: n } })}
                    />
                    <Button
                      type="button"
                      variant="secondary"
                      size="sm"
                      disabled={rowBusy || !miniIndividualHasNameParts(row.mini)}
                      onClick={() => void createAndLink(i)}
                    >
                      {row.busyCreating ? "Creating…" : "Create and link"}
                    </Button>
                  </div>
                ) : (
                  <div className="space-y-2">
                    <Label>Person</Label>
                    <IndividualSearchPicker
                      idPrefix={`assoc-${row.clientId}`}
                      label=""
                      description=""
                      excludeIds={excludeIds}
                      onPick={(ind) => pickIndividual(i, ind)}
                      allowEmptySearch
                      limit={20}
                    />
                    <Button
                      type="button"
                      variant="link"
                      className="h-auto p-0 text-xs text-primary"
                      onClick={() => updateRow(i, { createMode: true })}
                      disabled={rowBusy}
                    >
                      Create a new person instead
                    </Button>
                  </div>
                )}

                {/* Role */}
                <div className="space-y-2">
                  <Label htmlFor={`role-${row.clientId}`}>Role</Label>
                  <select
                    id={`role-${row.clientId}`}
                    className={selectClassName}
                    value={row.roleId}
                    onChange={(e) => updateRow(i, { roleId: e.target.value })}
                    disabled={rowBusy || !selectedType}
                  >
                    <option value="">
                      {!selectedType ? "Select a type first…" : "Select role…"}
                    </option>
                    {(selectedType?.roles ?? []).map((role) => (
                      <option key={role.id} value={role.id}>
                        {role.label}
                      </option>
                    ))}
                  </select>
                </div>
              </li>
            );
          })}
        </ul>
      </div>

      {/* Notes */}
      <div className="space-y-2">
        <Label htmlFor="notes">Notes (optional)</Label>
        <textarea
          id="notes"
          className="flex min-h-[80px] w-full rounded-lg border border-input bg-transparent px-3 py-2 text-sm placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:opacity-50"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="Any additional context…"
          rows={3}
          disabled={busy}
        />
      </div>

      {/* Actions */}
      <div className="flex items-center gap-3">
        <Button type="submit" disabled={busy}>
          {busy ? "Saving…" : mode === "create" ? "Create association" : "Save changes"}
        </Button>
        <Link
          href="/admin/associations"
          className="text-sm text-muted-foreground hover:text-foreground inline-flex items-center gap-1"
        >
          <ArrowLeft className="size-3.5" aria-hidden />
          Back to associations
        </Link>
      </div>
    </form>
  );
}
