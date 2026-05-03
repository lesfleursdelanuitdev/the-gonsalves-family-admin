"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { Pencil, CircleHelp } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useAdminOpenQuestion } from "@/hooks/useAdminOpenQuestions";
import { DetailPageShell } from "@/components/admin/DetailPageShell";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { OpenQuestionStatusBadge } from "@/components/admin/OpenQuestionStatusBadge";
import { summarizeOpenQuestionLinks } from "@/lib/admin/open-question-display";
import { routeDynamicId } from "@/lib/navigation/route-dynamic-segment";

export default function AdminOpenQuestionDetailPage() {
  const params = useParams();
  const id = routeDynamicId(params);
  const { data, isLoading, error } = useAdminOpenQuestion(id ?? "");
  const oq = data?.openQuestion as Record<string, unknown> | undefined;

  if (!id) {
    return (
      <div className="mx-auto max-w-3xl space-y-4 pb-20">
        <Link href="/admin/open-questions" className={cn(buttonVariants({ variant: "ghost", size: "sm" }))}>
          Open Questions
        </Link>
        <p className="text-sm text-muted-foreground">Missing id.</p>
      </div>
    );
  }

  return (
    <DetailPageShell
      backHref="/admin/open-questions"
      backLabel="Open Questions"
      isLoading={Boolean(id) && isLoading}
      error={error}
      data={oq}
      notFoundMessage="Could not load this open question."
    >
      <header className="flex flex-wrap items-start justify-between gap-3 border-b border-base-content/[0.08] pb-6">
        <h1 className="flex min-w-0 items-start gap-3 text-2xl font-bold tracking-tight text-base-content">
          <CircleHelp className="mt-1 size-7 shrink-0 text-primary" aria-hidden />
          <span className="min-w-0 leading-tight">{String(oq?.question ?? "Open question")}</span>
        </h1>
        <Link
          href={`/admin/open-questions/${id}/edit`}
          className={cn(buttonVariants({ variant: "outline", size: "sm" }), "inline-flex gap-1.5")}
        >
          <Pencil className="size-3.5" aria-hidden />
          Edit
        </Link>
      </header>

      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Status</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <OpenQuestionStatusBadge status={String(oq?.status ?? "open")} />
            {oq?.resolvedAt ? (
              <p className="text-muted-foreground">
                Resolved {new Date(String(oq.resolvedAt)).toLocaleString()}
              </p>
            ) : null}
            {oq?.resolvedBy ? (
              <p className="text-muted-foreground">
                By{" "}
                {String(
                  (oq.resolvedBy as { name?: string | null; username?: string }).name?.trim() ||
                    (oq.resolvedBy as { username?: string }).username ||
                    "",
                )}
              </p>
            ) : null}
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Linked records</CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground">
            {oq ? summarizeOpenQuestionLinks(oq) : "—"}
          </CardContent>
        </Card>
      </div>

      {oq?.details ? (
        <Card className="mt-6">
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Details</CardTitle>
          </CardHeader>
          <CardContent className="whitespace-pre-wrap text-sm">{String(oq.details)}</CardContent>
        </Card>
      ) : null}

      {String(oq?.resolution ?? "").trim() ? (
        <Card className="mt-6">
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Resolution</CardTitle>
          </CardHeader>
          <CardContent className="whitespace-pre-wrap text-sm">{String(oq?.resolution)}</CardContent>
        </Card>
      ) : null}
    </DetailPageShell>
  );
}
