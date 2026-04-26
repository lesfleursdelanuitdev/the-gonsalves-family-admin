"use client";

import { useMemo, useState } from "react";
import { Archive, FileJson, FileSpreadsheet, FileText } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { sanitizeExportBasename } from "@/lib/admin/export-filename";

type Format = "gedcom" | "json" | "csv";

function exportHref(format: Format, basename: string): string {
  const filename = sanitizeExportBasename(basename, "tree-export");
  const q = new URLSearchParams({ format, filename });
  return `/api/admin/export?${q.toString()}`;
}

function bundleHref(basename: string): string {
  const filename = sanitizeExportBasename(basename, "tree-export");
  const q = new URLSearchParams({ filename });
  return `/api/admin/export/bundle?${q.toString()}`;
}

export function ExportDownloadPanel() {
  const [basename, setBasename] = useState("tree-export");

  const safeName = useMemo(() => sanitizeExportBasename(basename, "tree-export"), [basename]);

  return (
    <div className="flex flex-col gap-4">
      <div className="space-y-2">
        <Label htmlFor="export-basename">File basename</Label>
        <Input
          id="export-basename"
          value={basename}
          onChange={(e) => setBasename(e.target.value)}
          placeholder="tree-export"
          autoComplete="off"
        />
        {safeName !== basename.trim() && basename.trim() !== "" ? (
          <p className="text-xs text-muted-foreground">
            Will download as <span className="font-mono">{safeName}</span> (sanitized).
          </p>
        ) : null}
      </div>
      <div className="flex flex-wrap gap-2">
        <a
          href={exportHref("gedcom", basename)}
          className={cn(buttonVariants({ variant: "default" }), "inline-flex items-center gap-2")}
        >
          <FileText className="size-4" />
          GEDCOM (.ged)
        </a>
        <a
          href={exportHref("json", basename)}
          className={cn(buttonVariants({ variant: "secondary" }), "inline-flex items-center gap-2")}
        >
          <FileJson className="size-4" />
          JSON
        </a>
        <a
          href={exportHref("csv", basename)}
          className={cn(buttonVariants({ variant: "secondary" }), "inline-flex items-center gap-2")}
        >
          <FileSpreadsheet className="size-4" />
          CSV
        </a>
        <a
          href={bundleHref(basename)}
          className={cn(buttonVariants({ variant: "outline" }), "inline-flex items-center gap-2")}
        >
          <Archive className="size-4" />
          Full bundle (.zip)
        </a>
      </div>
      <p className="text-xs text-muted-foreground max-w-xl">
        The ZIP includes the three exports, a README describing the archive, and copies of media files
        stored under <span className="font-mono">/uploads/gedcom-admin/</span> (external URLs are listed in
        the README only).
      </p>
    </div>
  );
}
