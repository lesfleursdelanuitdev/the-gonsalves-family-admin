"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { UserPlus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { IndividualSearchPicker } from "@/components/admin/IndividualSearchPicker";
import { fetchJson, postJson, deleteJson } from "@/lib/infra/api";
import { individualSearchDisplayName } from "@/lib/gedcom/individual-search-display";
import type { AdminIndividualListItem } from "@/hooks/useAdminIndividuals";

type RelationshipType = {
  id: string;
  key: string;
  label: string;
  roles: Array<{ id: string; key: string; label: string }>;
};

type RelationshipRow = {
  id: string;
  relationshipType: { key: string; label: string };
  participants: Array<{
    individualId: string;
    individual: { id: string; fullName: string | null; xref: string };
    role: { id: string; key: string; label: string };
  }>;
};

function roleSentence(typeKey: string, myRoleKey: string, otherName: string): string {
  if (typeKey === "friendship") return `is friend of ${otherName}`;
  if (typeKey === "godparenthood") {
    if (myRoleKey === "godparent") return `is godparent of ${otherName}`;
    if (myRoleKey === "godchild") return `is godchild of ${otherName}`;
  }
  if (typeKey === "enslavement") {
    if (myRoleKey === "enslaver") return `enslaved ${otherName}`;
    if (myRoleKey === "enslaved") return `was enslaved by ${otherName}`;
  }
  if (typeKey === "mentorship") {
    if (myRoleKey === "mentor") return `mentored ${otherName}`;
    if (myRoleKey === "mentee") return `was mentored by ${otherName}`;
  }
  if (typeKey === "employment") {
    if (myRoleKey === "employer") return `employed ${otherName}`;
    if (myRoleKey === "employee") return `worked for ${otherName}`;
  }
  if (typeKey === "step_parenthood") {
    if (myRoleKey === "step_parent") return `was step-parent of ${otherName}`;
    if (myRoleKey === "step_child") return `was step-child of ${otherName}`;
  }
  return `is connected to ${otherName}`;
}

export function IndividualEditorRelationshipsSection({
  individualId,
  individualLabel,
}: {
  individualId: string;
  individualLabel: string;
}) {
  const [relationshipTypes, setRelationshipTypes] = useState<RelationshipType[]>([]);
  const [relationships, setRelationships] = useState<RelationshipRow[]>([]);
  const [associate, setAssociate] = useState<AdminIndividualListItem | null>(null);
  const [relationshipTypeId, setRelationshipTypeId] = useState("");
  const [myRoleId, setMyRoleId] = useState("");
  const [otherRoleId, setOtherRoleId] = useState("");
  const [busy, setBusy] = useState(false);

  async function refresh() {
    const [typesRes, relRes] = await Promise.all([
      fetchJson<{ relationshipTypes: RelationshipType[] }>("/api/admin/relationship-types"),
      fetchJson<{ relationships: RelationshipRow[] }>(`/api/admin/individuals/${encodeURIComponent(individualId)}/relationships`),
    ]);
    setRelationshipTypes(typesRes.relationshipTypes ?? []);
    setRelationships(relRes.relationships ?? []);
  }

  useEffect(() => {
    void refresh().catch((e) => {
      console.error(e);
      toast.error("Could not load relationship data.");
    });
  }, [individualId]);

  const selectedType = useMemo(
    () => relationshipTypes.find((rt) => rt.id === relationshipTypeId) ?? null,
    [relationshipTypes, relationshipTypeId],
  );

  async function createRelationship() {
    if (!associate?.id) {
      toast.error("Choose an associated person.");
      return;
    }
    if (!relationshipTypeId || !myRoleId || !otherRoleId) {
      toast.error("Choose relationship type and both roles.");
      return;
    }
    setBusy(true);
    try {
      await postJson("/api/admin/individual-relationships", {
        relationshipTypeId,
        participants: [
          { individualId, roleId: myRoleId, sortOrder: 0 },
          { individualId: associate.id, roleId: otherRoleId, sortOrder: 1 },
        ],
      });
      setAssociate(null);
      setRelationshipTypeId("");
      setMyRoleId("");
      setOtherRoleId("");
      await refresh();
      toast.success("Relationship saved.");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not save relationship");
    } finally {
      setBusy(false);
    }
  }

  async function removeRelationship(id: string) {
    setBusy(true);
    try {
      await deleteJson(`/api/admin/individual-relationships/${encodeURIComponent(id)}`);
      await refresh();
      toast.success("Relationship removed.");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not remove relationship");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        Rich relationship model (type + directional roles). Raw GEDCOM <code className="text-xs">ASSO/RELA</code> rows are preserved separately.
      </p>

      <div className="rounded-lg border border-border p-4 space-y-3">
        <div className="space-y-2">
          <Label>Associated person</Label>
          <IndividualSearchPicker
            idPrefix={`rich-relationship-${individualId}`}
            label=""
            description=""
            excludeIds={new Set([individualId])}
            onPick={(ind) => setAssociate(ind)}
            allowEmptySearch
            limit={20}
          />
          {associate ? (
            <p className="text-xs text-muted-foreground">
              Selected: <span className="font-medium">{individualSearchDisplayName(associate)}</span>
            </p>
          ) : null}
        </div>

        <div className="grid gap-3 md:grid-cols-3">
          <div className="space-y-2">
            <Label>Relationship type</Label>
            <select
              className="select select-bordered w-full"
              value={relationshipTypeId}
              onChange={(e) => {
                setRelationshipTypeId(e.target.value);
                setMyRoleId("");
                setOtherRoleId("");
              }}
              disabled={busy}
            >
              <option value="">Select type...</option>
              {relationshipTypes.map((rt) => (
                <option key={rt.id} value={rt.id}>
                  {rt.label}
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-2">
            <Label>Your role</Label>
            <select className="select select-bordered w-full" value={myRoleId} onChange={(e) => setMyRoleId(e.target.value)} disabled={busy || !selectedType}>
              <option value="">Select role...</option>
              {(selectedType?.roles ?? []).map((role) => (
                <option key={role.id} value={role.id}>
                  {role.label}
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-2">
            <Label>Associate role</Label>
            <select className="select select-bordered w-full" value={otherRoleId} onChange={(e) => setOtherRoleId(e.target.value)} disabled={busy || !selectedType}>
              <option value="">Select role...</option>
              {(selectedType?.roles ?? []).map((role) => (
                <option key={role.id} value={role.id}>
                  {role.label}
                </option>
              ))}
            </select>
          </div>
        </div>

        <Button type="button" variant="secondary" className="gap-2" onClick={() => void createRelationship()} disabled={busy}>
          <UserPlus className="size-4" aria-hidden />
          Save relationship
        </Button>
      </div>

      {relationships.length === 0 ? (
        <p className="text-sm text-muted-foreground">No rich relationships recorded yet.</p>
      ) : (
        <ul className="space-y-3">
          {relationships.map((rel) => {
            const me = rel.participants.find((p) => p.individualId === individualId);
            const other = rel.participants.find((p) => p.individualId !== individualId);
            const otherName = other
              ? (other.individual.fullName?.trim() || other.individual.xref || other.individual.id)
              : "Unknown";
            return (
              <li key={rel.id} className="rounded-lg border border-border p-3 bg-base-content/[0.03]">
                <div className="flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-sm font-medium">
                      {individualLabel || "This person"} {me ? roleSentence(rel.relationshipType.key, me.role.key, otherName) : `is related to ${otherName}`}
                    </p>
                    <p className="text-xs text-muted-foreground mt-1">
                      {rel.relationshipType.label}
                      {other ? (
                        <>
                          {" · "}
                          <Link href={`/admin/individuals/${encodeURIComponent(other.individual.id)}`} className="link link-primary">
                            {otherName}
                          </Link>
                        </>
                      ) : null}
                    </p>
                  </div>
                  <Button type="button" variant="ghost" size="icon" onClick={() => void removeRelationship(rel.id)} disabled={busy} aria-label="Remove relationship">
                    <Trash2 className="size-4" aria-hidden />
                  </Button>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
