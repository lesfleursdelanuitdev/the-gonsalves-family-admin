"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { ArrowLeft, Pencil } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { DetailPageShell } from "@/components/admin/DetailPageShell";
import { useAdminAttribute } from "@/hooks/useAdminAttributes";
import { labelGedcomAttributeType } from "@/lib/gedcom/gedcom-attribute-labels";
import { formatDisplayNameFromNameForms, stripSlashesFromName } from "@/lib/gedcom/display-name";
import { routeDynamicId } from "@/lib/navigation/route-dynamic-segment";
import { cn } from "@/lib/utils";

function DetailRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="grid grid-cols-[8rem_1fr] gap-2 py-2 text-sm border-b border-border last:border-0">
      <dt className="font-medium text-muted-foreground">{label}</dt>
      <dd className="text-base-content">{value ?? <span className="text-muted-foreground">—</span>}</dd>
    </div>
  );
}

export default function AdminAttributeDetailPage() {
  const params = useParams();
  const id = routeDynamicId(params);

  const { data, isPending, error } = useAdminAttribute(id ?? "");
  const attribute = data?.attribute;

  return (
    <DetailPageShell
      backHref="/admin/attributes"
      backLabel="Back to attributes"
      isLoading={isPending}
      error={error}
      data={attribute}
      notFoundMessage="Attribute not found."
    >
      {attribute && (
        <div className="space-y-6">
          {/* ── Header ─────────────────────────────────────────────────────── */}
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="text-sm text-muted-foreground">Attribute</p>
              <h1 className="text-2xl font-semibold tracking-tight">
                {labelGedcomAttributeType(attribute.attributeType, attribute.customType)}
              </h1>
              {attribute.value ? (
                <p className="mt-1 text-base text-base-content/80">{attribute.value}</p>
              ) : null}
            </div>
            <Link
              href={`/admin/attributes/${id}/edit`}
              className={cn(buttonVariants({ variant: "default", size: "sm" }), "gap-1.5")}
            >
              <Pencil className="size-4" />
              Edit
            </Link>
          </div>

          {/* ── Core details ───────────────────────────────────────────────── */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Details</CardTitle>
            </CardHeader>
            <CardContent>
              <dl>
                <DetailRow label="Type" value={`${attribute.attributeType} — ${labelGedcomAttributeType(attribute.attributeType, attribute.customType)}`} />
                {attribute.customType ? (
                  <DetailRow label="Custom type" value={attribute.customType} />
                ) : null}
                {attribute.value ? (
                  <DetailRow label="Value" value={attribute.value} />
                ) : null}
                {attribute.agency ? (
                  <DetailRow label="Agency" value={attribute.agency} />
                ) : null}
                <DetailRow
                  label="Date"
                  value={attribute.date?.original ?? (attribute.date?.year != null ? String(attribute.date.year) : null)}
                />
                <DetailRow
                  label="Place"
                  value={attribute.place?.original ?? attribute.place?.name}
                />
              </dl>
            </CardContent>
          </Card>

          {/* ── Linked individuals ─────────────────────────────────────────── */}
          {attribute.individualAttributes?.length ? (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base">Linked individuals</CardTitle>
              </CardHeader>
              <CardContent>
                <ul className="space-y-2">
                  {attribute.individualAttributes.map((ia) => {
                    const displayName =
                      formatDisplayNameFromNameForms(ia.individual.individualNameForms, ia.individual.fullName) ||
                      stripSlashesFromName(ia.individual.fullName ?? "") || "—";
                    return (
                      <li key={ia.individual.id} className="text-sm">
                        <Link
                          href={`/admin/individuals/${ia.individual.id}`}
                          className="text-primary hover:underline underline-offset-2"
                        >
                          {displayName}
                        </Link>
                      </li>
                    );
                  })}
                </ul>
              </CardContent>
            </Card>
          ) : null}

          {/* ── Linked families ────────────────────────────────────────────── */}
          {attribute.familyAttributes?.length ? (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base">Linked families</CardTitle>
              </CardHeader>
              <CardContent>
                <ul className="space-y-2">
                  {attribute.familyAttributes.map((fa) => {
                    const h = fa.family.husband ? stripSlashesFromName(fa.family.husband.fullName ?? "") : null;
                    const w = fa.family.wife ? stripSlashesFromName(fa.family.wife.fullName ?? "") : null;
                    const label = [h, w].filter(Boolean).join(" & ") || fa.family.xref || "Family";
                    return (
                      <li key={fa.family.id} className="text-sm">
                        <Link
                          href={`/admin/families/${fa.family.id}`}
                          className="text-primary hover:underline underline-offset-2"
                        >
                          {label}
                        </Link>
                      </li>
                    );
                  })}
                </ul>
              </CardContent>
            </Card>
          ) : null}
        </div>
      )}
    </DetailPageShell>
  );
}
