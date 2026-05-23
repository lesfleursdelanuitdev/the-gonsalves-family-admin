import { NextResponse } from "next/server";
import { prisma } from "@/lib/database/prisma";
import { withAdminAuth } from "@/lib/infra/api-handler";
import { getAdminFileUuid } from "@/lib/infra/admin-tree";
import { requireCan } from "@/lib/authz/routeGuards";
import {
  findOrCreateGedcomDate,
  findOrCreateGedcomPlace,
  parseDateInput,
  parsePlaceInput,
} from "@/lib/admin/admin-event-create";
import { gedcomIndividualNlDenormSelect } from "@/lib/gedcom/gedcom-individual-nl-select";

const ATTRIBUTE_DETAIL_INCLUDE = {
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

export const GET = withAdminAuth(async (_req, _user, ctx) => {
  await requireCan({ entity: "event", action: "read", scope: "tree" });
  const { id } = await ctx.params;
  const fileUuid = await getAdminFileUuid();

  const attribute = await prisma.gedcomAttribute.findFirst({
    where: { id, fileUuid },
    include: ATTRIBUTE_DETAIL_INCLUDE,
  });

  if (!attribute) return NextResponse.json({ error: "Attribute not found" }, { status: 404 });
  return NextResponse.json({ attribute });
});

export const PATCH = withAdminAuth(async (req, _user, ctx) => {
  await requireCan({ entity: "event", action: "update", scope: "tree" });
  const { id } = await ctx.params;
  const fileUuid = await getAdminFileUuid();
  const body = (await req.json()) as Record<string, unknown>;

  const existing = await prisma.gedcomAttribute.findFirst({ where: { id, fileUuid } });
  if (!existing) return NextResponse.json({ error: "Attribute not found" }, { status: 404 });

  const attributeType =
    typeof body.attributeType === "string" ? body.attributeType.trim() : existing.attributeType;
  if (!attributeType) return NextResponse.json({ error: "attributeType is required" }, { status: 400 });

  const customType =
    body.customType === null ? null
    : typeof body.customType === "string" && body.customType.trim() ? body.customType.trim()
    : existing.customType;
  const value =
    body.value === null ? null
    : typeof body.value === "string" ? (body.value.trim() || null)
    : existing.value;
  const agency =
    body.agency === null ? null
    : typeof body.agency === "string" ? (body.agency.trim() || null)
    : existing.agency;

  await prisma.$transaction(async (tx) => {
    let dateId: string | null = existing.dateId;
    if ("date" in body) {
      if (body.date === null) {
        dateId = null;
      } else {
        const p = parseDateInput(body.date);
        dateId = p ? await findOrCreateGedcomDate(tx, fileUuid, p) : null;
      }
    }

    let placeId: string | null = existing.placeId;
    if ("place" in body) {
      if (body.place === null) {
        placeId = null;
      } else {
        const p = parsePlaceInput(body.place);
        placeId = p ? await findOrCreateGedcomPlace(tx, fileUuid, p) : null;
      }
    }

    if ("links" in body) {
      const rawLinks = body.links as Record<string, unknown> | null | undefined;
      const individualIds: string[] = Array.isArray(rawLinks?.individualIds)
        ? (rawLinks!.individualIds as unknown[]).filter((x): x is string => typeof x === "string")
        : [];
      const familyIds: string[] = Array.isArray(rawLinks?.familyIds)
        ? (rawLinks!.familyIds as unknown[]).filter((x): x is string => typeof x === "string")
        : [];

      for (const iid of individualIds) {
        const ok = await tx.gedcomIndividual.findFirst({ where: { id: iid, fileUuid }, select: { id: true } });
        if (!ok) throw new Error(`INVALID_INDIVIDUAL:${iid}`);
      }
      for (const fid of familyIds) {
        const ok = await tx.gedcomFamily.findFirst({ where: { id: fid, fileUuid }, select: { id: true } });
        if (!ok) throw new Error(`INVALID_FAMILY:${fid}`);
      }

      await tx.gedcomIndividualAttribute.deleteMany({ where: { attributeId: id } });
      await tx.gedcomFamilyAttribute.deleteMany({ where: { attributeId: id } });

      for (const iid of individualIds) {
        await tx.gedcomIndividualAttribute.create({
          data: { fileUuid, individualId: iid, attributeId: id },
        });
      }
      for (const fid of familyIds) {
        await tx.gedcomFamilyAttribute.create({
          data: { fileUuid, familyId: fid, attributeId: id },
        });
      }
    }

    await tx.gedcomAttribute.update({
      where: { id },
      data: { attributeType, customType, value, agency, dateId, placeId },
    });
  });

  const attribute = await prisma.gedcomAttribute.findFirst({
    where: { id, fileUuid },
    include: ATTRIBUTE_DETAIL_INCLUDE,
  });
  return NextResponse.json({ attribute });
});

export const DELETE = withAdminAuth(async (_req, _user, ctx) => {
  await requireCan({ entity: "event", action: "delete", scope: "tree" });
  const { id } = await ctx.params;
  const fileUuid = await getAdminFileUuid();

  const existing = await prisma.gedcomAttribute.findFirst({
    where: { id, fileUuid },
    select: { id: true },
  });
  if (!existing) return NextResponse.json({ error: "Attribute not found" }, { status: 404 });

  await prisma.$transaction(async (tx) => {
    await tx.gedcomIndividualAttribute.deleteMany({ where: { attributeId: id } });
    await tx.gedcomFamilyAttribute.deleteMany({ where: { attributeId: id } });
    await tx.gedcomAttributeNote.deleteMany({ where: { attributeId: id } });
    await tx.gedcomAttributeSource.deleteMany({ where: { attributeId: id } });
    await tx.gedcomAttributeMedia.deleteMany({ where: { attributeId: id } });
    await tx.gedcomAttribute.delete({ where: { id } });
  });

  return NextResponse.json({ success: true });
});
