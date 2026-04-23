import { NextResponse } from "next/server";
import { prisma } from "@/lib/database/prisma";
import { requireAuth } from "@/lib/infra/auth";

export async function GET() {
  try {
    const sessionUser = await requireAuth();

    const profile = await prisma.userProfile.findUnique({
      where: { userId: sessionUser.id },
    });

    return NextResponse.json({ user: sessionUser, profile });
  } catch (e: unknown) {
    if (e instanceof Error && e.message === "Unauthorized") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    console.error("My profile error:", e);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function PATCH(req: Request) {
  try {
    const sessionUser = await requireAuth();
    const body = await req.json();

    const allowedFields = [
      "displayName", "bio", "location", "profilePhotoUrl", "coverPhotoUrl",
      "researchSurnames", "researchLocations", "researchTimePeriods", "researchGoals",
      "yearsResearching", "specializations", "certifications", "languages",
      "profileVisibility", "activityVisibility", "allowDirectMessages", "allowFollowing",
    ] as const;

    const data: Record<string, unknown> = {};
    for (const key of allowedFields) {
      if (key in body) data[key] = body[key];
    }

    const profile = await prisma.userProfile.upsert({
      where: { userId: sessionUser.id },
      create: { userId: sessionUser.id, ...data },
      update: data,
    });

    return NextResponse.json({ profile });
  } catch (e: unknown) {
    if (e instanceof Error && e.message === "Unauthorized") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    console.error("Update profile error:", e);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
