import { stripSlashesFromName } from "@/lib/gedcom/display-name";

export function partnerSexLabel(sex: string | null | undefined): string {
  switch (String(sex ?? "").trim().toUpperCase()) {
    case "M":
      return "Male";
    case "F":
      return "Female";
    case "U":
    case "":
      return "Unknown";
    case "X":
      return "Other";
    default:
      return "Unknown";
  }
}

export function initialsFromDisplayName(fullName: string | null | undefined, fallbackId: string): string {
  const raw = stripSlashesFromName(fullName).trim() || fallbackId.slice(0, 8);
  const parts = raw.split(/\s+/).filter(Boolean);
  if (parts.length >= 2) {
    return (parts[0]![0]! + parts[parts.length - 1]![0]!).toUpperCase();
  }
  if (raw.length >= 2) return raw.slice(0, 2).toUpperCase();
  return (raw[0] ?? "?").toUpperCase();
}

export function partnerAvatarClass(sex: string | null | undefined): string {
  switch (String(sex ?? "").trim().toUpperCase()) {
    case "M":
      return "bg-sky-600/25 text-sky-100 ring-1 ring-sky-500/35";
    case "F":
      return "bg-rose-600/25 text-rose-100 ring-1 ring-rose-500/35";
    default:
      return "bg-base-content/15 text-muted-foreground ring-1 ring-base-content/15";
  }
}
