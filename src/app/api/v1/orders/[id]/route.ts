import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: "Authentication required" }, { status: 401 });
    }

    const orderId = parseInt(params.id, 10);
    if (isNaN(orderId)) {
      return NextResponse.json({ error: "Invalid order ID" }, { status: 400 });
    }

    const order = await prisma.order.findUnique({
      where: { orderId },
      include: {
        items: {
          include: {
            product: true,
          },
        },
        store: true,
        payment: true,
        delivery: true,
        customer: {
          include: {
            user: { select: { name: true, email: true, phone: true } },
          },
        },
        statusHistory: {
          orderBy: { timestamp: "desc" },
        },
      },
    });

    if (!order) {
      return NextResponse.json({ error: "Order not found" }, { status: 404 });
    }

    // Role ownership check
    if (session.role === "CUSTOMER" && order.customerId !== session.userId) {
      return NextResponse.json({ error: "Unauthorized access to order" }, { status: 403 });
    }

    if (session.role === "STORE_OWNER") {
      const store = await prisma.store.findUnique({
        where: { storeId: order.storeId },
        select: { ownerId: true },
      });
      if (store?.ownerId !== session.userId) {
        return NextResponse.json({ error: "Unauthorized access to order" }, { status: 403 });
      }
    }

    return NextResponse.json({
      success: true,
      data: order,
    });
  } catch (error: any) {
    console.error("[GET /api/v1/orders/[id]] Error:", error);
    return NextResponse.json(
      { error: error.message || "Failed to fetch order details" },
      { status: 500 }
    );
  }
}
