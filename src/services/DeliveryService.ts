import { prisma } from "@/lib/prisma";
import { clock } from "@/lib/clock";
import { trace } from "@/lib/trace";
import { notificationService } from "./NotificationService";
import { Delivery, DeliveryStatus } from "@/domain/Delivery";

export class DeliveryService {
  /**
   * Sequence Step 32: createDelivery()
   * Order / Service -> Delivery
   */
  async createDelivery(params: {
    orderId: number;
    deliveryAddress: string;
    correlationId?: string;
  }) {
    const { orderId, deliveryAddress } = params;
    const now = clock.now();
    const correlationId = params.correlationId ?? `delivery-${orderId}-${Date.now()}`;

    // Step 32: Order -> Delivery createDelivery()
    await trace.step({
      correlationId,
      stepNumber: 32,
      label: "createDelivery()",
      from: "Order",
      to: "Delivery",
      details: { orderId, deliveryAddress },
    });

    const trackingNumber = `TRK-${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, "0")}${String(now.getDate()).padStart(2, "0")}-${orderId}-${Math.floor(1000 + Math.random() * 9000)}`;

    const deliveryRow = await prisma.delivery.create({
      data: {
        orderId,
        deliveryAddress,
        trackingNumber,
        status: "PENDING",
      },
    });

    // Auto-assign delivery to the least-busy partner (Step 33)
    const assignmentResult = await this.assignDelivery({
      deliveryId: deliveryRow.deliveryId,
      correlationId,
    });

    return {
      delivery: deliveryRow,
      assignedPartner: assignmentResult.assignedPartner,
      correlationId,
    };
  }

  /**
   * Sequence Step 33: assignDelivery()
   * Delivery -> DeliveryPartner
   * Auto-assigns the available DeliveryPartner with the fewest active deliveries.
   */
  async assignDelivery(params: {
    deliveryId: number;
    correlationId?: string;
    excludedPartnerIds?: number[];
  }) {
    const { deliveryId, excludedPartnerIds = [] } = params;
    const correlationId = params.correlationId ?? `assign-${deliveryId}-${Date.now()}`;

    // Query all delivery partners
    const partners = await prisma.deliveryPartner.findMany({
      include: {
        user: { select: { userId: true, name: true, phone: true } },
        deliveries: {
          where: {
            status: { in: ["ASSIGNED", "ACCEPTED", "OUT_FOR_DELIVERY"] },
          },
        },
      },
    });

    if (partners.length === 0) {
      console.warn("[DeliveryService] No delivery partners found in database.");
      return { success: false, deliveryId, assignedPartner: null };
    }

    // Filter out excluded partners (e.g. if one declined)
    const eligiblePartners = partners.filter(
      (p) => !excludedPartnerIds.includes(p.partnerId)
    );

    const candidates = eligiblePartners.length > 0 ? eligiblePartners : partners;

    // Pick candidate with fewest active deliveries (least-busy partner)
    candidates.sort((a, b) => a.deliveries.length - b.deliveries.length);
    const chosen = candidates[0];

    // Update delivery record
    await prisma.delivery.update({
      where: { deliveryId },
      data: {
        partnerId: chosen.partnerId,
        status: "ASSIGNED",
      },
    });

    // Step 33: Delivery -> DeliveryPartner assignDelivery()
    await trace.step({
      correlationId,
      stepNumber: 33,
      label: "assignDelivery()",
      from: "Delivery",
      to: "DeliveryPartner",
      details: {
        deliveryId,
        partnerId: chosen.partnerId,
        partnerName: chosen.user.name,
        activeDeliveries: chosen.deliveries.length,
      },
    });

    // Send notification to assigned partner
    await notificationService.sendNotification({
      userId: chosen.partnerId,
      type: "DELIVERY_UPDATE",
      message: `New delivery assigned to you. Order destination: ${params.deliveryId}. Please review and accept.`,
      correlationId,
    });

    return {
      success: true,
      deliveryId,
      assignedPartner: {
        partnerId: chosen.partnerId,
        name: chosen.user.name,
        vehicleNumber: chosen.vehicleNumber,
        activeDeliveriesCount: chosen.deliveries.length,
      },
    };
  }

  /**
   * Sequence Step 34: acceptDelivery()
   * DeliveryPartner -> Delivery deliveryAccepted
   */
  async acceptDelivery(deliveryId: number, partnerId: number, customCorrelationId?: string) {
    const delivery = await prisma.delivery.findUnique({
      where: { deliveryId },
      include: { order: true },
    });

    if (!delivery) throw new Error("Delivery not found");
    if (delivery.partnerId !== partnerId) {
      throw new Error("Unauthorized: you are not the assigned delivery partner");
    }

    const correlationId =
      customCorrelationId ?? delivery.order?.correlationId ?? `accept-${deliveryId}`;

    await prisma.delivery.update({
      where: { deliveryId },
      data: { status: "ACCEPTED" },
    });

    // Step 34: DeliveryPartner -> Delivery deliveryAccepted
    await trace.step({
      correlationId,
      stepNumber: 34,
      label: "deliveryAccepted",
      from: "DeliveryPartner",
      to: "Delivery",
      details: { deliveryId, partnerId, trackingNumber: delivery.trackingNumber },
    });

    // Notify customer
    if (delivery.order?.customerId) {
      await notificationService.sendNotification({
        userId: delivery.order.customerId,
        type: "DELIVERY_UPDATE",
        message: `Delivery partner has accepted your delivery. Tracking number: ${delivery.trackingNumber}.`,
        correlationId,
      });
    }

    return { success: true, status: "ACCEPTED", deliveryId };
  }

  /**
   * Decline delivery assignment -> reassign to next least-busy partner
   */
  async declineDelivery(deliveryId: number, partnerId: number, customCorrelationId?: string) {
    const delivery = await prisma.delivery.findUnique({
      where: { deliveryId },
      include: { order: true },
    });

    if (!delivery) throw new Error("Delivery not found");
    if (delivery.partnerId !== partnerId) {
      throw new Error("Unauthorized: you are not the assigned delivery partner");
    }

    const correlationId =
      customCorrelationId ?? delivery.order?.correlationId ?? `decline-${deliveryId}`;

    // Reassign excluding current partner
    return this.assignDelivery({
      deliveryId,
      correlationId,
      excludedPartnerIds: [partnerId],
    });
  }

  /**
   * Sequence Steps 35, 36, 37: updateStatus("Out for Delivery")
   * Only allowed when Order is in PREPARING status!
   * Delivery.updateStatus("Out for Delivery") (35)
   * -> Notification.sendNotification() (36)
   * -> orderOutForDelivery (37)
   */
  async setOutForDelivery(deliveryId: number, partnerId: number, customCorrelationId?: string) {
    const delivery = await prisma.delivery.findUnique({
      where: { deliveryId },
      include: {
        order: {
          include: { customer: true, store: true },
        },
        deliveryPartner: {
          include: { user: true },
        },
      },
    });

    if (!delivery) throw new Error("Delivery not found");
    if (delivery.partnerId !== partnerId) {
      throw new Error("Unauthorized: you are not the assigned delivery partner");
    }

    // Spec validation: only when Order is PREPARING can partner set Out for Delivery
    if (delivery.order.status !== "PREPARING") {
      throw new Error(
        `Cannot set Out for Delivery: order must be in 'PREPARING' status (current status: '${delivery.order.status}')`
      );
    }

    const correlationId =
      customCorrelationId ?? delivery.order.correlationId ?? `out-${deliveryId}`;
    const now = clock.now();

    // Update Delivery and Order status
    await prisma.$transaction([
      prisma.delivery.update({
        where: { deliveryId },
        data: { status: "OUT_FOR_DELIVERY" },
      }),
      prisma.order.update({
        where: { orderId: delivery.orderId },
        data: { status: "OUT_FOR_DELIVERY" },
      }),
      prisma.orderStatusHistory.create({
        data: {
          orderId: delivery.orderId,
          status: "OUT_FOR_DELIVERY",
          note: `Picked up from ${delivery.order.store.storeName} by partner ${delivery.deliveryPartner?.user.name}`,
          timestamp: now,
        },
      }),
    ]);

    // Step 35: Delivery -> Delivery updateStatus("Out for Delivery")
    await trace.step({
      correlationId,
      stepNumber: 35,
      label: 'updateStatus("Out for Delivery")',
      from: "Delivery",
      to: "Delivery",
      details: { deliveryId, orderId: delivery.orderId, status: "OUT_FOR_DELIVERY" },
    });

    // Step 36: Delivery -> Notification sendNotification()
    await trace.step({
      correlationId,
      stepNumber: 36,
      label: "sendNotification()",
      from: "Delivery",
      to: "Notification",
      details: {
        recipientId: delivery.order.customerId,
        type: "DELIVERY_UPDATE",
      },
    });

    // Send customer notification
    const partnerName = delivery.deliveryPartner?.user.name || "Delivery Partner";
    const vehicle = delivery.deliveryPartner?.vehicleNumber || "Vehicle";
    await notificationService.sendNotification({
      userId: delivery.order.customerId,
      type: "DELIVERY_UPDATE",
      message: `Your order #${delivery.order.orderNumber} is now out for delivery with ${partnerName} (${vehicle}).`,
      correlationId,
    });

    // Step 37: Notification -> Customer orderOutForDelivery()
    await trace.step({
      correlationId,
      stepNumber: 37,
      label: "orderOutForDelivery()",
      from: "Notification",
      to: "Customer",
      details: {
        orderId: delivery.orderId,
        orderNumber: delivery.order.orderNumber,
        status: "OUT_FOR_DELIVERY",
      },
    });

    return { success: true, status: "OUT_FOR_DELIVERY", deliveryId };
  }

  /**
   * Sequence Steps 38, 39, 40: updateStatus("Delivered")
   * Delivery.updateStatus("Delivered") (38)
   * -> sendNotification() (39)
   * -> deliveryCompleted (40)
   */
  async setDelivered(deliveryId: number, partnerId: number, customCorrelationId?: string) {
    const delivery = await prisma.delivery.findUnique({
      where: { deliveryId },
      include: {
        order: {
          include: { customer: true },
        },
        deliveryPartner: {
          include: { user: true },
        },
      },
    });

    if (!delivery) throw new Error("Delivery not found");
    if (delivery.partnerId !== partnerId) {
      throw new Error("Unauthorized: you are not the assigned delivery partner");
    }

    if (delivery.order.status !== "OUT_FOR_DELIVERY") {
      throw new Error(
        `Cannot mark delivered: order must be 'OUT_FOR_DELIVERY' (current status: '${delivery.order.status}')`
      );
    }

    const correlationId =
      customCorrelationId ?? delivery.order.correlationId ?? `delivered-${deliveryId}`;
    const now = clock.now();

    // Update Delivery and Order status
    await prisma.$transaction([
      prisma.delivery.update({
        where: { deliveryId },
        data: { status: "DELIVERED" },
      }),
      prisma.order.update({
        where: { orderId: delivery.orderId },
        data: { status: "DELIVERED" },
      }),
      prisma.orderStatusHistory.create({
        data: {
          orderId: delivery.orderId,
          status: "DELIVERED",
          note: `Delivered to destination address by ${delivery.deliveryPartner?.user.name}`,
          timestamp: now,
        },
      }),
    ]);

    // Step 38: Delivery -> Delivery updateStatus("Delivered")
    await trace.step({
      correlationId,
      stepNumber: 38,
      label: 'updateStatus("Delivered")',
      from: "Delivery",
      to: "Delivery",
      details: { deliveryId, orderId: delivery.orderId, status: "DELIVERED" },
    });

    // Step 39: Delivery -> Notification sendNotification()
    await trace.step({
      correlationId,
      stepNumber: 39,
      label: "sendNotification()",
      from: "Delivery",
      to: "Notification",
      details: {
        recipientId: delivery.order.customerId,
        type: "DELIVERY_UPDATE",
      },
    });

    // Send customer notification
    await notificationService.sendNotification({
      userId: delivery.order.customerId,
      type: "DELIVERY_UPDATE",
      message: `Your order #${delivery.order.orderNumber} has been successfully delivered! Thank you for reducing food waste.`,
      correlationId,
    });

    // Step 40: Delivery -> Customer deliveryCompleted()
    await trace.step({
      correlationId,
      stepNumber: 40,
      label: "deliveryCompleted()",
      from: "Delivery",
      to: "Customer",
      details: {
        orderId: delivery.orderId,
        orderNumber: delivery.order.orderNumber,
        status: "DELIVERED",
      },
    });

    return { success: true, status: "DELIVERED", deliveryId };
  }

  /**
   * Tracking info for customer
   */
  async getTrackingInfo(orderId: number) {
    const order = await prisma.order.findUnique({
      where: { orderId },
      include: {
        items: { include: { product: true } },
        store: true,
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
          orderBy: { timestamp: "asc" },
        },
      },
    });

    if (!order) throw new Error("Order not found");

    return order;
  }
}

export const deliveryService = new DeliveryService();
