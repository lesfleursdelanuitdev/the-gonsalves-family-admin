import { Suspense } from "react";
import { MergeRecordsClient } from "./MergeRecordsClient";

export default function AdminMergeRecordsPage() {
  return (
    <Suspense fallback={<div className="p-6 text-sm text-muted-foreground">Loading merge records…</div>}>
      <MergeRecordsClient />
    </Suspense>
  );
}
