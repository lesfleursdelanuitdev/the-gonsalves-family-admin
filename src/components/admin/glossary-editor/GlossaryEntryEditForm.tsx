"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { ArrowLeft, BookOpen, FileText, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { ApiError, postJson } from "@/lib/infra/api";
import { useGlossaryEntryDetail, useCreateGlossaryEntry, useUpdateGlossaryEntry, useDeleteGlossaryEntry } from "@/hooks/useAdminGlossary";
import type { AdminGlossaryDetailResponse } from "@/hooks/useAdminGlossary";

const STATUS_OPTIONS = [
  { value: "draft", label: "Draft" },
  { value: "published", label: "Published" },
  { value: "archived", label: "Archived" },
] as const;

const PART_OF_SPEECH_OPTIONS = ["noun", "verb", "adjective", "adverb", "phrase", "exclamation", "other"];

function chipBtn(active: boolean) {
  return cn(
    "rounded-lg border px-3 py-2 text-sm font-semibold transition-colors",
    active
      ? "border-primary/45 bg-primary/15 text-primary shadow-sm ring-1 ring-primary/15"
      : "border-base-content/12 bg-base-100/70 text-base-content/75 hover:border-base-content/20",
  );
}

export type GlossaryEntryEditFormProps = { contextReturnHref?: string } & (
  | { mode: "create" }
  | { mode: "edit"; entryId: string }
);

export function GlossaryEntryEditForm(props: GlossaryEntryEditFormProps) {
  const router = useRouter();
  const mode = props.mode;
  const entryId = mode === "edit" ? props.entryId : "";
  const backHref = props.contextReturnHref ?? "/admin/glossary";
  const formId = "glossary-entry-edit-form";

  const { data, isLoading, error } = useGlossaryEntryDetail(entryId);
  const createEntry = useCreateGlossaryEntry();
  const updateEntry = useUpdateGlossaryEntry();
  const deleteEntry = useDeleteGlossaryEntry();

  const [word, setWord] = useState("");
  const [slug, setSlug] = useState("");
  const [dialect, setDialect] = useState("");
  const [pronunciation, setPronunciation] = useState("");
  const [partOfSpeech, setPartOfSpeech] = useState("");
  const [meaning, setMeaning] = useState("");
  const [usageExample, setUsageExample] = useState("");
  const [usageTranslation, setUsageTranslation] = useState("");
  const [notes, setNotes] = useState("");
  const [status, setStatus] = useState<"draft" | "published" | "archived">("draft");
  const [tags, setTags] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const detail = data as AdminGlossaryDetailResponse | undefined;
  const canEdit = mode === "create" ? true : Boolean(detail?.entry.canEdit);

  useEffect(() => {
    if (mode !== "edit" || !detail?.entry) return;
    const e = detail.entry;
    setWord(e.word);
    setSlug(e.slug);
    setDialect(e.dialect ?? "");
    setPronunciation(e.pronunciation ?? "");
    setPartOfSpeech(e.partOfSpeech ?? "");
    setMeaning(e.meaning);
    setUsageExample(e.usageExample ?? "");
    setUsageTranslation(e.usageTranslation ?? "");
    setNotes(e.notes ?? "");
    setStatus(e.status);
    setTags(e.tags.join(", "));
  }, [mode, detail?.entry]);

  const handleSubmit = async (ev: React.FormEvent) => {
    ev.preventDefault();
    const w = word.trim();
    if (!w) { toast.error("Word is required."); return; }
    const m = meaning.trim();
    if (!m) { toast.error("Meaning is required."); return; }
    setSubmitting(true);
    try {
      const payload = {
        word: w,
        slug: slug.trim() || undefined,
        dialect: dialect.trim() || null,
        pronunciation: pronunciation.trim() || null,
        partOfSpeech: partOfSpeech.trim() || null,
        meaning: m,
        usageExample: usageExample.trim() || null,
        usageTranslation: usageTranslation.trim() || null,
        notes: notes.trim() || null,
        status,
        tags: tags.split(",").map((t) => t.trim()).filter(Boolean),
      };
      if (mode === "create") {
        const res = await postJson<{ id: string }>("/api/admin/glossary", payload);
        toast.success("Entry created.");
        router.push(`/admin/glossary/${res.id}/edit`);
        return;
      }
      await updateEntry.mutateAsync({ id: entryId, ...payload });
      toast.success("Entry saved.");
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : err instanceof Error ? err.message : "Could not save.");
    } finally {
      setSubmitting(false);
    }
  };

  const onDelete = async () => {
    if (mode !== "edit" || !detail?.entry.canDelete) return;
    if (!window.confirm(`Delete "${detail.entry.word}"? This cannot be undone.`)) return;
    try {
      await deleteEntry.mutateAsync(entryId);
      toast.success("Entry deleted.");
      router.push("/admin/glossary");
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Could not delete.");
    }
  };

  if (mode === "edit" && isLoading) return <p className="text-sm text-muted-foreground">Loading…</p>;
  if (mode === "edit" && (error || !detail?.entry)) return <p className="text-sm text-destructive">Could not load this entry.</p>;

  return (
    <div className="w-full space-y-6">
      <header className="flex flex-wrap items-start justify-between gap-4 border-b border-base-content/10 pb-5">
        <div className="space-y-1">
          <Link href={backHref} className={cn(buttonVariants({ variant: "ghost", size: "sm" }), "mb-1 inline-flex gap-1.5 px-0")}>
            <ArrowLeft className="size-4" aria-hidden />
            Words &amp; phrases
          </Link>
          <h1 className="text-2xl font-semibold tracking-tight">{mode === "create" ? "New word or phrase" : "Edit entry"}</h1>
          <p className="text-muted-foreground">
            {mode === "create"
              ? "Add a word, phrase, or expression to the cultural glossary."
              : "Update the word's meaning, pronunciation, and usage."}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Link href={backHref} className={cn(buttonVariants({ variant: "outline" }))}>Cancel</Link>
          <button type="submit" form={formId} className={cn(buttonVariants())} disabled={submitting || !canEdit}>
            {submitting ? "Saving…" : mode === "create" ? "Create entry" : "Save entry"}
          </button>
        </div>
      </header>

      <form id={formId} onSubmit={(e) => void handleSubmit(e)} className="w-full space-y-6">
        {/* Word details */}
        <section className="rounded-xl border border-base-content/10 bg-card/60 p-4 shadow-sm sm:p-6">
          <div className="mb-4 flex items-start gap-3">
            <span className="flex size-12 shrink-0 items-center justify-center rounded-xl bg-primary/15 text-primary">
              <BookOpen className="size-6" aria-hidden />
            </span>
            <div>
              <h2 className="text-base font-semibold">Word details</h2>
              <p className="text-sm text-muted-foreground">The word or phrase, its dialect, and how to pronounce it.</p>
            </div>
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2 md:col-span-2">
              <Label htmlFor="entry-word">Word or phrase</Label>
              <Input id="entry-word" value={word} onChange={(e) => setWord(e.target.value)} placeholder="e.g. pickney" disabled={!canEdit} />
            </div>
            <div className="space-y-2 md:col-span-2">
              <Label htmlFor="entry-slug">URL slug</Label>
              <Input id="entry-slug" value={slug} onChange={(e) => setSlug(e.target.value)} placeholder="e.g. pickney" className="font-mono text-sm" disabled={!canEdit} />
              <p className="text-xs text-muted-foreground">Auto-generated from the word if left blank.</p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="entry-dialect">Dialect / language</Label>
              <Input id="entry-dialect" value={dialect} onChange={(e) => setDialect(e.target.value)} placeholder="e.g. Creolese" disabled={!canEdit} />
              <p className="text-xs text-muted-foreground">The dialect or language this word belongs to.</p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="entry-pronunciation">Pronunciation</Label>
              <Input id="entry-pronunciation" value={pronunciation} onChange={(e) => setPronunciation(e.target.value)} placeholder="e.g. PIK-nee" disabled={!canEdit} />
              <p className="text-xs text-muted-foreground">Phonetic guide in all-caps syllables.</p>
            </div>
            <div className="space-y-2 md:col-span-2">
              <Label>Part of speech</Label>
              <div className="flex flex-wrap gap-2">
                {PART_OF_SPEECH_OPTIONS.map((pos) => (
                  <button key={pos} type="button" className={chipBtn(partOfSpeech === pos)} onClick={() => setPartOfSpeech(partOfSpeech === pos ? "" : pos)} disabled={!canEdit}>
                    {pos}
                  </button>
                ))}
              </div>
              <Input
                value={partOfSpeech}
                onChange={(e) => setPartOfSpeech(e.target.value)}
                placeholder="Or type a custom part of speech…"
                disabled={!canEdit}
                className="mt-2"
              />
            </div>
          </div>
        </section>

        {/* Meaning & usage */}
        <section className="rounded-xl border border-base-content/10 bg-card/60 p-4 shadow-sm sm:p-6">
          <div className="mb-4 flex items-start gap-3">
            <span className="flex size-12 shrink-0 items-center justify-center rounded-xl bg-primary/15 text-primary">
              <FileText className="size-6" aria-hidden />
            </span>
            <div>
              <h2 className="text-base font-semibold">Meaning &amp; usage</h2>
              <p className="text-sm text-muted-foreground">Definition, an example sentence, and any notes.</p>
            </div>
          </div>
          <div className="grid gap-4">
            <div className="space-y-2">
              <Label htmlFor="entry-meaning">Meaning</Label>
              <textarea
                id="entry-meaning"
                value={meaning}
                onChange={(e) => setMeaning(e.target.value)}
                rows={3}
                disabled={!canEdit}
                className="flex min-h-[80px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                placeholder="e.g. A child."
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="entry-usage">Usage example</Label>
              <textarea
                id="entry-usage"
                value={usageExample}
                onChange={(e) => setUsageExample(e.target.value)}
                rows={2}
                disabled={!canEdit}
                className="flex min-h-[60px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                placeholder="e.g. The pickney dem playing in the yard."
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="entry-translation">Usage translation</Label>
              <textarea
                id="entry-translation"
                value={usageTranslation}
                onChange={(e) => setUsageTranslation(e.target.value)}
                rows={2}
                disabled={!canEdit}
                className="flex min-h-[60px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                placeholder="e.g. The kids are playing in the yard."
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="entry-notes">Notes</Label>
              <textarea
                id="entry-notes"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={2}
                disabled={!canEdit}
                className="flex min-h-[60px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                placeholder="Historical context, regional variations, etymology…"
              />
            </div>
          </div>
        </section>

        {/* Publishing */}
        <section className="rounded-xl border border-base-content/10 bg-card/60 p-4 shadow-sm sm:p-6">
          <div className="mb-4">
            <h2 className="text-base font-semibold">Publishing</h2>
            <p className="text-sm text-muted-foreground">Status and tags for organization.</p>
          </div>
          <div className="space-y-4">
            <div>
              <Label className="mb-2 block">Status</Label>
              <div className="flex flex-wrap gap-2">
                {STATUS_OPTIONS.map((opt) => (
                  <button key={opt.value} type="button" className={chipBtn(status === opt.value)} onClick={() => setStatus(opt.value)} disabled={!canEdit}>
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="entry-tags">Tags</Label>
              <Input id="entry-tags" value={tags} onChange={(e) => setTags(e.target.value)} placeholder="e.g. creolese, everyday speech" disabled={!canEdit} />
              <p className="text-xs text-muted-foreground">Comma-separated keywords for organization and search.</p>
            </div>
          </div>
        </section>

        {mode === "edit" && detail?.entry.canDelete ? (
          <section className="rounded-xl border border-destructive/25 bg-destructive/[0.04] p-4 shadow-sm sm:p-6">
            <div className="mb-4 flex items-start gap-3">
              <span className="flex size-12 shrink-0 items-center justify-center rounded-xl bg-destructive/15 text-destructive">
                <Trash2 className="size-6" aria-hidden />
              </span>
              <div>
                <h2 className="text-base font-semibold">Danger zone</h2>
                <p className="text-sm text-muted-foreground">Permanently removes this word from the glossary.</p>
              </div>
            </div>
            <button type="button" className={cn(buttonVariants({ variant: "destructive" }))} onClick={() => void onDelete()} disabled={deleteEntry.isPending}>
              {deleteEntry.isPending ? "Deleting…" : "Delete entry"}
            </button>
          </section>
        ) : null}
      </form>
    </div>
  );
}
