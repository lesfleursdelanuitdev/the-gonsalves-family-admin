"use client";

import { Suspense, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { FamilyEditForm } from "@/components/admin/FamilyEditForm";
import { IndividualSearchPicker } from "@/components/admin/IndividualSearchPicker";
import { Button } from "@/components/ui/button";
import { ApiError, postJson } from "@/lib/infra/api";
import type { AdminIndividualListItem } from "@/hooks/useAdminIndividuals";

function FamilyCreateFlow() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const idFromUrl = searchParams.get("id")?.trim() ?? "";
  const [bootError, setBootError] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);

  async function onPickFirstParent(ind: AdminIndividualListItem) {
    if (creating) return;
    setCreating(true);
    setBootError(null);
    try {
      const res = await postJson<{ family: { id?: string } }>("/api/admin/families", {
        firstParentId: ind.id,
      });
      const newId = typeof res.family?.id === "string" ? res.family.id : "";
      if (!newId) throw new Error("No family id returned from server.");
      router.replace(`/admin/families/create?id=${encodeURIComponent(newId)}`, { scroll: false });
    } catch (e) {
      setBootError(e instanceof ApiError ? e.message : e instanceof Error ? e.message : "Could not create family.");
      setCreating(false);
    }
  }

  if (idFromUrl) {
    return <FamilyEditForm familyId={idFromUrl} mode="create" />;
  }

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-6 pb-20 md:pb-24">
      <div className="flex flex-wrap items-center gap-3">
        <Button type="button" variant="outline" size="sm" asChild>
          <Link href="/admin/families">← Families</Link>
        </Button>
      </div>
      <header className="space-y-2">
        <h1 className="text-2xl font-semibold tracking-tight">Add new family</h1>
        <p className="text-sm text-muted-foreground">
          Choose an existing person as the first parent. A second parent and children can be added on the next
          screen.
        </p>
      </header>
      {bootError ? (
        <p className="text-sm text-destructive" role="alert">
          {bootError}
        </p>
      ) : null}
      <IndividualSearchPicker
        idPrefix="family-create-first-parent"
        label="First parent"
        description="Search by given and last name, then select one row."
        onPick={onPickFirstParent}
        isPickDisabled={() => creating}
        allowEmptySearch
      />
      {creating ? <p className="text-sm text-muted-foreground">Creating family…</p> : null}
    </div>
  );
}

export default function AdminFamilyCreatePage() {
  return (
    <Suspense
      fallback={<p className="mx-auto w-full max-w-none text-sm text-muted-foreground md:pb-24">Loading…</p>}
    >
      <FamilyCreateFlow />
    </Suspense>
  );
}
