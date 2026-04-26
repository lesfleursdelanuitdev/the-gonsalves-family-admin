"use client";

import { X } from "lucide-react";

export function MediaEditorPill({
  label,
  onRemove,
  disabled,
}: {
  label: string;
  onRemove: () => void;
  disabled?: boolean;
}) {
  return (
    <span className="inline-flex max-w-full items-center gap-1 rounded-full border border-base-content/15 bg-base-200/60 px-2.5 py-0.5 text-xs font-medium text-base-content">
      <span className="truncate">{label}</span>
      <button
        type="button"
        className="rounded-full p-0.5 text-base-content/60 hover:bg-base-300/80 hover:text-base-content disabled:opacity-40"
        onClick={onRemove}
        disabled={disabled}
        aria-label={`Remove ${label}`}
      >
        <X className="size-3.5 shrink-0" />
      </button>
    </span>
  );
}
