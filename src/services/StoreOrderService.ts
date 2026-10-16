import { prisma } from "@/lib/prisma";
import { clock } from "@/lib/clock";
import { notificationService } from "./NotificationService";
import { paymentService } from "./PaymentService";

export class StoreOrderService {
  /**
   * Retrieves orders for a specific store.
   */
  async getStoreOrders(storeId: number) {
    const now = clock.now();

    const orders = await prisma.order.findMany({
      where: { storeId },
      include: {
        items: {
          include: {
            product: true,
          },
        },
        customer: {
          include: {
            user: { select: { name: true, email: true, phone: true } },
          },
        },
        delivery: {
          include: {
            deliveryPartner: {
              include: {
                user: { select: { name: true, phone: true } },
              },
            },
          },
        },
        payment: true,
        statusHistory: {
          orderBy: { timestamp: "desc" },
        },
      },
      orderBy: { orderDate: "desc" },
    });

    return orders.map((ord) => {
      // 15-minute response countdown from orderDate
      const orderTime = new Date(ord.orderDate).getTime();
      const expiryTime = orderTime + 15 * 60 * 1000;
      const remainingSeconds = Math.max(
        0,
        Math.floor((expiryTime - now.getTime()) / 1000)
      );
      const isResponseExpired = remainingSeconds <= 0 && ord.status === "CONFIRMED";

      return {
        ...ord,
        remainingSeconds,
        isResponseExpired,
      };
    });
  }

  /**
   * Store owner accepts order: CONFIRMED -> PREPARING
   */
  async acceptOrder(orderId: number, storeId: number) {
    const order = await prisma.order.findUnique({
      where: { orderId },
      include: { store: true },
    });

    if (!order) throw new Error("Order not found");
    if (order.storeId !== storeId) {
      throw new Error("Unauthorized: order belongs to another store");
    }

    if (order.status !== "CONFIRMED") {
      throw new Error(
        `Cannot accept order in status '${order.status}' (must be CONFIRMED)`
      );
    }

    const now = clock.now();

    await prisma.$transaction([
      prisma.order.update({
        where: { orderId },
        data: { status: "PREPARING" },
      }),
      prisma.orderStatusHistory.create({
        data: {
          orderId,
          status: "PREPARING",
          note: `Accepted by store ${order.store.storeName}. Preparing order items.`,
          timestamp: now,
        },
      }),
    ]);

    // Send customer notification
    await notificationService.sendNotification({
      userId: order.customerId,
      type: "ORDER_STATUS",
      message: `Your order #${order.orderNumber} has been accepted by ${order.store.storeName} and is now being prepared.`,
      correlationId: order.correlationId ?? undefined,
    });

    return { success: true, orderId, status: "PREPARING" };
  }

  /**
   * Store owner rejects order: CANCELLED + Payment REFUNDED + stock restored
   */
  async rejectOrder(orderId: number, storeId: number, reason = "Store unable to fulfill") {
    const order = await prisma.order.findUnique({
      where: { orderId },
      include: {
        items: true,
        payment: true,
        store: true,
        delivery: true,
      },
    });

    if (!order) throw new Error("Order not found");
    if (order.storeId !== storeId) {
      throw new Error("Unauthorized: order belongs to another store");
    }

    if (order.status !== "CONFIRMED") {
      throw new Error(
        `Cannot reject order in status '${order.status}' (must be CONFIRMED)`
      );
    }

    const now = clock.now();

    await prisma.$transaction(async (tx) => {
      // 1. Cancel order
      await tx.order.update({
        where: { orderId },
        data: { status: "CANCELLED" },
      });

      await tx.orderStatusHistory.create({
        data: {
          orderId,
          status: "CANCELLED",
          note: `Rejected by store: ${reason}. Payment refunded.`,
          timestamp: now,
        },
      });

      // 2. Refund payment if paid and successful
      if (order.payment && order.payment.status === "SUCCESSFUL") {
        await tx.payment.update({
          where: { paymentId: order.payment.paymentId },
          data: { status: "REFUNDED" },
        });
      }

      // 3. Cancel delivery if created
      if (order.delivery) {
        await tx.delivery.update({
          where: { deliveryId: order.delivery.deliveryId },
          data: { status: "CANCELLED" },
        });
      }

      // 4. Restore inventory for all items
      for (const item of order.items) {
        const inv = await tx.inventoryItem.findUnique({
          where: { productId: item.productId },
        });
        if (inv) {
          const newQty = inv.quantity + item.quantity;
          await tx.inventoryItem.update({
            where: { inventoryId: inv.inventoryId },
            data: { quantity: newQty },
          });

          // Ensure product status is ACTIVE
          await tx.product.update({
            where: { productId: item.productId },
            data: { status: "ACTIVE" },
          });
        }
      }
    });

    // Notify customer
    await notificationService.sendNotification({
      userId: order.customerId,
      type: "ORDER_CANCELLED",
      message: `Your order #${order.orderNumber} was declined by ${order.store.storeName} (${reason}). Full refund of ₹${order.totalAmount} has been processed.`,
      correlationId: order.correlationId ?? undefined,
    });

    return { success: true, orderId, status: "CANCELLED", refundedAmount: order.totalAmount };
  }

  /**
   * Sweeper: auto-cancels and refunds orders if store does not respond within 15 minutes
   */
  async sweepUnrespondedOrders(timeoutMinutes = 15) {
    const now = clock.now();
    const cutoff = new Date(now.getTime() - timeoutMinutes * 60 * 1000);

    const expiredOrders = await prisma.order.findMany({
      where: {
        status: "CONFIRMED",
        orderDate: { lte: cutoff },
      },
    });

    const sweptResults = [];
    for (const ord of expiredOrders) {
      try {
        const res = await this.rejectOrder(
          ord.orderId,
          ord.storeId,
          "Store response timeout (exceeded 15 minutes)"
        );
        sweptResults.push(res);
      } catch (err: any) {
        console.error(`[Sweeper] Failed to auto-cancel order ${ord.orderId}:`, err);
      }
    }

    return { sweptCount: sweptResults.length, results: sweptResults };
  }
}

export const storeOrderService = new StoreOrderService();
