"use client";

import { Suspense, useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { FamilyEditForm } from "@/components/admin/FamilyEditForm";
import { ApiError, postJson } from "@/lib/infra/api";

function FamilyCreateFlow() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const idFromUrl = searchParams.get("id")?.trim() ?? "";
  const [bootError, setBootError] = useState<string | null>(null);
  const hasStarted = useRef(false);

  useEffect(() => {
    if (idFromUrl || hasStarted.current) return;
    hasStarted.current = true;
    void postJson<{ family: { id?: string } }>("/api/admin/families", {})
      .then((res) => {
        const newId = typeof res.family?.id === "string" ? res.family.id : "";
        if (!newId) throw new Error("No family id returned from server.");
        router.replace(`/admin/families/create?id=${encodeURIComponent(newId)}`, { scroll: false });
      })
      .catch((e) => {
        setBootError(e instanceof ApiError ? e.message : e instanceof Error ? e.message : "Could not start family editor.");
      });
  }, [idFromUrl, router]);

  if (idFromUrl) {
    return <FamilyEditForm familyId={idFromUrl} mode="create" />;
  }

  return (
    <div className="mx-auto w-full max-w-2xl pb-20 md:pb-24">
      {bootError ? (
        <p className="text-sm text-destructive" role="alert">
          {bootError}
        </p>
      ) : (
        <p className="text-sm text-muted-foreground">Preparing family editor…</p>
      )}
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
