import { Ban, CheckCircle2, Clock, XCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import type { AccessRequestStatus } from "@ligneous/prisma";

const CONFIG: Record<AccessRequestStatus, { label: string; icon: typeof Clock; className: string }> = {
  pending: {
    label: "Pending",
    icon: Clock,
    className: "border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-400",
  },
  approved: {
    label: "Approved",
    icon: CheckCircle2,
    className: "border-green-200 bg-green-50 text-green-700 dark:border-green-800 dark:bg-green-950/40 dark:text-green-400",
  },
  rejected: {
    label: "Rejected",
    icon: XCircle,
    className: "border-red-200 bg-red-50 text-red-700 dark:border-red-800 dark:bg-red-950/40 dark:text-red-400",
  },
  cancelled: {
    label: "Cancelled",
    icon: Ban,
    className: "border-base-content/10 bg-base-content/[0.04] text-muted-foreground",
  },
};

export function AccessRequestStatusBadge({
  status,
  size = "default",
}: {
  status: AccessRequestStatus | string;
  size?: "default" | "sm";
}) {
  const cfg = CONFIG[status as AccessRequestStatus] ?? CONFIG.pending;
  const Icon = cfg.icon;
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-md border font-medium",
        size === "sm" ? "px-1.5 py-0.5 text-[10px] leading-tight" : "px-2 py-0.5 text-xs",
        cfg.className,
      )}
    >
      <Icon className={cn("shrink-0", size === "sm" ? "size-3" : "size-3.5")} aria-hidden />
      {cfg.label}
    </span>
  );
}
