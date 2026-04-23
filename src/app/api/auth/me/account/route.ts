import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/database/prisma";
import { requireAuth } from "@/lib/infra/auth";

const MIN_PASSWORD_LENGTH = 8;
const MAX_PASSWORD_LENGTH = 128;

export async function PATCH(req: Request) {
  try {
    const sessionUser = await requireAuth();
    const body = await req.json();

    const updates: Record<string, unknown> = {};
    if (body.name !== undefined) updates.name = body.name;
    if (body.email !== undefined) updates.email = body.email;

    const wantsPasswordChange =
      body.newPassword != null && String(body.newPassword).length > 0;

    if (wantsPasswordChange) {
      const newPassword = String(body.newPassword);
      if (newPassword.length < MIN_PASSWORD_LENGTH) {
        return NextResponse.json(
          { error: `New password must be at least ${MIN_PASSWORD_LENGTH} characters` },
          { status: 400 },
        );
      }
      if (newPassword.length > MAX_PASSWORD_LENGTH) {
        return NextResponse.json({ error: "New password is too long" }, { status: 400 });
      }
      if (!body.currentPassword || String(body.currentPassword).length === 0) {
        return NextResponse.json({ error: "Current password is required to change password" }, { status: 400 });
      }
      const user = await prisma.user.findUnique({ where: { id: sessionUser.id } });
      if (!user) {
        return NextResponse.json({ error: "User not found" }, { status: 404 });
      }
      const valid = await bcrypt.compare(String(body.currentPassword), user.passwordHash);
      if (!valid) {
        return NextResponse.json({ error: "Current password is incorrect" }, { status: 400 });
      }
      updates.passwordHash = await bcrypt.hash(newPassword, 12);
    }

    if (Object.keys(updates).length === 0) {
      return NextResponse.json({ error: "No fields to update" }, { status: 400 });
    }

    const updated = await prisma.user.update({
      where: { id: sessionUser.id },
      data: updates,
      select: { id: true, username: true, email: true, name: true },
    });

    return NextResponse.json({ user: updated });
  } catch (e: unknown) {
    if (e instanceof Error && e.message === "Unauthorized") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    console.error("Update account error:", e);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
