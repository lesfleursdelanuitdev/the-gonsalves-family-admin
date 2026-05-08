import { createHash } from "crypto";

const NON_ALNUM = /[^a-z0-9]+/g;

/** Registry tag for EVEN + TYPE (aligned with ligneous-gedcom-lib enricher / DB seeds). */
export function eventCatalogTag(eventType: string, customType: string): string {
  const et = eventType.trim();
  const ct = customType.trim();
  if (et.toUpperCase() === "EVEN" && ct) {
    const slug = ct.toLowerCase().replace(NON_ALNUM, "_").replace(/^_|_$/g, "") || "unknown";
    const md8 = createHash("md5").update(ct.toLowerCase()).digest("hex").slice(0, 8);
    return `EVEN__${slug}_${md8}`;
  }
  return et.toUpperCase();
}

const STANDARD: Record<string, string> = {
  ADOP: "Adoption",
  ANUL: "Annulment",
  BAPM: "Baptism",
  BARM: "Bar Mitzvah",
  BASM: "Bat Mitzvah",
  BAPL: "LDS Baptism",
  BIRT: "Birth",
  BLES: "Blessing",
  BURI: "Burial",
  CAST: "Caste",
  CENS: "Census",
  CHR: "Christening",
  CHRA: "Adult Christening",
  CONF: "Confirmation",
  CREM: "Cremation",
  DEAT: "Death",
  DIV: "Divorce",
  DIVF: "Divorce Filed",
  DSCR: "Description",
  EDUC: "Education",
  EMIG: "Emigration",
  ENGA: "Engagement",
  EVEN: "Event",
  FACT: "Fact",
  FCOM: "First Communion",
  GRAD: "Graduation",
  IDNO: "National ID",
  IMMI: "Immigration",
  MARB: "Marriage Bann",
  MARC: "Marriage Contract",
  MARL: "Marriage License",
  MARR: "Marriage",
  MARS: "Marriage Settlement",
  NATI: "Nationality",
  NATU: "Naturalization",
  NCHI: "Children Count",
  NMR: "Marriage Count",
  OCCU: "Occupation",
  ORDN: "Ordination",
  PROB: "Probate",
  PROP: "Property",
  RELI: "Religion",
  RESI: "Residence",
  RETI: "Retirement",
  SSN: "Social Security Number",
  TITL: "Title",
  WILL: "Will",
};

/** Human-readable `gedcom_events_v2.event_label` for new rows. */
export function eventLabelFor(eventType: string, customType: string | null | undefined): string {
  const ct = customType ?? "";
  const tag = eventCatalogTag(eventType, ct);
  const upperTag = tag.toUpperCase().trim();
  const fromCatalog = STANDARD[upperTag];
  if (fromCatalog) return fromCatalog;
  if (tag.startsWith("EVEN__")) {
    const c = ct.trim();
    return c.length > 0 ? c : tag;
  }
  const fromEt = STANDARD[eventType.toUpperCase().trim()];
  if (fromEt) return fromEt;
  return tag;
}
