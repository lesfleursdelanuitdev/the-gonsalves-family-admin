"use client";

import type { Components } from "react-markdown";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import rehypeSanitize from "rehype-sanitize";
import { cn } from "@/lib/utils";

const markdownComponents: Components = {
  a: ({ href, children, ...props }) => {
    const external = typeof href === "string" && /^https?:\/\//i.test(href);
    return (
      <a
        href={href}
        {...props}
        {...(external ? { target: "_blank", rel: "noopener noreferrer" } : {})}
      >
        {children}
      </a>
    );
  },
};

export function NoteContentMarkdown({
  markdown,
  className,
}: {
  markdown: string;
  className?: string;
}) {
  const trimmed = markdown.trim();
  if (!trimmed) {
    return <span className="text-muted-foreground">Empty note.</span>;
  }

  return (
    <div
      className={cn(
        "prose prose-sm max-w-none dark:prose-invert",
        "prose-headings:scroll-mt-20 prose-a:text-primary prose-a:underline",
        "prose-pre:bg-base-300/40 prose-pre:border prose-pre:border-base-content/10",
        className,
      )}
    >
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        rehypePlugins={[rehypeSanitize]}
        components={markdownComponents}
      >
        {trimmed}
      </ReactMarkdown>
    </div>
  );
}
