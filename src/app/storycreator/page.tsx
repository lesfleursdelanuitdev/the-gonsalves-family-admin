"use client";

import { useCallback, useMemo } from "react";
import { useRouter } from "next/navigation";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus, ScrollText, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { deleteStoryDocument, loadStoryIndex } from "@/lib/admin/story-creator/story-storage";
import type { StoryDocumentKind, StoryIndexEntry, StoryLifecycleStatus } from "@/lib/admin/story-creator/story-types";

function displayTitle(title: string): string {
  const t = title.trim();
  return t || "Untitled story";
}

function kindLabel(kind: StoryDocumentKind | undefined): string {
  switch (kind ?? "story") {
    case "article":
      return "Article";
    case "post":
      return "Post";
    case "folklore":
      return "Folklore";
    default:
      return "Story";
  }
}

function lifecycleLabel(status: StoryLifecycleStatus | undefined): string {
  return status === "published" ? "Published" : "Draft";
}

export default function StoryCreatorStandaloneHomePage() {
  const router = useRouter();
  const queryClient = useQueryClient();

  const { data: entries = [], isLoading: loading } = useQuery<StoryIndexEntry[]>({
    queryKey: ["storycreator", "index"],
    queryFn: async () => {
      try {
        return await loadStoryIndex();
      } catch (e) {
        console.error(e);
        toast.error("Could not load stories", {
          description: e instanceof Error ? e.message : undefined,
        });
        return [];
      }
    },
    retry: false,
  });

  const sortedEntries = useMemo(
    () => [...entries].sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()),
    [entries],
  );

  const handleDelete = useCallback(
    async (entry: StoryIndexEntry) => {
      if (!window.confirm(`Delete "${displayTitle(entry.title)}"? This marks the story as deleted on the server.`)) return;
      try {
        await deleteStoryDocument(entry.id);
        await queryClient.invalidateQueries({ queryKey: ["storycreator", "index"] });
        toast.success("Story deleted.");
      } catch (e) {
        toast.error("Delete failed", { description: e instanceof Error ? e.message : undefined });
      }
    },
    [queryClient],
  );

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-5xl flex-col gap-5 p-4 sm:p-6">
      <header className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-base-content">Story Creator</h1>
          <p className="mt-1 text-sm text-base-content/65">
            Open an existing story or create a new draft. Sign in is shared with admin.gonsalvesfamily.com.
          </p>
        </div>
        <Button className="gap-2" onClick={() => router.push("/storycreator/new")}>
          <Plus className="size-4" aria-hidden />
          New story
        </Button>
      </header>

      {loading ? (
        <div className="rounded-box border border-base-content/10 bg-base-200/60 p-6 text-sm text-base-content/70">
          Loading stories…
        </div>
      ) : sortedEntries.length === 0 ? (
        <div className="rounded-box border border-base-content/10 bg-base-200/60 p-6 text-sm text-base-content/70">
          No stories yet. Create one to begin editing.
        </div>
      ) : (
        <section className="grid gap-4 sm:grid-cols-2">
          {sortedEntries.map((entry) => (
            <Card key={entry.id} className="border-base-content/12 shadow-sm shadow-black/10">
              <CardHeader className="space-y-2 pb-2">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <CardTitle className="line-clamp-2 break-words text-base">{displayTitle(entry.title)}</CardTitle>
                    <CardDescription className="mt-1 text-xs">
                      {kindLabel(entry.kind)} · {lifecycleLabel(entry.status)}
                    </CardDescription>
                  </div>
                  <ScrollText className="mt-0.5 size-4 shrink-0 text-base-content/55" aria-hidden />
                </div>
              </CardHeader>
              <CardContent className="flex items-center justify-between gap-2">
                <span className="text-xs tabular-nums text-base-content/60">
                  {new Date(entry.updatedAt).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" })}
                </span>
                <div className="flex items-center gap-2">
                  <Button variant="outline" size="sm" onClick={() => router.push(`/storycreator/${entry.id}`)}>
                    Open
                  </Button>
                  <Button variant="ghost" size="icon" onClick={() => void handleDelete(entry)} aria-label="Delete story">
                    <Trash2 className="size-4 text-destructive" aria-hidden />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </section>
      )}
    </main>
  );
}

