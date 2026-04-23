/** Strip common markdown syntax for list/table previews (not full parsing). */
export function markdownToPlainPreview(source: string, maxLen: number): string {
  let t = source.replace(/\r\n/g, "\n");
  t = t.replace(/\[([^\]]+)\]\([^)]*\)/g, "$1");
  t = t.replace(/`{1,3}[\s\S]*?`{1,3}/g, " ");
  t = t.replace(/^#{1,6}\s+/gm, "");
  t = t.replace(/[*_~`#>|\\-]/g, "");
  t = t.replace(/\s+/g, " ").trim();
  if (t.length <= maxLen) return t;
  return `${t.slice(0, maxLen).trim()}…`;
}
