"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ApiError, postJson } from "@/lib/infra/api";

export default function StoryCreatorStandaloneNewPage() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const { id } = await postJson<{ id: string }>("/api/admin/stories", { title: "Untitled story" });
        if (!cancelled) router.replace(`/storycreator/${id}`);
      } catch (e) {
        if (cancelled) return;
        const msg = e instanceof ApiError ? e.message : e instanceof Error ? e.message : "Could not create story.";
        setError(msg);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [router]);

  if (error) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-3 p-12 text-center text-sm text-destructive">
        <p>{error}</p>
        <button type="button" className="text-primary underline" onClick={() => router.push("/storycreator")}>
          Back to stories
        </button>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center p-12 text-sm text-muted-foreground">Opening editor…</div>
  );
}

