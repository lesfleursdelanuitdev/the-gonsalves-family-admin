import { NextResponse } from "next/server";
import { prisma } from "@/lib/database/prisma";
import { withAdminAuth } from "@/lib/infra/api-handler";
import { getAdminFileUuid } from "@/lib/infra/admin-tree";

export const GET = withAdminAuth(async (_req, _user, ctx) => {
  const { id } = await ctx.params;
  const treeId = process.env.ADMIN_TREE_ID!;
  const fileUuid = await getAdminFileUuid();

  const user = await prisma.user.findUnique({
    where: { id },
    select: {
      id: true,
      username: true,
      email: true,
      name: true,
      isWebsiteOwner: true,
      isActive: true,
      createdAt: true,
      updatedAt: true,
      lastLoginAt: true,
      profile: true,
      treeOwners: { where: { treeId }, take: 1 },
      treeMaintainers: { where: { treeId }, take: 1 },
      treeContributors: { where: { treeId }, take: 1 },
      userIndividualLinks: {
        where: { treeId },
        select: { id: true, individualXref: true, verified: true },
      },
    },
  });

  if (!user) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  let role: string = "none";
  if (user.treeOwners.length > 0) role = "owner";
  else if (user.treeMaintainers.length > 0) role = "maintainer";
  else if (user.treeContributors.length > 0) role = "contributor";

  const { treeOwners, treeMaintainers, treeContributors, profile, userIndividualLinks, ...userData } = user;

  const xrefs = (userIndividualLinks ?? []).map((l) => l.individualXref);
  const individuals =
    xrefs.length > 0
      ? await prisma.gedcomIndividual.findMany({
          where: { fileUuid, xref: { in: xrefs } },
          select: {
            id: true,
            xref: true,
            fullName: true,
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
        })
      : [];
  const individualByXref = Object.fromEntries(individuals.map((i) => [i.xref, i]));

  const links = (userIndividualLinks ?? []).map((l) => {
    const ind = individualByXref[l.individualXref];
    return {
      id: l.id,
      individualId: ind?.id ?? null,
      individualXref: l.individualXref,
      individualName: ind?.fullName ?? null,
      individualNameForms: ind?.individualNameForms ?? null,
      verified: l.verified,
    };
  });

  return NextResponse.json({ user: userData, role, profile, links });
});

export const PATCH = withAdminAuth(async (req, _user, ctx) => {
  const { id } = await ctx.params;
  const body = await req.json();
  const { name, email, isActive } = body as {
    name?: string;
    email?: string;
    isActive?: boolean;
  };

  const data: Record<string, unknown> = {};
  if (name !== undefined) data.name = name;
  if (email !== undefined) data.email = email;
  if (isActive !== undefined) data.isActive = isActive;

  if (Object.keys(data).length === 0) {
    return NextResponse.json({ error: "No fields to update" }, { status: 400 });
  }

  const user = await prisma.user.update({
    where: { id },
    data,
    select: {
      id: true,
      username: true,
      email: true,
      name: true,
      isWebsiteOwner: true,
      isActive: true,
      createdAt: true,
      updatedAt: true,
    },
  });

  return NextResponse.json({ user });
});

export const DELETE = withAdminAuth(async (_req, _user, ctx) => {
  const { id } = await ctx.params;

  const user = await prisma.user.update({
    where: { id },
    data: { isActive: false },
    select: {
      id: true,
      username: true,
      email: true,
      isActive: true,
    },
  });

  return NextResponse.json({ user });
});
