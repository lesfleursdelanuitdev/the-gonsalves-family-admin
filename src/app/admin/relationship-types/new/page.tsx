"use client";

import { NoteEditorPageLayout } from "@/components/admin/NoteEditorPageLayout";
import { RelationshipTypeNewForm } from "@/components/admin/relationship-type-editor/RelationshipTypeNewForm";

export default function AdminNewRelationshipTypePage() {
  return (
    <NoteEditorPageLayout backHref="/admin/relationship-types" backLabel="Relationship types" fullWidth hideBackLink>
      <RelationshipTypeNewForm backHref="/admin/relationship-types" />
    </NoteEditorPageLayout>
  );
}
