"use client";

import Link from "next/link";
import { NoteContentMarkdown } from "@/components/admin/NoteContentMarkdown";

/** Note block for entity detail pages (individual / family / event): xref + rendered Markdown. */
export function EmbeddedNoteCard({
  noteId,
  xref,
  content,
}: {
  noteId: string;
  xref: string;
  content: string;
}) {
  const xrefLabel = xref.trim() || "Note";

  return (
    <div className="rounded-box border border-base-content/[0.08] bg-base-content/[0.035] p-3 text-sm shadow-sm shadow-black/15">
      <p className="font-mono text-xs">
        <Link href={`/admin/notes/${noteId}`} className="link link-primary">
          {xrefLabel}
        </Link>
      </p>
      <div className="mt-2 min-w-0">
        <NoteContentMarkdown markdown={content} />
      </div>
    </div>
  );
}
