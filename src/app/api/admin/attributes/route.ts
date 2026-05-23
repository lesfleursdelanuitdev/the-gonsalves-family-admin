import { NextResponse } from "next/server";
import { prisma } from "@/lib/database/prisma";
import { withAdminAuth } from "@/lib/infra/api-handler";
import { getAdminFileUuid } from "@/lib/infra/admin-tree";
import { parseListParams } from "@/lib/admin/admin-list-params";
import { requireCan } from "@/lib/authz/routeGuards";
import {
  findOrCreateGedcomDate,
  findOrCreateGedcomPlace,
  parseDateInput,
  parsePlaceInput,
} from "@/lib/admin/admin-event-create";
import { gedcomIndividualNlDenormSelect } from "@/lib/gedcom/gedcom-individual-nl-select";

const ATTRIBUTE_LIST_INCLUDE = {
  date: true,
  place: true,
  individualAttributes: {
    include: {
      individual: {
        select: {
          id: true,
          fullName: true,
          ...gedcomIndividualNlDenormSelect,
          individualNameForms: {
            where: { isPrimary: true },
            take: 1,
            select: {
              givenNames: {
                orderBy: { position: "asc" as const },
                select: { givenName: { select: { givenName: true } } },
              },
              surnames: {
                orderBy: { position: "asc" as const },
                select: { surname: { select: { surname: true } } },
              },
            },
          },
        },
      },
    },
  },
  familyAttributes: {
    include: {
      family: {
        select: {
          id: true,
          xref: true,
          husband: { select: { id: true, fullName: true, ...gedcomIndividualNlDenormSelect } },
          wife: { select: { id: true, fullName: true, ...gedcomIndividualNlDenormSelect } },
        },
      },
    },
  },
} as const;

export const GET = withAdminAuth(async (req, _user, _ctx) => {
  await requireCan({ entity: "event", action: "read", scope: "tree" });
  const fileUuid = await getAdminFileUuid();
  const { searchParams } = req.nextUrl;
  const { limit, offset } = parseListParams(searchParams);

  const where: Record<string, unknown> = { fileUuid };

  const at = searchParams.get("attributeType")?.trim();
  if (at) where.attributeType = at;

  const ctc = searchParams.get("customTypeContains")?.trim();
  if (ctc) where.customType = { contains: ctc, mode: "insensitive" };

  const vc = searchParams.get("valueContains")?.trim();
  if (vc) where.value = { contains: vc, mode: "insensitive" };

  const linkType = searchParams.get("linkType")?.trim();
  const linkedGiven = searchParams.get("linkedGiven")?.trim().toLowerCase();
  const linkedLast = searchParams.get("linkedLast")?.trim();

  if (linkType === "individual" || (linkedGiven || linkedLast)) {
    const nameConds: unknown[] = [];
    if (linkedGiven) {
      nameConds.push({
        individualAttributes: {
          some: {
            individual: {
              individualNameForms: {
                some: {
                  givenNames: {
                    some: { givenName: { givenNameLower: { contains: linkedGiven } } },
                  },
                },
              },
            },
          },
        },
      });
    }
    if (linkedLast) {
      nameConds.push({
        individualAttributes: {
          some: {
            individual: {
              individualNameForms: {
                some: {
                  surnames: {
                    some: {
                      surname: { surnameLower: { startsWith: linkedLast.toLowerCase() } },
                    },
                  },
                },
              },
            },
          },
        },
      });
    }
    if (linkType === "individual" && nameConds.length === 0) {
      where.individualAttributes = { some: {} };
    } else if (nameConds.length > 0) {
      (where as Record<string, unknown>).AND = nameConds;
    }
  } else if (linkType === "family") {
    where.familyAttributes = { some: {} };
  }

  const placeContains = searchParams.get("placeContains")?.trim();
  if (placeContains) {
    where.place = { original: { contains: placeContains, mode: "insensitive" } };
  }

  const [attributes, total] = await Promise.all([
    prisma.gedcomAttribute.findMany({
      where,
      include: ATTRIBUTE_LIST_INCLUDE,
      orderBy: { createdAt: "desc" },
      take: limit,
      skip: offset,
    }),
    prisma.gedcomAttribute.count({ where }),
  ]);

  return NextResponse.json({ attributes, total, hasMore: offset + attributes.length < total });
});

export const POST = withAdminAuth(async (req, _user, _ctx) => {
  await requireCan({ entity: "event", action: "create", scope: "tree" });
  const fileUuid = await getAdminFileUuid();
  const body = (await req.json()) as Record<string, unknown>;

  const attributeType = typeof body.attributeType === "string" ? body.attributeType.trim() : "";
  if (!attributeType) {
    return NextResponse.json({ error: "attributeType is required" }, { status: 400 });
  }

  const customType =
    typeof body.customType === "string" && body.customType.trim() ? body.customType.trim() : null;
  const value =
    typeof body.value === "string" && body.value.trim() ? body.value.trim() : null;
  const agency =
    typeof body.agency === "string" && body.agency.trim() ? body.agency.trim() : null;

  const dateParsed = parseDateInput(body.date);
  const placeParsed = parsePlaceInput(body.place);

  const individualIds: string[] = Array.isArray(body.individualIds)
    ? (body.individualIds as unknown[]).filter((x): x is string => typeof x === "string")
    : [];
  const familyIds: string[] = Array.isArray(body.familyIds)
    ? (body.familyIds as unknown[]).filter((x): x is string => typeof x === "string")
    : [];

  const attribute = await prisma.$transaction(async (tx) => {
    const dateId = dateParsed ? await findOrCreateGedcomDate(tx, fileUuid, dateParsed) : null;
    const placeId = placeParsed ? await findOrCreateGedcomPlace(tx, fileUuid, placeParsed) : null;

    const created = await tx.gedcomAttribute.create({
      data: { fileUuid, attributeType, customType, value, agency, dateId, placeId },
      include: { date: true, place: true },
    });

    for (const iid of individualIds) {
      const ok = await tx.gedcomIndividual.findFirst({ where: { id: iid, fileUuid }, select: { id: true } });
      if (!ok) throw new Error(`INVALID_INDIVIDUAL:${iid}`);
      await tx.gedcomIndividualAttribute.create({
        data: { fileUuid, individualId: iid, attributeId: created.id },
      });
    }
    for (const fid of familyIds) {
      const ok = await tx.gedcomFamily.findFirst({ where: { id: fid, fileUuid }, select: { id: true } });
      if (!ok) throw new Error(`INVALID_FAMILY:${fid}`);
      await tx.gedcomFamilyAttribute.create({
        data: { fileUuid, familyId: fid, attributeId: created.id },
      });
    }

    return created;
  }).catch((e) => {
    const msg = e instanceof Error ? e.message : "";
    if (msg.startsWith("INVALID_INDIVIDUAL:")) throw Object.assign(new Error("bad_individual"), { code: "bad_individual" });
    if (msg.startsWith("INVALID_FAMILY:")) throw Object.assign(new Error("bad_family"), { code: "bad_family" });
    throw e;
  });

  const full = await prisma.gedcomAttribute.findFirst({
    where: { id: attribute.id, fileUuid },
    include: ATTRIBUTE_LIST_INCLUDE,
  });
  return NextResponse.json({ attribute: full ?? attribute }, { status: 201 });
});
