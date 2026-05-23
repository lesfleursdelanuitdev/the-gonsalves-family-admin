"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { selectClassName } from "@/components/data-viewer/constants";

export type CustomTypeFormValues = {
  tag: string;
  label: string;
  ownerScope: "INDI" | "FAM" | "BOTH";
  color: string;
  sortOrder: number;
};

type CustomTypeFormProps = {
  backHref: string;
  backLabel: string;
  initialValues?: Partial<CustomTypeFormValues>;
  isSubmitting: boolean;
  submitLabel: string;
  onSubmit: (values: CustomTypeFormValues) => void;
  disableTag?: boolean;
};

const DEFAULT_VALUES: CustomTypeFormValues = {
  tag: "",
  label: "",
  ownerScope: "INDI",
  color: "#6B7280",
  sortOrder: 0,
};

export function CustomTypeForm({
  backHref,
  backLabel,
  initialValues,
  isSubmitting,
  submitLabel,
  onSubmit,
  disableTag = false,
}: CustomTypeFormProps) {
  const merged = { ...DEFAULT_VALUES, ...initialValues };
  const [tag, setTag] = useState(merged.tag);
  const [label, setLabel] = useState(merged.label);
  const [ownerScope, setOwnerScope] = useState<"INDI" | "FAM" | "BOTH">(merged.ownerScope);
  const [color, setColor] = useState(merged.color);
  const [sortOrder, setSortOrder] = useState(String(merged.sortOrder));

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit({
      tag: tag.trim().toUpperCase(),
      label: label.trim(),
      ownerScope,
      color: /^#[0-9A-Fa-f]{6}$/.test(color) ? color : "#6B7280",
      sortOrder: Number.isFinite(Number(sortOrder)) ? Math.trunc(Number(sortOrder)) : 0,
    });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-8">
      <Link
        href={backHref}
        className={cn(buttonVariants({ variant: "ghost", size: "sm" }), "gap-1.5")}
      >
        <ArrowLeft className="size-4" />
        {backLabel}
      </Link>

      <section className="space-y-4 rounded-lg border border-border bg-card p-5">
        <h2 className="text-base font-semibold">Type details</h2>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="ct-tag">GEDCOM tag</Label>
            <Input
              id="ct-tag"
              value={tag}
              onChange={(e) => setTag(e.target.value.toUpperCase())}
              placeholder="e.g. EDUC"
              className="font-mono uppercase"
              disabled={disableTag}
              required
            />
            <p className="text-xs text-muted-foreground">
              Short uppercase identifier. Standard tags (OCCU, EDUC, etc.) are already included.
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="ct-label">Label</Label>
            <Input
              id="ct-label"
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              placeholder="e.g. Military service"
              required
            />
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-3">
          <div className="space-y-2">
            <Label htmlFor="ct-scope">Owner scope</Label>
            <select
              id="ct-scope"
              className={selectClassName}
              value={ownerScope}
              onChange={(e) => setOwnerScope(e.target.value as "INDI" | "FAM" | "BOTH")}
            >
              <option value="INDI">Individual (INDI)</option>
              <option value="FAM">Family (FAM)</option>
              <option value="BOTH">Both</option>
            </select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="ct-color">Color</Label>
            <div className="flex items-center gap-2">
              <input
                type="color"
                id="ct-color"
                value={color}
                onChange={(e) => setColor(e.target.value)}
                className="h-9 w-12 cursor-pointer rounded border border-input bg-background p-0.5"
              />
              <Input
                value={color}
                onChange={(e) => setColor(e.target.value)}
                placeholder="#6B7280"
                className="font-mono"
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="ct-sort">Sort order</Label>
            <Input
              id="ct-sort"
              type="number"
              value={sortOrder}
              onChange={(e) => setSortOrder(e.target.value)}
              placeholder="0"
            />
          </div>
        </div>
      </section>

      <div className="flex items-center gap-3">
        <Button type="submit" disabled={isSubmitting}>
          {isSubmitting ? "Saving…" : submitLabel}
        </Button>
        <Link href={backHref} className={cn(buttonVariants({ variant: "ghost" }))}>
          Cancel
        </Link>
      </div>
    </form>
  );
}
