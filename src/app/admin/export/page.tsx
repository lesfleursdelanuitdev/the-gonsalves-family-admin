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
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-6 p-4 sm:p-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight flex items-center gap-2">
          <Download className="size-7 shrink-0 opacity-90" aria-hidden />
          Export tree
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Download the configured admin tree in GEDCOM 5.5, JSON, or CSV — or a single ZIP that also
          includes local media and a README. Exports are produced by the ligneous-gedcom-lib API.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Download</CardTitle>
          <CardDescription>
            Optional basename for the file (letters, numbers, dots, dashes, underscores). The correct
            extension is added automatically.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ExportDownloadPanel />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Requirements</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm text-muted-foreground">
          <p>
            The Next.js server calls <code className="text-xs">LIB_API_URL</code> (default{" "}
            <code className="text-xs">http://127.0.0.1:8092</code>) with a POST to{" "}
            <code className="text-xs">/api/v1/export</code>. Run{" "}
            <code className="text-xs">ligneous-gedcom-lib-api</code> in your environment or set{" "}
            <code className="text-xs">LIB_API_URL</code> to a reachable instance.
          </p>
          <p>
            Tree data is scoped by the same <code className="text-xs">ADMIN_TREE_ID</code> /{" "}
            <code className="text-xs">ADMIN_TREE_FILE_ID</code> settings as the rest of the admin
            app.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
