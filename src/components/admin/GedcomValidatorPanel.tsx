"use client";

import { useCallback, useState } from "react";
import { FileCheck, Loader2, TreeDeciduous, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { cn } from "@/lib/utils";
import type { LibApiValidationError, LibApiValidateResponse } from "@/lib/admin/lib-api-validate";
import { toast } from "sonner";

type ValidatePayload = LibApiValidateResponse & {
  source: "upload" | "database";
  filename?: string;
  fileUuid?: string;
};

function severityLabel(s: number): string {
  if (s === 2) return "Error";
  if (s === 1) return "Warning";
  return "Hint";
}

function severityClass(s: number): string {
  if (s === 2) return "text-destructive font-medium";
  if (s === 1) return "text-amber-600 dark:text-amber-400";
  return "text-muted-foreground";
}

export function GedcomValidatorPanel() {
  const [busy, setBusy] = useState<"upload" | "tree" | null>(null);
  const [result, setResult] = useState<ValidatePayload | null>(null);

  const onValidateTree = useCallback(async () => {
    setBusy("tree");
    setResult(null);
    try {
      const res = await fetch("/api/admin/gedcom/validate/tree", { method: "POST" });
      const data = (await res.json()) as ValidatePayload & { error?: string };
      if (!res.ok) {
        throw new Error(data.error ?? `HTTP ${res.status}`);
      }
      setResult(data);
      if (data.valid) {
        toast.success("Tree passed validation (no blocking errors).");
      } else {
        toast.error("Validation reported errors — see table below.");
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      toast.error(msg);
    } finally {
      setBusy(null);
    }
  }, []);

  const onValidateFile = useCallback(async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const form = e.currentTarget;
    const input = form.elements.namedItem("gedcom-file") as HTMLInputElement | null;
    const file = input?.files?.[0];
    if (!file) {
      toast.error("Choose a GEDCOM file first.");
      return;
    }
    setBusy("upload");
    setResult(null);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const res = await fetch("/api/admin/gedcom/validate", { method: "POST", body: fd });
      const data = (await res.json()) as ValidatePayload & { error?: string };
      if (!res.ok) {
        throw new Error(data.error ?? `HTTP ${res.status}`);
      }
      setResult(data);
      if (data.valid) {
        toast.success("File passed validation (no blocking errors).");
      } else {
        toast.error("Validation reported errors — see table below.");
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      toast.error(msg);
    } finally {
      setBusy(null);
    }
  }, []);

  return (
    <div className="space-y-6">
      <div className="grid gap-6 lg:grid-cols-2">
        <Card className="border-base-content/10 bg-card/80">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Upload className="size-4 text-primary" aria-hidden />
              Upload a GEDCOM file
            </CardTitle>
            <CardDescription>
              Sends the file to <span className="font-mono text-[11px]">ligneous-gedcom-lib-api</span>{" "}
              <span className="font-mono text-[11px]">POST /api/v1/validate</span> (parse + structural checks).
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={onValidateFile} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="gedcom-file">File</Label>
                <Input
                  id="gedcom-file"
                  name="gedcom-file"
                  type="file"
                  accept=".ged,.GED,.txt,text/plain"
                  disabled={busy !== null}
                />
              </div>
              <Button type="submit" disabled={busy !== null}>
                {busy === "upload" ? (
                  <>
                    <Loader2 className="mr-2 size-4 animate-spin" aria-hidden />
                    Validating…
                  </>
                ) : (
                  <>
                    <FileCheck className="mr-2 size-4" aria-hidden />
                    Validate upload
                  </>
                )}
              </Button>
            </form>
          </CardContent>
        </Card>

        <Card className="border-base-content/10 bg-card/80">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <TreeDeciduous className="size-4 text-primary" aria-hidden />
              Configured admin tree
            </CardTitle>
            <CardDescription>
              Builds the same enriched payload as export, generates GEDCOM via the lib API, then validates that
              output — so results match what you would download from{" "}
              <span className="font-medium text-foreground/90">Export</span>.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button type="button" onClick={onValidateTree} disabled={busy !== null}>
              {busy === "tree" ? (
                <>
                  <Loader2 className="mr-2 size-4 animate-spin" aria-hidden />
                  Validating…
                </>
              ) : (
                <>
                  <FileCheck className="mr-2 size-4" aria-hidden />
                  Validate database tree
                </>
              )}
            </Button>
          </CardContent>
        </Card>
      </div>

      {result ? (
        <Card className="border-base-content/10 bg-card/80">
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Results</CardTitle>
            <CardDescription>
              Source:{" "}
              <span className="font-medium text-foreground/90">
                {result.source === "database" ? "Database (exported GEDCOM)" : `Upload${result.filename ? ` — ${result.filename}` : ""}`}
              </span>
              {result.fileUuid ? (
                <>
                  {" "}
                  · file UUID <span className="font-mono text-[11px]">{result.fileUuid}</span>
                </>
              ) : null}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex flex-wrap gap-3 text-sm">
              <span
                className={cn(
                  "rounded-md border px-2 py-1 font-medium",
                  result.valid ? "border-success/40 bg-success/10 text-success" : "border-destructive/40 bg-destructive/10 text-destructive",
                )}
              >
                {result.valid ? "Valid (no errors)" : "Has errors"}
              </span>
              <span className="rounded-md border border-base-content/15 bg-base-content/[0.04] px-2 py-1">
                Errors: {result.counts?.errors ?? 0}
              </span>
              <span className="rounded-md border border-base-content/15 bg-base-content/[0.04] px-2 py-1">
                Warnings: {result.counts?.warnings ?? 0}
              </span>
              <span className="rounded-md border border-base-content/15 bg-base-content/[0.04] px-2 py-1">
                Hints: {result.counts?.hints ?? 0}
              </span>
            </div>

            {(result.errors?.length ?? 0) === 0 ? (
              <p className="text-sm text-muted-foreground">No findings to list.</p>
            ) : (
              <div className="max-h-[min(60vh,32rem)] overflow-auto rounded-lg border border-base-content/10">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-[100px]">Severity</TableHead>
                      <TableHead className="w-[160px]">Code</TableHead>
                      <TableHead className="w-[120px]">Xref</TableHead>
                      <TableHead>Message</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {(result.errors ?? []).map((row: LibApiValidationError, i: number) => (
                      <TableRow key={`${row.Code}-${i}`}>
                        <TableCell className={cn("align-top text-xs", severityClass(row.Severity))}>
                          {severityLabel(row.Severity)}
                        </TableCell>
                        <TableCell className="align-top font-mono text-xs">{row.Code}</TableCell>
                        <TableCell className="align-top font-mono text-xs">{row.Xref || "—"}</TableCell>
                        <TableCell className="align-top text-sm">{row.Message}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}
