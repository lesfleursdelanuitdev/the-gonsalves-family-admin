import { redirect } from "next/navigation";

/** @deprecated Use `/admin/gedcom/export` (sidebar GEDCOM → Export). */
export default function AdminExportRedirectPage() {
  redirect("/admin/gedcom/export");
}
