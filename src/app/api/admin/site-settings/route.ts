import { NextResponse } from "next/server";
import { prisma } from "@/lib/database/prisma";
import { withAdminAuth } from "@/lib/infra/api-handler";
import { getAdminTreeId } from "@/lib/infra/admin-tree";
import { getAdminTreeReadScope } from "@/lib/infra/admin-tree-access";
import { requireCan } from "@/lib/authz/routeGuards";

export const GET = withAdminAuth(async (_req, user) => {
  const { treeId } = await getAdminTreeReadScope(user);
  await requireCan({ entity: "tree", action: "read", scope: "tree", treeId });

  const settings = await prisma.treeSettings.findUnique({ where: { treeId } });

  return NextResponse.json({
    settings: settings
      ? {
          id: settings.id,
          treeId: settings.treeId,
          publicBaseUrl: settings.publicBaseUrl,
          siteName: settings.siteName,
          siteTagline: settings.siteTagline,
          contactEmail: settings.contactEmail,
          logoMediaId: settings.logoMediaId,
          logoMediaKind: settings.logoMediaKind,
          socialLinks: settings.socialLinks as Record<string, string> | null,
          defaultLanguage: settings.defaultLanguage,
          updatedAt: settings.updatedAt.toISOString(),
        }
      : {
          id: null,
          treeId,
          publicBaseUrl: null,
          siteName: null,
          siteTagline: null,
          contactEmail: null,
          logoMediaId: null,
          logoMediaKind: null,
          socialLinks: null,
          defaultLanguage: null,
          updatedAt: null,
        },
  });
});

export const PATCH = withAdminAuth(async (req, user) => {
  const treeId = await getAdminTreeId();
  await requireCan({ entity: "tree", action: "update", scope: "tree", treeId });
  void user;

  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  const data: Record<string, unknown> = {};

  if (body.publicBaseUrl !== undefined) data.publicBaseUrl = typeof body.publicBaseUrl === "string" ? body.publicBaseUrl.trim() || null : null;
  if (body.siteName !== undefined) data.siteName = typeof body.siteName === "string" ? body.siteName.trim() || null : null;
  if (body.siteTagline !== undefined) data.siteTagline = typeof body.siteTagline === "string" ? body.siteTagline.trim() || null : null;
  if (body.contactEmail !== undefined) data.contactEmail = typeof body.contactEmail === "string" ? body.contactEmail.trim() || null : null;
  if (body.logoMediaId !== undefined) data.logoMediaId = body.logoMediaId ?? null;
  if (body.logoMediaKind !== undefined) data.logoMediaKind = body.logoMediaKind ?? null;
  if (body.socialLinks !== undefined) data.socialLinks = body.socialLinks && typeof body.socialLinks === "object" ? body.socialLinks : null;
  if (body.defaultLanguage !== undefined) data.defaultLanguage = typeof body.defaultLanguage === "string" ? body.defaultLanguage.trim() || null : null;

  const settings = await prisma.treeSettings.upsert({
    where: { treeId },
    update: data,
    create: { treeId, ...data },
  });

  return NextResponse.json({
    settings: {
      id: settings.id,
      treeId: settings.treeId,
      publicBaseUrl: settings.publicBaseUrl,
      siteName: settings.siteName,
      siteTagline: settings.siteTagline,
      contactEmail: settings.contactEmail,
      logoMediaId: settings.logoMediaId,
      logoMediaKind: settings.logoMediaKind,
      socialLinks: settings.socialLinks as Record<string, string> | null,
      defaultLanguage: settings.defaultLanguage,
      updatedAt: settings.updatedAt.toISOString(),
    },
  });
});
