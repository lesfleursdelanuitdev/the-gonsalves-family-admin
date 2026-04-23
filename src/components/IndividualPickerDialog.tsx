"use client";

import { useState, useEffect, useRef } from "react";
import { X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { useAdminIndividuals, type AdminIndividualListItem } from "@/hooks/useAdminIndividuals";
import { useCreateUserLink } from "@/hooks/useAdminUsers";
import { ApiError } from "@/lib/infra/api";
import { formatDisplayNameFromNameForms } from "@/lib/gedcom/display-name";

interface IndividualPickerDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  userId: string;
  existingXrefs: string[];
  onLinked: () => void;
}

export function IndividualPickerDialog({
  open,
  onOpenChange,
  userId,
  existingXrefs,
  onLinked,
}: IndividualPickerDialogProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const [search, setSearch] = useState("");

  const { data, isLoading } = useAdminIndividuals({
    q: search.trim() || undefined,
    limit: 50,
    offset: 0,
  });
  const createLink = useCreateUserLink();

  useEffect(() => {
    const el = dialogRef.current;
    if (!el) return;
    if (open) {
      setSearch("");
      createLink.reset();
      el.showModal();
    } else el.close();
  }, [open]);

  const handleDialogClick = (e: React.MouseEvent<HTMLDialogElement>) => {
    if (createLink.isPending) return;
    if (contentRef.current && !contentRef.current.contains(e.target as Node))
      onOpenChange(false);
  };

  const individuals = (data?.individuals ?? []) as AdminIndividualListItem[];
  const filtered = individuals.filter(
    (i) => !existingXrefs.includes(i.xref),
  );
  const alreadyLinked = individuals.filter((i) =>
    existingXrefs.includes(i.xref),
  );

  const handleSelect = (xref: string) => {
    createLink.mutate(
      { userId, individualXref: xref },
      { onSuccess: () => onLinked() },
    );
  };

  const handleContentClick = (e: React.MouseEvent) => e.stopPropagation();

  return (
    <dialog
      ref={dialogRef}
      onCancel={() => onOpenChange(false)}
      onClick={handleDialogClick}
      className="fixed inset-0 z-[60] m-0 flex h-full w-full max-h-none max-w-none items-center justify-center border-0 bg-transparent p-0 shadow-none backdrop:bg-black/50"
    >
      <div
        ref={contentRef}
        onClick={handleContentClick}
        className="relative w-full max-w-md max-h-[85vh] overflow-auto rounded-xl border border-border bg-background shadow-lg"
      >
        <div className="sticky top-0 z-10 flex items-center justify-between border-b border-border bg-background px-4 py-2">
          <h3 className="text-base font-semibold text-foreground">Link to individual</h3>
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            onClick={() => onOpenChange(false)}
            aria-label="Close"
          >
            <X className="size-4" />
          </Button>
        </div>
      <Card className="border-0 shadow-none rounded-t-none">
        <CardHeader className="pb-2">
          <CardTitle className="sr-only">Link to individual</CardTitle>
          <CardDescription>
            Search by name or XREF, then select a person to link to this user.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="picker-search">Search</Label>
            <Input
              id="picker-search"
              placeholder="Name or XREF (e.g. I1)"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              autoFocus
            />
          </div>

          {createLink.error && (
            <p className="text-sm text-destructive">
              {createLink.error.message}
              {createLink.error instanceof ApiError &&
                ` (${createLink.error.status})`}
            </p>
          )}

          <div className="max-h-64 overflow-y-auto rounded-lg border border-border">
            {isLoading ? (
              <div className="p-4 text-sm text-muted-foreground">
                Searching…
              </div>
            ) : filtered.length === 0 && alreadyLinked.length === 0 ? (
              <div className="p-4 text-sm text-muted-foreground">
                {search.trim()
                  ? "No individuals found. Try a different search."
                  : "Type to search individuals."}
              </div>
            ) : (
              <ul className="divide-y divide-border">
                {filtered.map((ind) => (
                  <li key={ind.id}>
                    <button
                      type="button"
                      className="flex w-full items-center justify-between px-3 py-2 text-left text-sm hover:bg-muted/50 disabled:opacity-50"
                      onClick={() => handleSelect(ind.xref)}
                      disabled={createLink.isPending}
                    >
                      <span className="font-mono text-muted-foreground">
                        {ind.xref}
                      </span>
                      <span>
                        {formatDisplayNameFromNameForms(ind.individualNameForms, ind.fullName) || "—"}
                      </span>
                    </button>
                  </li>
                ))}
                {alreadyLinked.map((ind) => (
                  <li
                    key={ind.id}
                    className="flex items-center justify-between px-3 py-2 text-sm text-muted-foreground"
                  >
                    <span className="font-mono">{ind.xref}</span>
                    <span>
                      {formatDisplayNameFromNameForms(ind.individualNameForms, ind.fullName) || "—"} (already
                      linked)
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className="flex justify-end">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={createLink.isPending}
            >
              Cancel
            </Button>
          </div>
        </CardContent>
      </Card>
      </div>
    </dialog>
  );
}
