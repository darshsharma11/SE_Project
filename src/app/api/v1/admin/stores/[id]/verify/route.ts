import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { StoreRepository } from "@/repositories/StoreRepository";
import { Administrator } from "@/domain/Administrator";

export async function POST(
  _request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getSession();
    if (!session || session.role !== "ADMIN") {
      return NextResponse.json(
        { error: "Unauthorized: ADMIN role required" },
        { status: 401 }
      );
    }

    const storeId = Number(params.id);
    if (isNaN(storeId) || storeId <= 0) {
      return NextResponse.json(
        { error: "Invalid store ID parameter" },
        { status: 400 }
      );
    }

    const storeRow = await prisma.store.findUnique({
      where: { storeId },
    });

    if (!storeRow) {
      return NextResponse.json(
        { error: "Store not found" },
        { status: 404 }
      );
    }

    const storeDomain = StoreRepository.toDomain(storeRow);
    const admin = new Administrator({
      userId: session.userId,
      name: session.name,
      email: session.email,
      passwordHash: "",
      phone: "",
      adminId: session.userId,
    });

    // Diagram method: verifyStore()
    admin.verifyStore(storeDomain);

    const updated = await prisma.store.update({
      where: { storeId },
      data: { status: storeDomain.status },
    });

    return NextResponse.json({
      success: true,
      message: `Store '${updated.storeName}' verified successfully.`,
      data: updated,
    });
  } catch (error: any) {
    console.error("[POST /api/v1/admin/stores/:id/verify] Error:", error);
    return NextResponse.json(
      { error: error.message || "Failed to verify store" },
      { status: 500 }
    );
  }
}
