import { markdownToPlainPreview } from "@/lib/utils/markdown-preview";

/** First few non-empty lines as plain text (short), for picker cards — not full note bodies. */
export function notePickerContentPreviewLines(
  content: string,
  maxLines = 3,
  maxCharsPerLine = 160,
): string {
  const lines = content
    .replace(/\r\n/g, "\n")
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean);
  return lines
    .slice(0, maxLines)
    .map((line) => markdownToPlainPreview(line, maxCharsPerLine))
    .join("\n");
}
