import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  console.log("Starting idempotent seed...");

  // Clear existing records in correct foreign key order
  await prisma.traceLog.deleteMany();
  await prisma.orderStatusHistory.deleteMany();
  await prisma.priceHistory.deleteMany();
  await prisma.notification.deleteMany();
  await prisma.delivery.deleteMany();
  await prisma.payment.deleteMany();
  await prisma.orderItem.deleteMany();
  await prisma.order.deleteMany();
  await prisma.cartItem.deleteMany();
  await prisma.shoppingCart.deleteMany();
  await prisma.inventoryItem.deleteMany();
  await prisma.product.deleteMany();
  await prisma.pricingRule.deleteMany();
  await prisma.store.deleteMany();
  await prisma.deliveryPartner.deleteMany();
  await prisma.administrator.deleteMany();
  await prisma.storeOwner.deleteMany();
  await prisma.customer.deleteMany();
  await prisma.user.deleteMany();
  await prisma.platformConfig.deleteMany();

  const passwordHash = await bcrypt.hash("Password123!", 10);
  const now = new Date();

  // 1. Seed Administrator
  const adminUser = await prisma.user.create({
    data: {
      name: "Admin Officer",
      email: "admin@zerowaste.org",
      passwordHash,
      phone: "+91 9876543210",
      role: "ADMIN",
    },
  });
  await prisma.administrator.create({
    data: { adminId: adminUser.userId },
  });

  // 2. Seed 2 Store Owners & Stores
  const owner1User = await prisma.user.create({
    data: {
      name: "Ramesh Patel",
      email: "freshmart.owner@gmail.com",
      passwordHash,
      phone: "+91 9876543211",
      role: "STORE_OWNER",
    },
  });
  await prisma.storeOwner.create({
    data: { ownerId: owner1User.userId },
  });
  const store1 = await prisma.store.create({
    data: {
      storeName: "FreshMart Supermarket",
      address: "Shop 4, Linking Road, Bandra West, Mumbai 400050",
      status: "VERIFIED",
      ownerId: owner1User.userId,
    },
  });

  const owner2User = await prisma.user.create({
    data: {
      name: "Priya Sharma",
      email: "greenleaf.owner@gmail.com",
      passwordHash,
      phone: "+91 9876543212",
      role: "STORE_OWNER",
    },
  });
  await prisma.storeOwner.create({
    data: { ownerId: owner2User.userId },
  });
  const store2 = await prisma.store.create({
    data: {
      storeName: "GreenLeaf Organic Grocers",
      address: "12 Hill Road, Bandra West, Mumbai 400050",
      status: "VERIFIED",
      ownerId: owner2User.userId,
    },
  });

  // 3. Seed 2 Delivery Partners
  const dp1User = await prisma.user.create({
    data: {
      name: "Vikram Singh",
      email: "partner1@zerowaste.org",
      passwordHash,
      phone: "+91 9876543220",
      role: "DELIVERY_PARTNER",
    },
  });
  await prisma.deliveryPartner.create({
    data: {
      partnerId: dp1User.userId,
      vehicleNumber: "MH 02 AB 1234",
    },
  });

  const dp2User = await prisma.user.create({
    data: {
      name: "Amit Kumar",
      email: "partner2@zerowaste.org",
      passwordHash,
      phone: "+91 9876543221",
      role: "DELIVERY_PARTNER",
    },
  });
  await prisma.deliveryPartner.create({
    data: {
      partnerId: dp2User.userId,
      vehicleNumber: "MH 02 CD 5678",
    },
  });

  // 4. Seed 3 Customers + Carts
  const customersData = [
    {
      name: "Rahul Verma",
      email: "rahul.customer@gmail.com",
      phone: "+91 9876543231",
      address: "Flat 302, Sea Breeze Apts, Bandra West, Mumbai",
    },
    {
      name: "Sneha Kulkarni",
      email: "sneha.customer@gmail.com",
      phone: "+91 9876543232",
      address: "B-14 Palm Springs, Khar West, Mumbai",
    },
    {
      name: "Arjun Mehta",
      email: "arjun.customer@gmail.com",
      phone: "+91 9876543233",
      address: "103 Sunrise Towers, Santacruz West, Mumbai",
    },
  ];

  for (const c of customersData) {
    const custUser = await prisma.user.create({
      data: {
        name: c.name,
        email: c.email,
        passwordHash,
        phone: c.phone,
        role: "CUSTOMER",
      },
    });
    await prisma.customer.create({
      data: {
        customerId: custUser.userId,
        deliveryAddress: c.address,
      },
    });
    await prisma.shoppingCart.create({
      data: {
        customerId: custUser.userId,
        totalAmount: 0,
      },
    });
  }

  // 5. Seed Pricing Rules for Dairy, Bakery, Produce, Snacks
  const rules = [
    {
      category: "Dairy",
      discountRate: 0.04,
      expiryThresholdHours: 24,
      maximumDiscount: 0.75,
      minimumPriceFloor: 15.0,
    },
    {
      category: "Bakery",
      discountRate: 0.05,
      expiryThresholdHours: 18,
      maximumDiscount: 0.80,
      minimumPriceFloor: 10.0,
    },
    {
      category: "Produce",
      discountRate: 0.03,
      expiryThresholdHours: 36,
      maximumDiscount: 0.70,
      minimumPriceFloor: 20.0,
    },
    {
      category: "Snacks",
      discountRate: 0.02,
      expiryThresholdHours: 48,
      maximumDiscount: 0.60,
      minimumPriceFloor: 25.0,
    },
  ];

  const ruleMap = new Map<string, number>();
  for (const r of rules) {
    const createdRule = await prisma.pricingRule.create({
      data: r,
    });
    ruleMap.set(r.category, createdRule.ruleId);
  }

  // 6. Seed 16 Products across both stores covering 4 expiry bands
  // Bands:
  // CRITICAL: 0-6h (e.g. +2h, +4h)
  // URGENT: 6-24h (e.g. +8h, +14h)
  // SOON: 24-72h (e.g. +36h, +50h)
  // STANDARD: 72h+ (e.g. +96h, +144h)
  const productsToSeed = [
    // --- Store 1: FreshMart Supermarket ---
    // Critical (0-6h)
    {
      name: "Fresh Whole Milk 1L",
      category: "Dairy",
      originalPrice: 66,
      hoursToExpiry: 3,
      storeId: store1.storeId,
      quantity: 15,
    },
    {
      name: "Artisan Sourdough Loaf",
      category: "Bakery",
      originalPrice: 120,
      hoursToExpiry: 4,
      storeId: store1.storeId,
      quantity: 8,
    },
    // Urgent (6-24h)
    {
      name: "Greek Yogurt 400g",
      category: "Dairy",
      originalPrice: 95,
      hoursToExpiry: 10,
      storeId: store1.storeId,
      quantity: 20,
    },
    {
      name: "Whole Wheat Bread 400g",
      category: "Bakery",
      originalPrice: 50,
      hoursToExpiry: 14,
      storeId: store1.storeId,
      quantity: 25,
    },
    // Soon (1-3 days)
    {
      name: "Organic Spinach 250g",
      category: "Produce",
      originalPrice: 40,
      hoursToExpiry: 30,
      storeId: store1.storeId,
      quantity: 18,
    },
    {
      name: "Ripe Bananas Robusta (1 Dozen)",
      category: "Produce",
      originalPrice: 60,
      hoursToExpiry: 48,
      storeId: store1.storeId,
      quantity: 30,
    },
    // Standard (3+ days)
    {
      name: "Roasted Almonds 200g",
      category: "Snacks",
      originalPrice: 220,
      hoursToExpiry: 96,
      storeId: store1.storeId,
      quantity: 40,
    },
    {
      name: "Multi-Grain Energy Bars (Pack of 6)",
      category: "Snacks",
      originalPrice: 180,
      hoursToExpiry: 120,
      storeId: store1.storeId,
      quantity: 35,
    },

    // --- Store 2: GreenLeaf Organic Grocers ---
    // Critical (0-6h)
    {
      name: "Organic Paneer 200g",
      category: "Dairy",
      originalPrice: 110,
      hoursToExpiry: 2.5,
      storeId: store2.storeId,
      quantity: 12,
    },
    {
      name: "Fresh Croissants (Pack of 2)",
      category: "Bakery",
      originalPrice: 90,
      hoursToExpiry: 5,
      storeId: store2.storeId,
      quantity: 10,
    },
    // Urgent (6-24h)
    {
      name: "Organic Button Mushrooms 200g",
      category: "Produce",
      originalPrice: 75,
      hoursToExpiry: 12,
      storeId: store2.storeId,
      quantity: 14,
    },
    {
      name: "Garlic Herb Focaccia",
      category: "Bakery",
      originalPrice: 85,
      hoursToExpiry: 16,
      storeId: store2.storeId,
      quantity: 15,
    },
    // Soon (1-3 days)
    {
      name: "Farm Fresh Strawberries 200g",
      category: "Produce",
      originalPrice: 130,
      hoursToExpiry: 40,
      storeId: store2.storeId,
      quantity: 22,
    },
    {
      name: "Aged Cheddar Cheese 150g",
      category: "Dairy",
      originalPrice: 250,
      hoursToExpiry: 60,
      storeId: store2.storeId,
      quantity: 16,
    },
    // Standard (3+ days)
    {
      name: "Baked Pita Chips 150g",
      category: "Snacks",
      originalPrice: 95,
      hoursToExpiry: 110,
      storeId: store2.storeId,
      quantity: 50,
    },
    {
      name: "Roasted Makhana (Foxnuts) 100g",
      category: "Snacks",
      originalPrice: 140,
      hoursToExpiry: 150,
      storeId: store2.storeId,
      quantity: 45,
    },
  ];

  for (const item of productsToSeed) {
    const expiryDateTime = new Date(now.getTime() + item.hoursToExpiry * 3600 * 1000);
    const ruleId = ruleMap.get(item.category);
    const ruleDef = rules.find((r) => r.category === item.category);

    let currentPrice = item.originalPrice;
    if (ruleDef && item.hoursToExpiry <= ruleDef.expiryThresholdHours) {
      const elapsed = ruleDef.expiryThresholdHours - item.hoursToExpiry;
      const discount = Math.min(ruleDef.discountRate * elapsed, ruleDef.maximumDiscount, 0.80);
      currentPrice = Math.round(Math.max(item.originalPrice * (1 - discount), ruleDef.minimumPriceFloor));
    }

    const prod = await prisma.product.create({
      data: {
        name: item.name,
        category: item.category,
        originalPrice: item.originalPrice,
        currentPrice,
        expiryDateTime,
        status: "ACTIVE",
        storeId: item.storeId,
        pricingRuleId: ruleId,
      },
    });

    await prisma.inventoryItem.create({
      data: {
        productId: prod.productId,
        quantity: item.quantity,
        reservedQuantity: 0,
      },
    });

    await prisma.priceHistory.create({
      data: {
        productId: prod.productId,
        price: currentPrice,
        reason: "INITIAL_SEED",
      },
    });
  }

  // 7. Seed initial PlatformConfig
  await prisma.platformConfig.createMany({
    data: [
      { key: "BR_MAX_DISCOUNT_PERCENT", value: "80", description: "Maximum discount percentage cap" },
      { key: "BR_CART_HOLD_MINUTES", value: "15", description: "Cart price hold duration in minutes" },
      { key: "BR_ORDER_TIMEOUT_MINUTES", value: "15", description: "Store order response timeout in minutes" },
    ],
  });

  console.log("Database seeded successfully!");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
