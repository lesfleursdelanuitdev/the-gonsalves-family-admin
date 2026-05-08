import type { SpouseFamilyFormRow } from "@/lib/forms/individual-editor-form";

/** Title line like “Family with {other parent}” for the edited person’s spouse families. */
export function spouseFamilyCardPartnerTitle(
  row: SpouseFamilyFormRow,
  selfIndividualId: string,
  mode: "create" | "edit",
): string {
  const husbandLabel = row.husbandDisplay?.trim() || "—";
  const wifeLabel = row.wifeDisplay?.trim() || "—";
  const husbandId = row.husbandId;
  const wifeId = row.wifeId;
  const isHusbandSelf = mode === "edit" && !!selfIndividualId && !!husbandId && husbandId === selfIndividualId;
  const isWifeSelf = mode === "edit" && !!selfIndividualId && !!wifeId && wifeId === selfIndividualId;
  const otherLabel = isHusbandSelf ? wifeLabel : isWifeSelf ? husbandLabel : "";
  if (isHusbandSelf || isWifeSelf) {
    return otherLabel !== "—" && otherLabel.trim() !== ""
      ? otherLabel
      : "Unknown parent";
  }
  const parts = [husbandLabel, wifeLabel].filter((x) => x !== "—");
  return parts.join(" · ") || "Family";
}
