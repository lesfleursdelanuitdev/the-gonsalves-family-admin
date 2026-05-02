"use client";

import { Fragment, useLayoutEffect, useRef } from "react";
import type { StoryBlock } from "@/lib/admin/story-creator/story-types";
import { storyBlockRowWrapClassAndStyle } from "@/lib/admin/story-creator/story-block-layout";
import { buildScopedStoryBlockStylesheet, sanitizeStoryBlockDesignClassName } from "@/lib/admin/story-creator/story-block-design";
import { cn } from "@/lib/utils";

export function StoryBlockScopedStyle({ cssText }: { cssText: string }) {
  const ref = useRef<HTMLStyleElement>(null);
  useLayoutEffect(() => {
    if (ref.current) ref.current.textContent = cssText;
  }, [cssText]);
  return <style ref={ref} suppressHydrationWarning />;
}

/** Row layout wrapper + scope attribute + optional custom class + scoped stylesheet for one block. */
export function StoryBlockRowDesignWrap({
  block,
  floated,
  wrapperClassName,
  referencePreviewMobile,
  children,
}: {
  block: StoryBlock;
  floated: boolean;
  /** Extra classes on the row wrapper (e.g. `min-w-0` for floated text columns). */
  wrapperClassName?: string;
  /** Story reference preview: narrow “phone” layout — collapse floats and full-width rows. */
  referencePreviewMobile?: boolean;
  children: React.ReactNode;
}) {
  const rw = storyBlockRowWrapClassAndStyle(block, { floated, referencePreviewMobile });
  const sheet = buildScopedStoryBlockStylesheet(block.id, block.design?.css);
  const designClass = sanitizeStoryBlockDesignClassName(block.design?.className);
  return (
    <Fragment>
      {sheet ? <StoryBlockScopedStyle cssText={sheet} /> : null}
      <div
        data-story-block-scope={block.id}
        className={cn(rw.className, designClass, wrapperClassName)}
        style={rw.style}
      >
        {children}
      </div>
    </Fragment>
  );
}
