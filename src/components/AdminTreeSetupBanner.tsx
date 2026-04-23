"use client";

import { useQuery } from "@tanstack/react-query";
import { fetchJson } from "@/lib/infra/api";
import { AlertCircle } from "lucide-react";

interface SetupResponse {
  configured: boolean;
  message?: string;
  suggestions?: Array<{ adminTreeId: string; adminTreeFileId: string; name: string }>;
}

export function AdminTreeSetupBanner() {
  const { data, isLoading } = useQuery({
    queryKey: ["admin", "setup"],
    queryFn: () => fetchJson<SetupResponse>("/api/admin/setup"),
    staleTime: 60 * 1000,
  });

  if (isLoading || !data || data.configured) return null;

  const first = data.suggestions?.[0];

  return (
    <div role="alert" className="alert alert-warning shadow-sm">
      <AlertCircle className="size-5 shrink-0" />
      <div className="min-w-0 space-y-2 text-sm">
        <p className="font-semibold">Admin tree not configured</p>
        <p className="opacity-90">{data.message}</p>
        {first && (
          <div className="rounded-box border border-base-content/[0.08] bg-base-100/60 px-3 py-2 font-mono text-xs">
            Add to <code className="text-base-content">.env.local</code> then restart the dev server:
            <br />
            <span className="text-success font-medium">ADMIN_TREE_ID={first.adminTreeId}</span>
            <br />
            <span className="text-base-content/55">(Tree: {first.name})</span>
          </div>
        )}
      </div>
    </div>
  );
}
