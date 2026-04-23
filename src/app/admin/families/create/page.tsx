"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { FamilyEditForm } from "@/components/admin/FamilyEditForm";
import { Button } from "@/components/ui/button";
import { ApiError, postJson } from "@/lib/infra/api";

/**
 * Deduplicate the initial POST in React Strict Mode (and overlapping mounts) so only one empty family row is created.
 */
let singletonDraftPost: Promise<string> | null = null;

function ensureEmptyFamilyOnServer(): Promise<string> {
  if (!singletonDraftPost) {
    singletonDraftPost = postJson<{ family: { id?: string } }>("/api/admin/families", {}).then((res) => {
      const id = typeof res.family?.id === "string" ? res.family.id : "";
      if (!id) throw new Error("No family id returned from server.");
      return id;
    });
  }
  return singletonDraftPost;
}

function clearSingletonDraftPost() {
  singletonDraftPost = null;
}

function FamilyCreateFlow() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const idFromUrl = searchParams.get("id")?.trim() ?? "";
  const [bootError, setBootError] = useState<string | null>(null);

  useEffect(() => {
    if (idFromUrl) {
      clearSingletonDraftPost();
      setBootError(null);
      return;
    }

    let cancelled = false;
    setBootError(null);

    ensureEmptyFamilyOnServer()
      .then((id) => {
        if (cancelled) return;
        router.replace(`/admin/families/create?id=${encodeURIComponent(id)}`, { scroll: false });
      })
      .catch((e) => {
        if (cancelled) return;
        clearSingletonDraftPost();
        setBootError(
          e instanceof ApiError ? e.message : e instanceof Error ? e.message : "Could not create family.",
        );
      });

    return () => {
      cancelled = true;
    };
  }, [idFromUrl, router]);

  if (!idFromUrl && bootError) {
    return (
      <div className="mx-auto flex w-full max-w-none flex-col gap-4 pb-20 md:pb-24">
        <p className="text-sm text-destructive" role="alert">
          {bootError}
        </p>
        <Button
          type="button"
          variant="outline"
          className="w-fit"
          onClick={() => {
            clearSingletonDraftPost();
            window.location.assign("/admin/families/create");
          }}
        >
          Try again
        </Button>
      </div>
    );
  }

  if (!idFromUrl) {
    return (
      <div className="mx-auto w-full max-w-none pb-20 md:pb-24">
        <p className="text-sm text-muted-foreground">Preparing new family…</p>
      </div>
    );
  }

  return <FamilyEditForm familyId={idFromUrl} mode="create" />;
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
