"use client";

import { AttributeEditForm } from "@/components/admin/AttributeEditForm";

export default function AdminNewAttributePage() {
  return (
    <div className="space-y-6">
      <div className="hidden lg:block">
        <h1 className="text-2xl font-semibold tracking-tight">New attribute</h1>
        <p className="mt-1 text-muted-foreground">
          Add a GEDCOM attribute — a characteristic or state (occupation, education, religion, etc.)
          linked to a person or family.
        </p>
      </div>
      <AttributeEditForm mode="create" />
    </div>
  );
}
