import type { IndividualDetailEvent } from "@/lib/detail/individual-detail-events";
import type { FamilyDetailEvent } from "@/lib/detail/family-detail-events";
import { labelGedcomEventType } from "@/lib/gedcom/gedcom-event-labels";

export type TimelineSubject =
  | { kind: "individual"; displayName: string; sex: string | null }
  | {
      kind: "family";
      husbandName: string | null;
      wifeName: string | null;
      husbandSex: string | null;
      wifeSex: string | null;
    }
  | { kind: "none" };

type TimelineEvent = IndividualDetailEvent & Partial<FamilyDetailEvent>;

function normSex(s: string | null | undefined): "M" | "F" | null {
  const u = (s ?? "").trim().toUpperCase();
  if (u === "M") return "M";
  if (u === "F") return "F";
  return null;
}

function display(n: string | null | undefined): string | null {
  const t = (n ?? "").trim();
  return t || null;
}

function childWord(sex: string | null | undefined): "son" | "daughter" | "child" {
  const g = normSex(sex);
  if (g === "M") return "son";
  if (g === "F") return "daughter";
  return "child";
}

function siblingWord(sex: string | null | undefined): "brother" | "sister" | "sibling" {
  const g = normSex(sex);
  if (g === "M") return "brother";
  if (g === "F") return "sister";
  return "sibling";
}

function grandchildWord(sex: string | null | undefined): "grandson" | "granddaughter" | "grandchild" {
  const g = normSex(sex);
  if (g === "M") return "grandson";
  if (g === "F") return "granddaughter";
  return "grandchild";
}

function spouseWord(sex: string | null | undefined): "husband" | "wife" | "spouse" {
  const g = normSex(sex);
  if (g === "M") return "husband";
  if (g === "F") return "wife";
  return "spouse";
}

function deathCauseClause(cause: string | null | undefined): string {
  const c = (cause ?? "").trim();
  if (!c) return "";
  const t = c.endsWith(".") ? c.slice(0, -1).trimEnd() : c;
  return `. Cause of death is ${t}.`;
}

/** e.g. "Birth of granddaughter Olivia Paige, daughter of Monica's daughter Pamela" */
function grandchildBirthExtended(
  subject: TimelineSubject,
  e: TimelineEvent,
  g: string,
  gcName: string,
  relSex: string | null | undefined,
): string {
  const parentNm = display(e.relatedParentName);
  const parentSx = e.relatedParentSex ?? null;
  const gcRel = childWord(relSex);
  const parentChild = childWord(parentSx);
  if (!parentNm) return `Birth of ${g} ${gcName}`;
  if (subject.kind === "individual") {
    const self = display(subject.displayName) ?? "this person";
    return `Birth of ${g} ${gcName}, ${gcRel} of ${self}'s ${parentChild} ${parentNm}`;
  }
  return `Birth of ${g} ${gcName}, ${gcRel} of ${parentChild} ${parentNm}`;
}

function grandchildDeathExtended(
  subject: TimelineSubject,
  e: TimelineEvent,
  g: string,
  gcName: string,
  relSex: string | null | undefined,
): string {
  const parentNm = display(e.relatedParentName);
  const parentSx = e.relatedParentSex ?? null;
  const gcRel = childWord(relSex);
  const parentChild = childWord(parentSx);
  const cause = deathCauseClause(e.cause);
  if (!parentNm) return `Death of ${g} ${gcName}${cause}`;
  if (subject.kind === "individual") {
    const self = display(subject.displayName) ?? "this person";
    return `Death of ${g} ${gcName}, ${gcRel} of ${self}'s ${parentChild} ${parentNm}${cause}`;
  }
  return `Death of ${g} ${gcName}, ${gcRel} of ${parentChild} ${parentNm}${cause}`;
}

/**
 * One-line friendly copy when the event has no `value` (narrative) text.
 * Uses `source` and related names from aggregated admin timeline rows.
 */
export function friendlyTimelineDescription(e: TimelineEvent, subject: TimelineSubject): string | null {
  if ((e.value ?? "").trim()) return null;

  const et = (e.eventType ?? "").trim().toUpperCase();
  const name = display(e.childName);
  const spouseNm = display(e.spouseName);
  const relSex = e.relatedSex ?? null;

  if (subject.kind === "none") {
    if (et === "BIRT") return "Birth";
    if (et === "DEAT") return "Death";
    return null;
  }

  if (subject.kind === "individual") {
    const self = display(subject.displayName) ?? "this person";

    switch (e.source) {
      case "individual": {
        if (et === "BIRT") return `Birth of ${self}`;
        if (et === "DEAT") return `Death of ${self}${deathCauseClause(e.cause)}`;
        if (et === "MARR" && spouseNm) return `Marriage of ${self} to ${spouseNm}`;
        if (et === "DIV" && spouseNm) return `Divorce of ${self} and ${spouseNm}`;
        const lab = labelGedcomEventType(et);
        return `${lab} of ${self}`;
      }
      case "family": {
        if (et === "MARR" && spouseNm) return `Marriage of ${self} to ${spouseNm}`;
        if (et === "DIV" && spouseNm) return `Divorce of ${self} and ${spouseNm}`;
        const lab = labelGedcomEventType(et);
        return `${lab} of ${self}`;
      }
      case "spouseBirth": {
        if (!spouseNm) return null;
        const w = spouseWord(relSex);
        return `Birth of ${w}, ${spouseNm}`;
      }
      case "spouseDeath": {
        if (!spouseNm) return null;
        const w = spouseWord(relSex);
        return `Death of ${w}, ${spouseNm}${deathCauseClause(e.cause)}`;
      }
      case "childBirth": {
        const ch = childWord(relSex);
        const who = name ?? "child";
        return `Birth of ${ch}, ${who}`;
      }
      case "childDeath": {
        const ch = childWord(relSex);
        const who = name ?? "child";
        return `Death of ${ch}, ${who}${deathCauseClause(e.cause)}`;
      }
      case "childMarriage": {
        const ch = childWord(relSex);
        const who = name ?? "child";
        const p = display(e.spouseName);
        if (!p) return `Marriage of ${ch}, ${who}`;
        return `Marriage of ${ch}, ${who} to ${p}`;
      }
      case "grandchildBirth": {
        const g = grandchildWord(relSex);
        const who = name ?? "grandchild";
        return grandchildBirthExtended(subject, e, g, who, relSex);
      }
      case "grandchildDeath": {
        const g = grandchildWord(relSex);
        const who = name ?? "grandchild";
        return grandchildDeathExtended(subject, e, g, who, relSex);
      }
      case "parentDeath": {
        if (!spouseNm) return null;
        if (e.parentSide === "mother") return `Death of mother, ${spouseNm}${deathCauseClause(e.cause)}`;
        if (e.parentSide === "father") return `Death of father, ${spouseNm}${deathCauseClause(e.cause)}`;
        return `Death of parent, ${spouseNm}${deathCauseClause(e.cause)}`;
      }
      case "siblingDeath": {
        const s = siblingWord(relSex);
        const who = name ?? "sibling";
        return `Death of ${s}, ${who}${deathCauseClause(e.cause)}`;
      }
      case "grandparentDeath": {
        if (!spouseNm) return null;
        if (e.grandparentSide === "grandmother") return `Death of grandmother, ${spouseNm}${deathCauseClause(e.cause)}`;
        if (e.grandparentSide === "grandfather") return `Death of grandfather, ${spouseNm}${deathCauseClause(e.cause)}`;
        return `Death of grandparent, ${spouseNm}${deathCauseClause(e.cause)}`;
      }
      default:
        return null;
    }
  }

  if (subject.kind === "family") {
    const h = display(subject.husbandName);
    const w = display(subject.wifeName);

    switch (e.source) {
      case "familyRecord": {
        if (et === "MARR") {
          if (h && w) return `Marriage of ${h} to ${w}`;
          if (h) return `Marriage of ${h}`;
          if (w) return `Marriage of ${w}`;
          return "Marriage";
        }
        if (et === "DIV") {
          if (h && w) return `Divorce of ${h} and ${w}`;
          if (h) return `Divorce of ${h}`;
          if (w) return `Divorce of ${w}`;
          return "Divorce";
        }
        const lab = labelGedcomEventType(et);
        if (h && w) return `${lab} (${h} and ${w})`;
        return lab;
      }
      case "member": {
        const who = display(e.memberName) ?? "family member";
        const role = e.memberRole;
        if (et === "BIRT") {
          if (role === "husband") return h ? `Birth of husband, ${h}` : `Birth of ${who}`;
          if (role === "wife") return w ? `Birth of wife, ${w}` : `Birth of ${who}`;
          if (role === "child") {
            const ch = childWord(relSex);
            return `Birth of ${ch}, ${who}`;
          }
          return `Birth of ${who}`;
        }
        if (et === "DEAT") {
          if (role === "husband") return h ? `Death of husband, ${h}${deathCauseClause(e.cause)}` : `Death of ${who}${deathCauseClause(e.cause)}`;
          if (role === "wife") return w ? `Death of wife, ${w}${deathCauseClause(e.cause)}` : `Death of ${who}${deathCauseClause(e.cause)}`;
          if (role === "child") {
            const ch = childWord(relSex);
            return `Death of ${ch}, ${who}${deathCauseClause(e.cause)}`;
          }
          return `Death of ${who}${deathCauseClause(e.cause)}`;
        }
        if (et === "MARR") return `Marriage of ${who}`;
        if (et === "DIV") return `Divorce of ${who}`;
        const lab = labelGedcomEventType(et);
        return `${lab} of ${who}`;
      }
      case "grandchildOfChild": {
        if (et === "BIRT") {
          const g = grandchildWord(relSex);
          const who = name ?? "grandchild";
          return grandchildBirthExtended(subject, e, g, who, relSex);
        }
        if (et === "DEAT") {
          const g = grandchildWord(relSex);
          const who = name ?? "grandchild";
          return grandchildDeathExtended(subject, e, g, who, relSex);
        }
        return null;
      }
      default:
        return null;
    }
  }

  return null;
}
