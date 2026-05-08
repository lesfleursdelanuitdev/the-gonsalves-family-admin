import type { Prisma } from "@ligneous/prisma";

type Tx = Prisma.TransactionClient;

/**
 * Keeps NL-oriented denormalized columns on `gedcom_individuals_v2` aligned with
 * linked places, years, and the primary name form's first surname.
 */
export async function syncIndividualNlDenormFields(tx: Tx, individualId: string): Promise<void> {
  const ind = await tx.gedcomIndividual.findUnique({
    where: { id: individualId },
    select: {
      birthPlaceId: true,
      deathPlaceId: true,
      birthYear: true,
      deathYear: true,
    },
  });
  if (!ind) return;

  const [birthP, deathP] = await Promise.all([
    ind.birthPlaceId
      ? tx.gedcomPlace.findUnique({
          where: { id: ind.birthPlaceId },
          select: { country: true },
        })
      : null,
    ind.deathPlaceId
      ? tx.gedcomPlace.findUnique({
          where: { id: ind.deathPlaceId },
          select: { country: true },
        })
      : null,
  ]);

  const primaryForm = await tx.gedcomIndividualNameForm.findFirst({
    where: { individualId, isPrimary: true },
    select: {
      surnames: {
        where: { position: 1 },
        take: 1,
        select: { surname: { select: { surnameLower: true } } },
      },
    },
    orderBy: { sortOrder: "asc" },
  });
  const piece = primaryForm?.surnames?.[0];
  const primarySurnameLower = piece?.surname?.surnameLower ?? null;

  const trimCountry = (c: string | null | undefined) => {
    const t = typeof c === "string" ? c.trim() : "";
    return t.length > 0 ? t : null;
  };

  const bc = trimCountry(birthP?.country ?? undefined);
  const dc = trimCountry(deathP?.country ?? undefined);

  let ageAtDeath: number | null = null;
  const by = ind.birthYear;
  const dy = ind.deathYear;
  if (by != null && dy != null && dy > by) ageAtDeath = dy - by;

  await tx.gedcomIndividual.update({
    where: { id: individualId },
    data: {
      primarySurnameLower,
      birthCountry: bc,
      birthCountryLower: bc != null ? bc.toLowerCase() : null,
      deathCountry: dc,
      deathCountryLower: dc != null ? dc.toLowerCase() : null,
      ageAtDeath,
    },
  });
}

/** Replace `gedcom_family_partners_v2` rows for a family from current husband_id / wife_id. */
export async function syncGedcomFamilyPartnersForFamily(tx: Tx, familyId: string): Promise<void> {
  const fam = await tx.gedcomFamily.findUnique({
    where: { id: familyId },
    select: { fileUuid: true, husbandId: true, wifeId: true },
  });
  if (!fam) return;

  await tx.gedcomFamilyPartner.deleteMany({ where: { familyId } });

  const rows: Array<{ fileUuid: string; familyId: string; individualId: string }> = [];
  if (fam.husbandId) rows.push({ fileUuid: fam.fileUuid, familyId, individualId: fam.husbandId });
  if (fam.wifeId) rows.push({ fileUuid: fam.fileUuid, familyId, individualId: fam.wifeId });
  if (!rows.length) return;

  await tx.gedcomFamilyPartner.createMany({ data: rows });
}
