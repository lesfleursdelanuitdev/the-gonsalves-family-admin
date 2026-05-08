import { stripSlashesFromName } from "@/lib/gedcom/display-name";

type Row = Record<string, unknown>;

function stripName(s: string | null | undefined): string | null {
  const t = stripSlashesFromName(s);
  return t === "" ? null : t;
}

function sexStr(v: unknown): string | null {
  if (v == null || String(v).trim() === "") return null;
  return String(v);
}

/**
 * For a grandchild row joined to family `f`, returns which partner is in `childIdSet`
 * (the subject's child) and that person's display name + sex.
 */
export function grandchildParentFromFamilyRow(
  r: Row,
  childIdSet: Set<string>,
): { name: string | null; sex: string | null } {
  const hid = r.rp_husband_id as string | undefined;
  const wid = r.rp_wife_id as string | undefined;
  const hIn = Boolean(hid && childIdSet.has(hid));
  const wIn = Boolean(wid && childIdSet.has(wid));
  if (hIn && wIn) {
    return { name: stripName(r.rp_husband_name as string), sex: sexStr(r.rp_husband_sex) };
  }
  if (hIn) {
    return { name: stripName(r.rp_husband_name as string), sex: sexStr(r.rp_husband_sex) };
  }
  if (wIn) {
    return { name: stripName(r.rp_wife_name as string), sex: sexStr(r.rp_wife_sex) };
  }
  return { name: null, sex: null };
}
