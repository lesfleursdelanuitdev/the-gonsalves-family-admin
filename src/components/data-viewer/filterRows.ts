/** Client-side search matching DataViewerTable’s globalFilterFn (accessorKey / column id). */
export function filterRowsByGlobalSearch<TRecord>(
  data: TRecord[],
  globalFilterColumnId: string | undefined,
  filter: string
): TRecord[] {
  if (!globalFilterColumnId || !filter.trim()) return data;
  const q = filter.toLowerCase();
  return data.filter((row) => {
    const raw = (row as Record<string, unknown>)[globalFilterColumnId];
    return String(raw ?? "").toLowerCase().includes(q);
  });
}
