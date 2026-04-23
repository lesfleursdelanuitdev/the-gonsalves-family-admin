"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

/** Legacy URL: use `/admin/families/create` for new families. */
export default function AdminFamilyNewRedirectPage() {
  const router = useRouter();
  useEffect(() => {
    router.replace("/admin/families/create");
  }, [router]);
  return <p className="text-muted-foreground">Redirecting…</p>;
}
