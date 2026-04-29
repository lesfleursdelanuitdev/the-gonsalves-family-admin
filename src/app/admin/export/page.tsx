import { Download } from "lucide-react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { ExportDownloadPanel } from "@/components/admin/ExportDownloadPanel";

export default function AdminExportPage() {
  return (
    <div className="mx-auto flex w-full max-w-4xl flex-col gap-5 p-4 sm:p-6">
      <div>
        <h1 className="flex items-center gap-2 text-2xl font-semibold tracking-tight">
          <span className="inline-flex size-8 items-center justify-center rounded-md bg-primary/15 text-primary">
            <Download className="size-5 shrink-0" aria-hidden />
          </span>
          Export tree
        </h1>
        <p className="mt-1 max-w-3xl text-sm text-muted-foreground">
          Download the configured admin tree as GEDCOM, JSON, or CSV, or generate one ZIP bundle with
          exports, media, and README.
        </p>
      </div>

      <Card className="border-base-content/10 bg-card/80">
        <CardHeader className="pb-3">
          <CardTitle>1. Choose what to export</CardTitle>
          <CardDescription>Pick a format and file name for your export.</CardDescription>
        </CardHeader>
        <CardContent>
          <ExportDownloadPanel />
        </CardContent>
      </Card>

      <details className="group rounded-xl border border-base-content/10 bg-base-content/[0.015] p-4">
        <summary className="cursor-pointer list-none text-sm font-medium text-foreground">
          <span className="inline-flex items-center gap-2">
            <span className="inline-flex size-5 items-center justify-center rounded-full border border-base-content/20 text-[11px] text-muted-foreground">
              2
            </span>
            Technical details
          </span>
          <span className="mt-1 block text-xs font-normal text-muted-foreground">
            API and data information for developers.
          </span>
        </summary>
        <div className="mt-3 space-y-2 border-t border-base-content/10 pt-3 text-xs text-muted-foreground">
          <p>
            The Next.js server calls <code className="text-[11px]">LIB_API_URL</code> (default{" "}
            <code className="text-[11px]">http://127.0.0.1:8092</code>) with a POST to{" "}
            <code className="text-[11px]">/api/v1/export</code>. Run{" "}
            <code className="text-[11px]">ligneous-gedcom-lib-api</code> in your environment or set{" "}
            <code className="text-[11px]">LIB_API_URL</code> to a reachable instance.
          </p>
          <p>
            Tree data is scoped by the same <code className="text-[11px]">ADMIN_TREE_ID</code> /{" "}
            <code className="text-[11px]">ADMIN_TREE_FILE_ID</code> settings used in the admin app.
          </p>
        </div>
      </details>
    </div>
  );
}
