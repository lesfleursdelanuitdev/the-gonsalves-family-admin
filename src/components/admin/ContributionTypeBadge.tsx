import { BookOpen, Lightbulb, ChefHat, Languages, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";
import type { ContributionType } from "@ligneous/prisma";

const CONFIG: Record<ContributionType, { label: string; icon: typeof Lightbulb; className: string }> = {
  memory: {
    label: "Memory",
    icon: BookOpen,
    className: "border-violet-200 bg-violet-50 text-violet-700 dark:border-violet-800 dark:bg-violet-950/40 dark:text-violet-400",
  },
  suggestion: {
    label: "Suggestion",
    icon: Lightbulb,
    className: "border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-400",
  },
  recipe: {
    label: "Recipe",
    icon: ChefHat,
    className: "border-orange-200 bg-orange-50 text-orange-700 dark:border-orange-800 dark:bg-orange-950/40 dark:text-orange-400",
  },
  language: {
    label: "Language",
    icon: Languages,
    className: "border-blue-200 bg-blue-50 text-blue-700 dark:border-blue-800 dark:bg-blue-950/40 dark:text-blue-400",
  },
  folklore: {
    label: "Folklore",
    icon: Sparkles,
    className: "border-pink-200 bg-pink-50 text-pink-700 dark:border-pink-800 dark:bg-pink-950/40 dark:text-pink-400",
  },
};

export function ContributionTypeBadge({
  type,
  size = "default",
}: {
  type: ContributionType | string;
  size?: "default" | "sm";
}) {
  const cfg = CONFIG[type as ContributionType] ?? CONFIG.memory;
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
