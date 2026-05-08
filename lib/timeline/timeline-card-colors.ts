/** Card chrome keyed by GEDCOM tag or custom TYPE (for EVEN/CUST), aligned with `timeline_generator_v3.html`. */
const STANDARD: Record<string, { m: string; bg: string; t: string }> = {
  BIRT: { m: "#16a34a", bg: "#dcfce7", t: "#14532d" },
  DEAT: { m: "#6b7280", bg: "#f3f4f6", t: "#374151" },
  MARR: { m: "#db2777", bg: "#fce7f3", t: "#831843" },
  EMIG: { m: "#2563eb", bg: "#dbeafe", t: "#1e3a8a" },
  IMMI: { m: "#1d4ed8", bg: "#dbeafe", t: "#1e3a8a" },
  RESI: { m: "#0d9488", bg: "#ccfbf1", t: "#134e4a" },
  RETI: { m: "#d97706", bg: "#fef3c7", t: "#78350f" },
  NATU: { m: "#7c3aed", bg: "#ede9fe", t: "#4c1d95" },
};

const CUSTOM: Record<string, { m: string; bg: string; t: string }> = {
  HISTORICAL_EVENT: { m: "#7c3aed", bg: "#ede9fe", t: "#4c1d95" },
  POLITICAL_EVENT: { m: "#9333ea", bg: "#f3e8ff", t: "#6b21a8" },
  POLITICAL_UNREST: { m: "#b91c1c", bg: "#fee2e2", t: "#7f1d1d" },
  EXPLORATION: { m: "#b45309", bg: "#fef3c7", t: "#78350f" },
  COLONIZATION: { m: "#92400e", bg: "#fef3c7", t: "#78350f" },
  COLONIAL_POSSESSION: { m: "#78350f", bg: "#fef3c7", t: "#451a03" },
  ABOLITION_OF_SLAVERY: { m: "#1d4ed8", bg: "#dbeafe", t: "#1e3a8a" },
  INDEPENDENCE: { m: "#15803d", bg: "#dcfce7", t: "#14532d" },
  PROPERTY_PURCHASE: { m: "#0f766e", bg: "#ccfbf1", t: "#134e4a" },
  MEDICAL_TREATMENT_TRAVEL: { m: "#0369a1", bg: "#e0f2fe", t: "#0c4a6e" },
  HEALTH_EVALUATION: { m: "#0369a1", bg: "#e0f2fe", t: "#0c4a6e" },
  BUILDING_CONSTRUCTION: { m: "#78716c", bg: "#f5f5f4", t: "#44403c" },
  BUILDING_CONSECRATION: { m: "#78716c", bg: "#f5f5f4", t: "#44403c" },
  LEFT_HOME_FOR_EMPLOYMENT: { m: "#0f766e", bg: "#ccfbf1", t: "#134e4a" },
  CREATIVE_WORK: { m: "#7c3aed", bg: "#ede9fe", t: "#4c1d95" },
  MET_PERSON: { m: "#db2777", bg: "#fce7f3", t: "#831843" },
  RETURN_TRAVEL: { m: "#0369a1", bg: "#e0f2fe", t: "#0c4a6e" },
  VISIT: { m: "#0369a1", bg: "#e0f2fe", t: "#0c4a6e" },
};

const FALLBACK = { m: "#6b7280", bg: "#f3f4f6", t: "#374151" };

export type TimelineCardColorSet = { m: string; bg: string; t: string };

export function timelineCardColors(eventType: string, customType: string | null | undefined): TimelineCardColorSet {
  const et = (eventType || "").trim().toUpperCase();
  const sub = (customType || "").trim().toUpperCase();
  if (et === "CUST" || et === "EVEN") {
    const c = CUSTOM[sub];
    if (c) return c;
  }
  return STANDARD[et] ?? FALLBACK;
}
