import { FileCheck } from "lucide-react";
import { GedcomValidatorPanel } from "@/components/admin/GedcomValidatorPanel";

export default function AdminGedcomValidatorPage() {
  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-5 p-4 sm:p-6">
      <div>
        <h1 className="flex items-center gap-2 text-2xl font-semibold tracking-tight">
          <span className="inline-flex size-8 items-center justify-center rounded-md bg-primary/15 text-primary">
            <FileCheck className="size-5 shrink-0" aria-hidden />
          </span>
          GEDCOM validator
        </h1>
        <p className="mt-1 max-w-3xl text-sm text-muted-foreground">
          Run the same structural checks as <span className="font-medium text-foreground/90">ligneous-gedcom-lib</span>{" "}
          on an uploaded file or on the GEDCOM view of your configured admin tree (requires{" "}
          <code className="rounded bg-base-content/10 px-1 py-0.5 text-[11px]">LIB_API_URL</code>).
        </p>
        <p className="mt-2 max-w-3xl text-xs text-muted-foreground">
          Errors block “valid”; warnings and hints are listed for review. The lib API uses default{" "}
          <code className="rounded bg-base-content/10 px-1 py-0.5 text-[10px]">Validate()</code> (date-consistency rules are
          not enabled in that response today).
        </p>
      </div>

      <GedcomValidatorPanel />
    </div>
  );
}
