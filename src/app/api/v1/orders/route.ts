import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";

export async function GET(request: NextRequest) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: "Authentication required" }, { status: 401 });
    }

    let orders: any[] = [];

    if (session.role === "CUSTOMER") {
      orders = await prisma.order.findMany({
        where: { customerId: session.userId },
        include: {
          items: {
            include: {
              product: {
                select: { productId: true, name: true, category: true },
              },
            },
          },
          store: {
            select: { storeId: true, storeName: true, address: true },
          },
          payment: true,
          delivery: true,
          statusHistory: {
            orderBy: { timestamp: "desc" },
          },
        },
        orderBy: { orderDate: "desc" },
      });
    } else if (session.role === "STORE_OWNER") {
      const stores = await prisma.store.findMany({
        where: { ownerId: session.userId },
        select: { storeId: true },
      });
      const storeIds = stores.map((s) => s.storeId);

      orders = await prisma.order.findMany({
        where: { storeId: { in: storeIds } },
        include: {
          items: {
            include: {
              product: {
                select: { productId: true, name: true, category: true },
              },
            },
          },
          customer: {
            include: {
              user: {
                select: { name: true, email: true, phone: true },
              },
            },
          },
          payment: true,
          delivery: true,
        },
        orderBy: { orderDate: "desc" },
      });
    } else if (session.role === "ADMIN") {
      orders = await prisma.order.findMany({
        include: {
          items: true,
          store: true,
          customer: {
            include: {
              user: { select: { name: true, email: true } },
            },
          },
          payment: true,
        },
        orderBy: { orderDate: "desc" },
      });
    }

    return NextResponse.json({
      success: true,
      data: orders,
    });
  } catch (error: any) {
    console.error("[GET /api/v1/orders] Error:", error);
    return NextResponse.json(
      { error: error.message || "Failed to fetch orders" },
      { status: 500 }
    );
  }
}
