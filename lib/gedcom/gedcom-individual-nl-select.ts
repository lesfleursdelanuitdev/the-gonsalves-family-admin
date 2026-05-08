/**
 * NL query denormalized scalars on `GedcomIndividual` — merge into `select` payloads (additive APIs).
 */
export const gedcomIndividualNlDenormSelect = {
  primarySurnameLower: true,
  birthCountry: true,
  birthCountryLower: true,
  deathCountry: true,
  deathCountryLower: true,
  ageAtDeath: true,
  generationDepth: true,
} as const;
