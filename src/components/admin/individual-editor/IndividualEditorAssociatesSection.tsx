"use client";

import { useCallback, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { UserRoundSearch } from "lucide-react";
import { selectClassName } from "@/components/data-viewer/constants";
import { KeyFactSection } from "@/components/admin/individual-editor/KeyFactSection";
import { IndividualSearchPicker } from "@/components/admin/IndividualSearchPicker";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { AssociateFormRow } from "@/lib/forms/individual-editor-form";
import {
  buildMiniIndividualEditorBody,
  emptyMiniIndividualFields,
  miniIndividualHasNameParts,
  type MiniIndividualFields,
} from "@/lib/forms/family-mini-individual-payload";
import type { AdminIndividualListItem } from "@/hooks/useAdminIndividuals";
import { individualSearchDisplayName } from "@/lib/gedcom/individual-search-display";
import { ApiError, postJson } from "@/lib/infra/api";

export type IndividualEditorAssociatesSectionProps = {
  mode: "create" | "edit";
  associates: AssociateFormRow[];
  subjectIndividualId: string;
  onAddRow: () => void;
  onRemoveRow: (index: number) => void;
  onChangeRela: (index: number, rela: string) => void;
  onPickAssociate: (index: number, individual: AdminIndividualListItem) => void;
};

type CreateAssociateResponse = {
  associateIndividualId: string;
  xref: string;
  fullName: string | null;
};

export function IndividualEditorAssociatesSection({
  mode,
  associates,
  subjectIndividualId,
  onAddRow,
  onRemoveRow,
  onChangeRela,
  onPickAssociate,
}: IndividualEditorAssociatesSectionProps) {
  const router = useRouter();
  const [createModeByClientId, setCreateModeByClientId] = useState<Record<string, boolean>>({});
  const [miniByClientId, setMiniByClientId] = useState<Record<string, MiniIndividualFields>>({});
  const [busyClientId, setBusyClientId] = useState<string | null>(null);

  const exitCreateMode = useCallback((clientId: string) => {
    setCreateModeByClientId((m) => {
      const { [clientId]: _removed, ...rest } = m;
      return rest;
    });
    setMiniByClientId((prev) => {
      const { [clientId]: _r, ...rest } = prev;
      return rest;
    });
  }, []);

  const enterCreateMode = useCallback((clientId: string) => {
    setCreateModeByClientId((m) => ({ ...m, [clientId]: true }));
    setMiniByClientId((prev) =>
      prev[clientId] ? prev : { ...prev, [clientId]: emptyMiniIndividualFields() },
    );
  }, []);

  const setMiniFields = useCallback((clientId: string, patch: Partial<MiniIndividualFields>) => {
    setMiniByClientId((prev) => {
      const base = prev[clientId] ?? emptyMiniIndividualFields();
      return { ...prev, [clientId]: { ...base, ...patch } };
    });
  }, []);

  const submitCreateAssociate = useCallback(
    async (rowIndex: number, clientId: string, relaValue: string) => {
      if (!subjectIndividualId.trim()) {
        toast.error("Save the person first before adding associates.");
        return;
      }
      const relaTrim = relaValue.trim();
      if (!relaTrim) {
        toast.error("Enter RELA (relationship label) before creating a linked person.");
        return;
      }
      const mini = miniByClientId[clientId] ?? emptyMiniIndividualFields();
      if (!miniIndividualHasNameParts(mini)) {
        toast.error("Given name or surname is required.");
        return;
      }
      setBusyClientId(clientId);
      try {
        const res = await postJson<CreateAssociateResponse>(
          `/api/admin/individuals/${subjectIndividualId}/associates`,
          {
            individual: buildMiniIndividualEditorBody(mini),
            rela: relaTrim,
          },
        );
        const synthetic: AdminIndividualListItem = {
          id: res.associateIndividualId,
          xref: res.xref,
          fullName: res.fullName,
          sex: null,
          birthYear: null,
          deathYear: null,
        };
        exitCreateMode(clientId);
        onPickAssociate(rowIndex, synthetic);
        router.refresh();
        toast.success(individualSearchDisplayName(synthetic).trim() || "Associate created");
      } catch (e) {
        toast.error(e instanceof ApiError ? e.message : "Could not create associate");
      } finally {
        setBusyClientId(null);
      }
    },
    [
      subjectIndividualId,
      miniByClientId,
      exitCreateMode,
      onPickAssociate,
      router,
    ],
  );

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        Non-lineage links from GEDCOM <code className="text-xs">ASSO</code> (godparent, neighbor, witness, etc.). These
        are not parent, spouse, or child relationships.
      </p>
      {mode === "create" ? (
        <p className="rounded-md border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-sm text-amber-950 dark:text-amber-100">
          Save the person first, then add associates from the edit screen.
        </p>
      ) : null}
      <ul className="space-y-4">
        {associates.map((row, i) => {
          const excludeIds = new Set<string>();
          if (mode === "edit" && subjectIndividualId) excludeIds.add(subjectIndividualId);
          for (let j = 0; j < associates.length; j++) {
            if (j === i) continue;
            const oid = associates[j].associateIndividualId.trim();
            if (oid) excludeIds.add(oid);
          }

          const isCreateMode = createModeByClientId[row.clientId] === true;
          const mini = miniByClientId[row.clientId] ?? emptyMiniIndividualFields();
          const rowBusy = busyClientId === row.clientId;

          return (
          <li key={row.clientId} className="rounded-lg border border-border p-4 space-y-3">
            <div className="flex flex-wrap items-end justify-between gap-2">
              <div className="space-y-1 min-w-0 flex-1">
                <Label htmlFor={`assoc-person-${row.clientId}`}>Associated person</Label>
                {row.associateIndividualId.trim() ? (
                  <div className="flex flex-wrap items-center gap-2 text-sm">
                    <Link
                      href={`/admin/individuals/${row.associateIndividualId.trim()}`}
                      className="link link-primary font-medium truncate"
                    >
                      {row.associateDisplayLabel.trim() || row.associateIndividualId}
                    </Link>
                    <span className="text-muted-foreground text-xs">({row.associateIndividualId.slice(0, 8)}…)</span>
                  </div>
                ) : isCreateMode ? (
                  <div className="space-y-3">
                    <Button
                      type="button"
                      variant="link"
                      className="h-auto p-0 text-xs text-primary"
                      disabled={rowBusy}
                      onClick={() => exitCreateMode(row.clientId)}
                    >
                      Search the tree instead
                    </Button>
                    <p className="text-xs text-muted-foreground">
                      Creates a minimal person and attaches them via ASSO in one save (relationship uses RELA below).
                    </p>
                    <div className="grid gap-3 sm:grid-cols-2">
                      <div className="space-y-2 sm:col-span-2">
                        <Label htmlFor={`assoc-nc-given-${row.clientId}`}>Given names</Label>
                        <Input
                          id={`assoc-nc-given-${row.clientId}`}
                          value={mini.givenNamesLine}
                          onChange={(e) => setMiniFields(row.clientId, { givenNamesLine: e.target.value })}
                          disabled={rowBusy}
                          className="min-h-11 sm:min-h-10"
                        />
                      </div>
                      <div className="space-y-2 sm:col-span-2">
                        <Label htmlFor={`assoc-nc-sur-${row.clientId}`}>Surname</Label>
                        <Input
                          id={`assoc-nc-sur-${row.clientId}`}
                          value={mini.surnameLine}
                          onChange={(e) => setMiniFields(row.clientId, { surnameLine: e.target.value })}
                          disabled={rowBusy}
                          className="min-h-11 sm:min-h-10"
                        />
                      </div>
                      <div className="space-y-2 sm:col-span-2">
                        <Label htmlFor={`assoc-nc-sex-${row.clientId}`}>Sex</Label>
                        <select
                          id={`assoc-nc-sex-${row.clientId}`}
                          className={selectClassName}
                          value={mini.sex}
                          onChange={(e) => setMiniFields(row.clientId, { sex: e.target.value })}
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
                    <KeyFactSection title="Birth (optional)" fact={mini.birth} onChange={(n) => setMiniFields(row.clientId, { birth: n })} />
                    <KeyFactSection title="Death (optional)" fact={mini.death} onChange={(n) => setMiniFields(row.clientId, { death: n })} />
                    <Button
                      type="button"
                      variant="secondary"
                      size="sm"
                      disabled={rowBusy || !miniIndividualHasNameParts(mini) || !row.rela.trim()}
                      onClick={() => void submitCreateAssociate(i, row.clientId, row.rela)}
                      className="w-full sm:w-auto"
                    >
                      {rowBusy ? "Creating…" : "Create and link"}
                    </Button>
                  </div>
                ) : (
                  <div className="space-y-2">
                    <IndividualSearchPicker
                      idPrefix={`assoc-${row.clientId}`}
                      label=""
                      description=""
                      excludeIds={excludeIds}
                      onPick={(ind) => {
                        exitCreateMode(row.clientId);
                        onPickAssociate(i, ind);
                      }}
                      allowEmptySearch
                      limit={20}
                    />
                    <Button
                      type="button"
                      variant="link"
                      className="h-auto p-0 text-xs text-primary"
                      onClick={() => enterCreateMode(row.clientId)}
                    >
                      Create a new person instead
                    </Button>
                  </div>
                )}
              </div>
              <Button type="button" variant="outline" size="sm" onClick={() => onRemoveRow(i)}>
                Remove
              </Button>
            </div>
            <div className="space-y-1">
              <Label htmlFor={`assoc-rela-${row.clientId}`}>Relationship (RELA)</Label>
              <Input
                id={`assoc-rela-${row.clientId}`}
                value={row.rela}
                onChange={(e) => onChangeRela(i, e.target.value)}
                placeholder="e.g. Godfather, Neighbor, Witness"
                maxLength={500}
                disabled={rowBusy}
              />
            </div>
          </li>
          );
        })}
      </ul>
      {mode === "edit" ? (
        <Button type="button" variant="secondary" size="sm" onClick={onAddRow} className="gap-2">
          <UserRoundSearch className="size-4" aria-hidden />
          Add associate
        </Button>
      ) : null}
    </div>
  );
}
