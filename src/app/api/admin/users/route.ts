import { NextResponse } from "next/server";
import { prisma } from "@/lib/database/prisma";
import { withAdminAuth } from "@/lib/infra/api-handler";
import { parseListParams } from "@/lib/admin/admin-list-params";
import bcrypt from "bcryptjs";

export const GET = withAdminAuth(async (req, _user, _ctx) => {
  const { searchParams } = req.nextUrl;
  const q = searchParams.get("q") ?? "";
  const { limit, offset } = parseListParams(searchParams);
  const treeId = process.env.ADMIN_TREE_ID!;

  const where = q
    ? {
        OR: [
          { name: { contains: q, mode: "insensitive" as const } },
          { username: { contains: q, mode: "insensitive" as const } },
          { email: { contains: q, mode: "insensitive" as const } },
        ],
      }
    : {};

  const [users, total] = await Promise.all([
    prisma.user.findMany({
      where,
      skip: offset,
      take: limit,
      orderBy: { createdAt: "desc" },
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
      },
    }),
    prisma.user.count({ where }),
  ]);

  const result = users.map((u) => {
    let role: string = "none";
    if (u.treeOwners.length > 0) role = "owner";
    else if (u.treeMaintainers.length > 0) role = "maintainer";
    else if (u.treeContributors.length > 0) role = "contributor";

    const { treeOwners, treeMaintainers, treeContributors, profile, ...user } = u;
    return { user, role, profile };
  });

  return NextResponse.json({
    users: result,
    total,
    hasMore: offset + limit < total,
  });
});

export const POST = withAdminAuth(async (req, _user, _ctx) => {
  const body = await req.json();
  const { username, email, name, password } = body as {
    username: string;
    email: string;
    name?: string;
    password: string;
  };

  if (!username || !email || !password) {
    return NextResponse.json(
      { error: "username, email, and password are required" },
      { status: 400 },
    );
  }

  const existing = await prisma.user.findFirst({
    where: { OR: [{ username }, { email }] },
  });
  if (existing) {
    return NextResponse.json(
      { error: "A user with that username or email already exists" },
      { status: 409 },
    );
  }

  const passwordHash = await bcrypt.hash(password, 12);

  const user = await prisma.user.create({
    data: { username, email, name: name ?? null, passwordHash },
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

  return NextResponse.json({ user }, { status: 201 });
});
