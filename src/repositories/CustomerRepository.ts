import { prisma } from "@/lib/prisma";
import { Customer } from "@/domain/Customer";

export class CustomerRepository {
  static async findById(customerId: number): Promise<Customer | null> {
    const row = await prisma.customer.findUnique({
      where: { customerId },
      include: { user: true },
    });
    if (!row) return null;
    return new Customer({
      userId: row.user.userId,
      name: row.user.name,
      email: row.user.email,
      passwordHash: row.user.passwordHash,
      phone: row.user.phone,
      customerId: row.customerId,
      deliveryAddress: row.deliveryAddress,
    });
  }

  static async create(data: {
    userId: number;
    deliveryAddress: string;
  }): Promise<Customer> {
    const row = await prisma.customer.create({
      data: {
        customerId: data.userId,
        deliveryAddress: data.deliveryAddress,
      },
      include: { user: true },
    });

    return new Customer({
      userId: row.user.userId,
      name: row.user.name,
      email: row.user.email,
      passwordHash: row.user.passwordHash,
      phone: row.user.phone,
      customerId: row.customerId,
      deliveryAddress: row.deliveryAddress,
    });
  }
}
