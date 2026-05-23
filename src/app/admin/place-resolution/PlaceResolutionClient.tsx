"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { MapPin, Lightbulb } from "lucide-react";
import { cn } from "@/lib/utils";
import { SuggestionsPanel } from "./SuggestionsPanel";
import { ResolvedPlacesPanel } from "./ResolvedPlacesPanel";

type Tab = "suggestions" | "resolved";

const TABS: { id: Tab; label: string; icon: typeof MapPin }[] = [
  { id: "suggestions", label: "Suggestions", icon: Lightbulb },
  { id: "resolved",    label: "Resolved places", icon: MapPin },
];

export function PlaceResolutionClient() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const tabParam = searchParams.get("tab") as Tab | null;
  const activeTab = tabParam && TABS.some((t) => t.id === tabParam) ? tabParam : "suggestions";

  const setTab = (t: Tab) => router.replace(`/admin/place-resolution?tab=${t}`);

  return (
    <div className="mx-auto flex max-w-7xl flex-col gap-6 px-4 py-6 sm:px-6">
      <div className="space-y-1">
        <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight">
          <MapPin className="size-6 text-muted-foreground" aria-hidden />
          Place Resolution
        </h1>
        <p className="text-sm text-muted-foreground">
          Identify GEDCOM place variants that refer to the same location, then create canonical
          resolved places that link them. Historical names like "British Guiana" are preserved as
          aliases — no source records are altered.
        </p>
      </div>

      <div role="tablist" className="flex flex-wrap gap-1 rounded-lg border border-base-content/10 bg-base-200/40 p-1">
        {TABS.map((t) => {
          const active = activeTab === t.id;
          const Icon = t.icon;
          return (
            <button
              key={t.id}
              role="tab"
              aria-selected={active}
              className={cn(
                "flex items-center gap-1.5 rounded-md px-4 py-2 text-sm font-medium transition-colors",
                active
                  ? "bg-base-100 text-base-content shadow-sm"
                  : "text-base-content/60 hover:text-base-content",
              )}
              onClick={() => setTab(t.id)}
            >
              <Icon className="size-4 shrink-0" aria-hidden />
              {t.label}
            </button>
          );
        })}
      </div>

      {activeTab === "suggestions" ? <SuggestionsPanel /> : null}
      {activeTab === "resolved"    ? <ResolvedPlacesPanel /> : null}
    </div>
  );
}
