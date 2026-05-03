"use client";

import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { StoryAddBlockPresetGroup, StoryAddBlockPresetId } from "@/lib/admin/story-creator/story-block-presets";
import { storyAddBlockPresetLucideIcon } from "@/components/admin/story-creator/story-add-block-preset-icons";

export function StoryAddBlockPresetTypeGrid({
  groups,
  onPick,
  className,
}: {
  groups: StoryAddBlockPresetGroup[];
  onPick: (id: StoryAddBlockPresetId) => void;
  className?: string;
}) {
  return (
    <div className={cn("space-y-4", className)}>
      {groups.map((group) => (
        <div key={group.categoryId}>
          <p className="mb-2 text-[10px] font-bold uppercase tracking-[0.12em] text-base-content/45">{group.title}</p>
          <div className="grid grid-cols-3 gap-2">
            {group.items.map((item) => {
              const Icon = storyAddBlockPresetLucideIcon(item.id);
              return (
                <button
                  key={item.id}
                  type="button"
                  className={cn(
                    buttonVariants({ variant: "outline", size: "sm" }),
                    "flex h-auto min-h-[4.25rem] w-full min-w-0 items-start justify-start gap-2 rounded-xl border-base-content/15 p-2 text-left font-medium lg:rounded-lg",
                  )}
                  onClick={() => onPick(item.id)}
                >
                  <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                    <Icon className="size-4 opacity-90" aria-hidden />
                  </span>
                  <span className="min-w-0 flex-1 py-0.5">
                    <span className="block text-xs font-semibold leading-snug text-base-content">{item.label}</span>
                    {item.description ? (
                      <span className="mt-0.5 line-clamp-2 block text-[10px] font-normal leading-snug text-base-content/50">
                        {item.description}
                      </span>
                    ) : null}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}
