"use client";

import { Suspense, useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { postJson, ApiError } from "@/lib/infra/api";
import { WhatsNewEditForm } from "@/components/admin/whats-new/WhatsNewEditForm";

function WhatsNewCreateFlow() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const idFromUrl = searchParams.get("id")?.trim() ?? "";
  const [bootError, setBootError] = useState<string | null>(null);
  const hasStarted = useRef(false);

  useEffect(() => {
    if (idFromUrl || hasStarted.current) return;
    hasStarted.current = true;
    postJson<{ post: { id: string } }>("/api/admin/whats-new", {})
      .then((res) => {
        const newId = res.post?.id;
        if (!newId) throw new Error("No id returned from server.");
        router.replace(`/admin/whats-new/create?id=${encodeURIComponent(newId)}`, { scroll: false });
      })
      .catch((e) => {
        setBootError(e instanceof ApiError ? e.message : e instanceof Error ? e.message : "Could not create update.");
      });
  }, [idFromUrl, router]);

  if (idFromUrl) {
    return <WhatsNewEditForm postId={idFromUrl} mode="create" />;
  }

  return (
    <div className="mx-auto w-full max-w-3xl py-8">
      {bootError ? (
        <p className="text-sm text-destructive" role="alert">{bootError}</p>
      ) : (
        <p className="text-sm text-muted-foreground">Preparing editor…</p>
      )}
    </div>
  );
}

export default function AdminWhatsNewCreatePage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">New update</h1>
        <p className="text-sm text-muted-foreground">Write an announcement for the family site.</p>
      </div>
      <Suspense fallback={<p className="text-sm text-muted-foreground">Loading…</p>}>
        <WhatsNewCreateFlow />
      </Suspense>
    </div>
  );
}
