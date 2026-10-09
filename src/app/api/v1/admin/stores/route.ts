import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET() {
  try {
    const session = await getSession();
    if (!session || session.role !== "ADMIN") {
      return NextResponse.json(
        { error: "Unauthorized: ADMIN role required" },
        { status: 401 }
      );
    }

    const stores = await prisma.store.findMany({
      include: {
        owner: {
          include: {
            user: true,
          },
        },
      },
      orderBy: { storeId: "asc" },
    });

    return NextResponse.json({
      success: true,
      data: stores,
    });
  } catch (error: any) {
    console.error("[GET /api/v1/admin/stores] Error:", error);
    return NextResponse.json(
      { error: error.message || "Failed to retrieve stores" },
      { status: 500 }
    );
  }
}
