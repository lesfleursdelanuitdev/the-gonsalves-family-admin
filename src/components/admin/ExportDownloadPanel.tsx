"use client";

import { useMemo, useState } from "react";
import { Archive, CheckCircle2, FileJson, FileSpreadsheet, FileText } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { sanitizeExportBasename } from "@/lib/admin/export-filename";
import { toast } from "sonner";

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
  const [selectedFormat, setSelectedFormat] = useState<Format>("gedcom");
  const [includeBundle, setIncludeBundle] = useState(false);
  const [activeDownload, setActiveDownload] = useState<Format | "bundle" | null>(null);

  const formatMeta: Record<Format, { title: string; subtitle: string; icon: typeof FileText }> = {
    gedcom: { title: "GEDCOM (.ged)", subtitle: "Best for genealogy software.", icon: FileText },
    json: { title: "JSON", subtitle: "For developers and integrations.", icon: FileJson },
    csv: { title: "CSV", subtitle: "For spreadsheets and analysis.", icon: FileSpreadsheet },
  };
  const safeName = useMemo(() => sanitizeExportBasename(basename, "tree-export"), [basename]);
  const primaryHref = includeBundle ? bundleHref(basename) : exportHref(selectedFormat, basename);
  const SelectedFormatIcon = formatMeta[selectedFormat]?.icon ?? FileText;

  const onDownloadStart = (kind: Format | "bundle") => {
    setActiveDownload(kind);
    window.setTimeout(() => setActiveDownload((cur) => (cur === kind ? null : cur)), 1200);
    toast.success("Download started");
  };

  return (
    <div className="space-y-5">
      <div className="rounded-xl border border-base-content/10 bg-base-content/[0.02] p-4 sm:p-5">
        <p className="text-sm font-semibold text-foreground">Export your data</p>
        <p className="mt-1 text-sm text-muted-foreground">
          Choose a format and download a clean export of the current admin tree.
        </p>
      </div>

      <div className="space-y-2">
        <Label htmlFor="export-basename">File basename (optional)</Label>
        <Input
          id="export-basename"
          value={basename}
          onChange={(e) => setBasename(e.target.value)}
          placeholder="tree-export"
          autoComplete="off"
        />
        <p className="text-xs text-muted-foreground">
          Only letters, numbers, dots, dashes, and underscores. Extension is added automatically.
          {safeName !== basename.trim() && basename.trim() !== "" ? (
            <>
              {" "}
              Download name: <span className="font-mono">{safeName}</span>.
            </>
          ) : null}
        </p>
      </div>

      <div className="space-y-3 rounded-xl border border-base-content/10 bg-card/60 p-4 sm:p-5">
        <p className="text-sm font-medium text-foreground">Export format</p>
        <div className="grid gap-2 sm:grid-cols-3">
          {(Object.keys(formatMeta) as Format[]).map((fmt) => {
            const meta = formatMeta[fmt];
            const Icon = meta.icon;
            const selected = selectedFormat === fmt;
            return (
              <button
                key={fmt}
                type="button"
                className={cn(
                  "group flex w-full items-start gap-2 rounded-lg border px-3 py-2.5 text-left transition",
                  selected
                    ? "border-primary/40 bg-primary/10 text-foreground ring-1 ring-primary/30"
                    : "border-base-content/10 bg-base-content/[0.01] text-muted-foreground hover:border-base-content/25 hover:bg-base-content/[0.04] hover:text-foreground",
                )}
                aria-pressed={selected}
                onClick={() => setSelectedFormat(fmt)}
              >
                <Icon className={cn("mt-0.5 size-4 shrink-0", selected ? "text-primary" : "text-muted-foreground")} />
                <span className="min-w-0">
                  <span className="flex items-center gap-1.5 text-sm font-semibold leading-tight">
                    {meta.title}
                    {selected ? <CheckCircle2 className="size-3.5 text-primary" aria-hidden /> : null}
                  </span>
                  <span className="mt-1 block text-xs text-muted-foreground">{meta.subtitle}</span>
                </span>
              </button>
            );
          })}
        </div>
      </div>

      <div className="rounded-xl border border-base-content/10 bg-card/60 p-4 sm:p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-sm font-medium text-foreground">Full bundle (.zip)</p>
            <p className="mt-1 text-xs text-muted-foreground">
              Includes GEDCOM, JSON, CSV, a README, and local media files (external URLs listed in README).
            </p>
          </div>
          <label className="inline-flex cursor-pointer items-center gap-2">
            <span className="text-xs text-muted-foreground">Include full bundle</span>
            <input
              type="checkbox"
              className="toggle toggle-sm"
              checked={includeBundle}
              onChange={(e) => setIncludeBundle(e.target.checked)}
            />
          </label>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <a
          href={primaryHref}
          className={cn(buttonVariants({ variant: "default" }), "inline-flex items-center gap-2")}
          onClick={() => onDownloadStart(includeBundle ? "bundle" : selectedFormat)}
        >
          {includeBundle ? <Archive className="size-4" /> : <SelectedFormatIcon className="size-4" />}
          {includeBundle ? "Download full bundle" : `Download ${formatMeta[selectedFormat].title}`}
        </a>
        {!includeBundle ? (
          <>
            {selectedFormat !== "json" ? (
              <a
                href={exportHref("json", basename)}
                className={cn(buttonVariants({ variant: "ghost" }), "inline-flex items-center gap-2")}
                onClick={() => onDownloadStart("json")}
              >
                <FileJson className="size-4" />
                Download JSON
              </a>
            ) : null}
            {selectedFormat !== "csv" ? (
              <a
                href={exportHref("csv", basename)}
                className={cn(buttonVariants({ variant: "ghost" }), "inline-flex items-center gap-2")}
                onClick={() => onDownloadStart("csv")}
              >
                <FileSpreadsheet className="size-4" />
                Download CSV
              </a>
            ) : null}
          </>
        ) : null}
        {activeDownload ? (
          <span className="text-xs text-muted-foreground">Preparing your download…</span>
        ) : (
          <span className="text-xs text-muted-foreground">Your export is generated securely on the server.</span>
        )}
      </div>
    </div>
  );
}
