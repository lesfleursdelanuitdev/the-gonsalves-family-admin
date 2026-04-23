"use client";

import { useParams } from "next/navigation";
import { FamilyEditForm } from "@/components/admin/FamilyEditForm";

export default function AdminFamilyEditPage() {
  const params = useParams();
  const id = typeof params.id === "string" ? params.id : "";
  if (!id) {
    return <p className="text-muted-foreground">Missing family id.</p>;
  }
  return <FamilyEditForm familyId={id} />;
}
