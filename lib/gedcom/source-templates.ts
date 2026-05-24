export type TemplateCategory =
  | "ancestry"
  | "civil"
  | "church"
  | "census"
  | "newspaper"
  | "book"
  | "oral"
  | "custom";

export interface SourceTemplate {
  id: string;
  label: string;
  category: TemplateCategory;
  description: string;
  pageLabel: string;
  pagePlaceholder: string;
  citationLabel: string;
  citationPlaceholder: string;
  defaultQuality?: 0 | 1 | 2 | 3;
}

export const SOURCE_TEMPLATES: SourceTemplate[] = [
  {
    id: "ancestry-record-image",
    label: "Ancestry — Record image",
    category: "ancestry",
    description: "Original scanned document from an Ancestry.com database",
    pageLabel: "Database / collection name",
    pagePlaceholder: "e.g. 1940 United States Federal Census",
    citationLabel: "Citation text or URL",
    citationPlaceholder: "Ancestry.com URL, or citation in full",
    defaultQuality: 2,
  },
  {
    id: "ancestry-index-only",
    label: "Ancestry — Index only (no image)",
    category: "ancestry",
    description: "Index entry without a scanned image attached",
    pageLabel: "Database / collection name",
    pagePlaceholder: "e.g. Massachusetts, Vital Records, 1840–1911",
    citationLabel: "Index entry details",
    citationPlaceholder: "Name as indexed, entry ID, or search URL",
    defaultQuality: 1,
  },
  {
    id: "ancestry-census",
    label: "Ancestry — Census record",
    category: "census",
    description: "Federal or state census enumeration from Ancestry.com",
    pageLabel: "Census year, roll, page",
    pagePlaceholder: "e.g. 1880 US Census, roll T9-543, p. 12B",
    citationLabel: "Household / enumeration details",
    citationPlaceholder: "Enum. district, household no., schedule line…",
    defaultQuality: 2,
  },
  {
    id: "ancestry-vital-record",
    label: "Ancestry — Vital record",
    category: "civil",
    description: "Birth, marriage, or death certificate from Ancestry.com",
    pageLabel: "Certificate / volume / page",
    pagePlaceholder: "e.g. Vol. 12, p. 47, cert. no. 1234",
    citationLabel: "Transcription or key fields",
    citationPlaceholder: "Names, date, place, registrar, witnesses…",
    defaultQuality: 3,
  },
  {
    id: "ancestry-user-media",
    label: "Ancestry — User-uploaded media",
    category: "ancestry",
    description: "Photo or document uploaded by an Ancestry member",
    pageLabel: "Item title or gallery reference",
    pagePlaceholder: "e.g. 'Family photo, 1923' — contributed by johndoe",
    citationLabel: "Notes about reliability",
    citationPlaceholder: "Who uploaded it, claimed relationship, caveats…",
    defaultQuality: 1,
  },
  {
    id: "civil-birth-cert",
    label: "Civil — Birth certificate",
    category: "civil",
    description: "Official government-issued birth certificate",
    pageLabel: "Certificate number / reference",
    pagePlaceholder: "e.g. cert. no. 1234, vol. 5, p. 88",
    citationLabel: "Issuing office / archive",
    citationPlaceholder: "Registrar General, county clerk, archive call number…",
    defaultQuality: 3,
  },
  {
    id: "civil-death-cert",
    label: "Civil — Death certificate",
    category: "civil",
    description: "Official government-issued death certificate",
    pageLabel: "Certificate number / reference",
    pagePlaceholder: "e.g. cert. no. 5678",
    citationLabel: "Issuing office / informant details",
    citationPlaceholder: "Registrar, informant name and relationship…",
    defaultQuality: 3,
  },
  {
    id: "church-baptism",
    label: "Church — Baptism register",
    category: "church",
    description: "Parish baptism record or register entry",
    pageLabel: "Parish / register / folio",
    pagePlaceholder: "e.g. St Mary's Parish Register, vol. 3, fol. 12",
    citationLabel: "Godparents / witnesses",
    citationPlaceholder: "Godparent names, officiating priest, any remarks…",
    defaultQuality: 2,
  },
  {
    id: "church-marriage",
    label: "Church — Marriage register",
    category: "church",
    description: "Parish marriage record or register entry",
    pageLabel: "Parish / register / folio",
    pagePlaceholder: "e.g. St Patrick's Parish Register, vol. 2, fol. 9",
    citationLabel: "Witnesses / banns",
    citationPlaceholder: "Witness names, officiating priest, banns dates…",
    defaultQuality: 2,
  },
  {
    id: "newspaper-obit",
    label: "Newspaper — Obituary",
    category: "newspaper",
    description: "Published newspaper obituary notice",
    pageLabel: "Paper, date, page",
    pagePlaceholder: "e.g. Boston Globe, 15 Mar 1923, p. 4",
    citationLabel: "Obituary text or summary",
    citationPlaceholder: "Transcribe key details or paste the full obituary…",
    defaultQuality: 1,
  },
  {
    id: "book-published",
    label: "Book — Published genealogy or history",
    category: "book",
    description: "Printed book, compiled genealogy, or historical work",
    pageLabel: "Author, title, page",
    pagePlaceholder: "e.g. Smith (1902), The Smith Family History, p. 47",
    citationLabel: "Relevant passage or note",
    citationPlaceholder: "Quote the relevant passage or note its claim…",
    defaultQuality: 1,
  },
  {
    id: "oral-family",
    label: "Oral — Family tradition",
    category: "oral",
    description: "Information passed down orally within the family",
    pageLabel: "Informant and date",
    pagePlaceholder: "e.g. Told by Aunt Mary Gonsalves, June 1985",
    citationLabel: "Claim / context",
    citationPlaceholder: "What was said, any corroborating details…",
    defaultQuality: 0,
  },
];

export const TEMPLATE_CATEGORY_LABELS: Record<TemplateCategory, string> = {
  ancestry: "Ancestry.com",
  civil: "Civil records",
  church: "Church records",
  census: "Census",
  newspaper: "Newspaper",
  book: "Published work",
  oral: "Oral / family tradition",
  custom: "Other / custom",
};

export function getTemplateById(id: string): SourceTemplate | undefined {
  return SOURCE_TEMPLATES.find((t) => t.id === id);
}

export const TEMPLATE_CATEGORIES_ORDER: TemplateCategory[] = [
  "ancestry",
  "civil",
  "church",
  "census",
  "newspaper",
  "book",
  "oral",
  "custom",
];
