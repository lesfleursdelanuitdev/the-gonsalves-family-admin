"use client";

import Link from "next/link";
import { AlertCircle } from "lucide-react";
import type { DashboardNeedsAttentionRow } from "@/lib/admin/admin-dashboard-snapshot";
import { cn } from "@/lib/utils";

type Props = {
  rows: DashboardNeedsAttentionRow[];
  isLoading: boolean;
  configured: boolean;
};

export function DashboardNeedsAttentionPanel({ rows, isLoading, configured }: Props) {
  return (
    <section
      id="needs-attention"
      className="scroll-mt-24 rounded-3xl border border-base-content/[0.08] bg-base-200/25 p-6 shadow-[inset_0_1px_0_0_rgba(255,255,255,0.03)] ring-1 ring-warning/10"
      aria-labelledby="needs-attention-heading"
    >
      <div className="flex items-start gap-2">
        <span className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-lg bg-warning/12 text-warning">
          <AlertCircle className="size-4" aria-hidden />
        </span>
        <div>
          <h2 id="needs-attention-heading" className="text-sm font-semibold text-base-content">
            Needs attention
          </h2>
          <p className="mt-1 text-xs leading-relaxed text-base-content/55">
            A curator checklist — gentle prompts, not alarms.
          </p>
        </div>
      </div>

      <ul className="mt-5 divide-y divide-base-content/[0.07]">
        {isLoading ? (
          Array.from({ length: 4 }).map((_, i) => (
            <li key={i} className="py-3">
              <div className="skeleton h-12 w-full rounded-lg" />
            </li>
          ))
        ) : configured && rows.length > 0 ? (
          rows.map((row) => (
            <li key={row.id}>
              <Link
                href={row.href}
                className={cn(
                  "flex items-start justify-between gap-3 py-3.5 transition-colors",
                  "rounded-xl hover:bg-base-content/[0.04]",
                )}
              >
                <div className="min-w-0">
                  <p className="text-sm font-medium text-base-content">{row.label}</p>
                  <p className="mt-0.5 text-xs leading-relaxed text-base-content/55">{row.description}</p>
                </div>
                <span className="shrink-0 rounded-md bg-warning/14 px-2 py-0.5 text-xs font-semibold tabular-nums text-warning">
                  {row.count.toLocaleString()}
                </span>
              </Link>
            </li>
          ))
        ) : (
          <li className="py-8 text-center text-sm text-muted-foreground">
            {configured ? "Nothing flagged right now." : "Configure the tree to see checklist items."}
          </li>
        )}
      </ul>

      {configured ? (
        <div className="mt-4 border-t border-base-content/[0.07] pt-3">
          <Link href="/admin/changelog" className="text-xs font-medium text-primary hover:underline">
            View all activity
          </Link>
        </div>
      ) : null}
    </section>
  );
}
