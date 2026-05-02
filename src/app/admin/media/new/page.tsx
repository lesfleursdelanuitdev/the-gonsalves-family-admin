"use client";

import { Suspense, useMemo } from "react";
import { useSearchParams } from "next/navigation";
import { NoteEditorPageLayout } from "@/components/admin/NoteEditorPageLayout";
import { MediaEditorForm } from "@/components/admin/MediaEditorForm";

function sanitizeReturnTo(raw: string | null): string | undefined {
  if (raw == null || raw === "") return undefined;
  let t: string;
  try {
    t = decodeURIComponent(raw).trim();
  } catch {
    return undefined;
  }
  if (!t.startsWith("/admin/")) return undefined;
  if (t.includes("://")) return undefined;
  if (t.includes("//")) return undefined;
  return t;
}

function AdminMediaNewPageInner() {
  const searchParams = useSearchParams();
  const qs = searchParams.toString();

  const { prefillIndividuals, prefillFamilies, contextReturnHref, backHref, backLabel, initialCreateScope } = useMemo(() => {
    const sp = new URLSearchParams(qs);
    const returnTo = sanitizeReturnTo(sp.get("returnTo"));
    const indId = sp.get("individualId")?.trim();
    const indLabel = sp.get("individualLabel")?.trim() || "Individual";
    const prefillInd =
      indId != null && indId !== ""
        ? [{ individualId: indId, label: indLabel }]
        : undefined;
    const famId = sp.get("familyId")?.trim();
    const famLabel = sp.get("familyLabel")?.trim() || "Family";
    const prefillFam =
      famId != null && famId !== "" ? [{ familyId: famId, label: famLabel }] : undefined;
    const scopeRaw = sp.get("scope")?.trim();
    let initialCreateScope: "family-tree" | "site-assets" | "my-media" = "family-tree";
    if (scopeRaw === "site-assets" || scopeRaw === "my-media" || scopeRaw === "family-tree") {
      initialCreateScope = scopeRaw;
    }
    return {
      prefillIndividuals: prefillInd,
      prefillFamilies: prefillFam,
      contextReturnHref: returnTo,
      backHref: returnTo ?? "/admin/media",
      backLabel: returnTo ? "Back to editor" : "Media",
      initialCreateScope,
    };
  }, [qs]);

  return (
    <NoteEditorPageLayout backHref={backHref} backLabel={backLabel} fullWidth hideBackLink>
      <MediaEditorForm
        mode="create"
        hideBackLink
        contextReturnHref={contextReturnHref}
        initialCreateScope={initialCreateScope}
        prefillIndividuals={prefillIndividuals}
        prefillFamilies={prefillFamilies}
      />
    </NoteEditorPageLayout>
  );
}

export default function AdminMediaNewPage() {
  return (
    <Suspense
      fallback={
        <div className="mx-auto max-w-3xl pb-20 text-sm text-muted-foreground md:pb-24">Loading…</div>
      }
    >
      <AdminMediaNewPageInner />
    </Suspense>
  );
}
