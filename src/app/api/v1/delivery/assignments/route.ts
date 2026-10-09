import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    const session = await getSession();
    if (!session || (session.role !== "DELIVERY_PARTNER" && session.role !== "ADMIN")) {
      return NextResponse.json(
        { error: "Authentication required as DELIVERY_PARTNER" },
        { status: 401 }
      );
    }

    const partnerId = session.userId;

    const deliveries = await prisma.delivery.findMany({
      where: session.role === "ADMIN" ? {} : { partnerId },
      include: {
        order: {
          include: {
            items: {
              include: {
                product: true,
              },
            },
            store: true,
            customer: {
              include: {
                user: { select: { name: true, phone: true } },
              },
            },
            statusHistory: {
              orderBy: { timestamp: "desc" },
            },
          },
        },
        deliveryPartner: {
          include: {
            user: { select: { name: true, phone: true } },
          },
        },
      },
      orderBy: { deliveryId: "desc" },
    });

    return NextResponse.json({
      success: true,
      data: deliveries,
    });
  } catch (error: any) {
    console.error("[GET /api/v1/delivery/assignments] Error:", error);
    return NextResponse.json(
      { error: error.message || "Failed to fetch delivery assignments" },
      { status: 500 }
    );
  }
}
