"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { AttributeEditForm } from "@/components/admin/AttributeEditForm";
import { useAdminAttribute } from "@/hooks/useAdminAttributes";
import { labelGedcomAttributeType } from "@/lib/gedcom/gedcom-attribute-labels";
import { routeDynamicId } from "@/lib/navigation/route-dynamic-segment";
import { cn } from "@/lib/utils";

export default function AdminAttributeEditPage() {
  const params = useParams();
  const id = routeDynamicId(params);

  const { data, isPending, error } = useAdminAttribute(id ?? "");
  const attribute = data?.attribute as Record<string, unknown> | undefined;

  const attrLabel = attribute
    ? labelGedcomAttributeType(
        attribute.attributeType as string,
        attribute.customType as string | null,
      )
    : "—";

  const back = (
    <Link
      href="/admin/attributes"
      className={cn(buttonVariants({ variant: "ghost", size: "sm" }), "mb-2 inline-flex gap-1.5")}
    >
      <ArrowLeft className="size-4" />
      Back to attributes
    </Link>
  );

  if (!id) return <div>{back}<p className="text-sm text-muted-foreground">Missing id.</p></div>;
  if (isPending) return <div>{back}<p className="text-sm text-muted-foreground">Loading…</p></div>;
  if (error || !attribute) {
    return (
      <div>
        {back}
        <p className="text-sm text-destructive">
          {error instanceof Error ? error.message : "Could not load this attribute."}
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="hidden lg:block">
        <h1 className="text-2xl font-semibold tracking-tight">
          <span className="font-medium text-muted-foreground">Edit attribute</span>{" "}
          <span className="text-foreground">{attrLabel}</span>
        </h1>
        <p className="mt-1 text-muted-foreground">Update the value, date, place, and linked records.</p>
      </div>
      <AttributeEditForm
        key={id}
        mode="edit"
        attributeId={id}
        initialAttribute={attribute}
      />
    </div>
  );
}
