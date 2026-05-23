import { Suspense } from "react";
import { PlaceResolutionClient } from "./PlaceResolutionClient";

export default function AdminPlaceResolutionPage() {
  return (
    <Suspense fallback={<div className="p-6 text-sm text-muted-foreground">Loading place resolution…</div>}>
      <PlaceResolutionClient />
    </Suspense>
  );
}
