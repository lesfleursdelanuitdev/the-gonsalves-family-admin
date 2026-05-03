"use client";

import { useParams } from "next/navigation";
import { FamilyEditForm } from "@/components/admin/FamilyEditForm";
import { EntityOpenQuestionsSection } from "@/components/admin/EntityOpenQuestionsSection";

export default function AdminFamilyEditPage() {
  const params = useParams();
  const id = typeof params.id === "string" ? params.id : "";
  if (!id) {
    return <p className="text-muted-foreground">Missing family id.</p>;
  }
  return (
    <div className="space-y-8">
      <FamilyEditForm familyId={id} />
      <EntityOpenQuestionsSection entityType="family" entityId={id} variant="edit" />
    </div>
  );
}
