export type GedcomQuay = 0 | 1 | 2 | 3;

export const QUAY_LABELS: Record<GedcomQuay, string> = {
  0: "Unreliable",
  1: "Questionable",
  2: "Secondary",
  3: "Primary",
};

export const QUAY_OPTIONS: { value: GedcomQuay; label: string }[] = [
  { value: 3, label: "Primary" },
  { value: 2, label: "Secondary" },
  { value: 1, label: "Questionable" },
  { value: 0, label: "Unreliable" },
];

export const QUAY_BADGE_CLASS: Record<GedcomQuay, string> = {
  3: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300",
  2: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300",
  1: "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300",
  0: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300",
};

export function quayLabel(quality: number | null | undefined): string | null {
  if (quality == null) return null;
  const q = Math.round(quality) as GedcomQuay;
  return QUAY_LABELS[q] ?? null;
}

export function quayBadgeClass(quality: number | null | undefined): string {
  if (quality == null) return "bg-muted text-muted-foreground";
  const q = Math.round(quality) as GedcomQuay;
  return QUAY_BADGE_CLASS[q] ?? "bg-muted text-muted-foreground";
}

export function parseQuay(v: unknown): GedcomQuay | null {
  if (v == null || v === "") return null;
  const n = Number(v);
  if (!Number.isFinite(n)) return null;
  const rounded = Math.round(n);
  if (rounded < 0 || rounded > 3) return null;
  return rounded as GedcomQuay;
}
