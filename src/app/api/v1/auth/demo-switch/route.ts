import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import {
  isDemoMode,
  getDemoPersona,
  signSessionToken,
  AUTH_COOKIE_NAME,
  UserSessionPayload,
} from "@/lib/auth";

import { prisma } from "@/lib/prisma";

const SwitchRoleSchema = z.object({
  role: z.enum(["CUSTOMER", "STORE_OWNER", "DELIVERY_PARTNER", "ADMIN"]),
  email: z.string().email().optional(),
  userId: z.number().int().optional(),
  storeId: z.number().int().optional(),
});

export async function POST(request: NextRequest) {
  try {
    if (!isDemoMode()) {
      return NextResponse.json(
        { error: "Forbidden: Demo mode is not enabled on this deployment" },
        { status: 403 }
      );
    }

    const body = await request.json();
    const parsed = SwitchRoleSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid parameters specified for demo switch", details: parsed.error.format() },
        { status: 400 }
      );
    }

    const { role, email, userId, storeId } = parsed.data;

    let targetEmailOrId: string | number | undefined = email || userId;

    // If storeId is provided for STORE_OWNER, find that store's owner
    if (storeId && role === "STORE_OWNER") {
      const store = await prisma.store.findUnique({
        where: { storeId },
        select: { ownerId: true },
      });
      if (store) {
        targetEmailOrId = store.ownerId;
      }
    }

    const persona = await getDemoPersona(
      role as UserSessionPayload["role"],
      targetEmailOrId
    );

    if (!persona) {
      return NextResponse.json(
        { error: `No seeded user found for demo role '${role}'. Please run db:seed first.` },
        { status: 404 }
      );
    }

    const token = await signSessionToken(persona);

    const response = NextResponse.json({
      success: true,
      message: `Switched demo persona to ${persona.name} [${persona.role}]`,
      user: persona,
    });

    response.cookies.set({
      name: AUTH_COOKIE_NAME,
      value: token,
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      path: "/",
      sameSite: "lax",
      maxAge: 60 * 60 * 24, // 24 hours
    });

    return response;
  } catch (error: any) {
    console.error("[POST /api/v1/auth/demo-switch] Error:", error);
    return NextResponse.json(
      { error: error.message || "Failed to switch demo role" },
      { status: 500 }
    );
  }
}
