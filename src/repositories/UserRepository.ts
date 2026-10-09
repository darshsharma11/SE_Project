import { prisma } from "@/lib/prisma";
import { User } from "@/domain/User";

export class UserRepository {
  static toDomain(row: {
    userId: number;
    name: string;
    email: string;
    passwordHash: string;
    phone: string;
  }): User {
    return new User({
      userId: row.userId,
      name: row.name,
      email: row.email,
      passwordHash: row.passwordHash,
      phone: row.phone,
    });
  }

  static async findById(userId: number): Promise<User | null> {
    const row = await prisma.user.findUnique({ where: { userId } });
    return row ? this.toDomain(row) : null;
  }

  static async findByEmail(email: string): Promise<(User & { role: string }) | null> {
    const row = await prisma.user.findUnique({ where: { email } });
    if (!row) return null;
    const user = this.toDomain(row);
    return Object.assign(user, { role: row.role });
  }

  static async create(data: {
    name: string;
    email: string;
    passwordHash: string;
    phone: string;
    role?: string;
  }): Promise<User> {
    const row = await prisma.user.create({
      data: {
        name: data.name,
        email: data.email,
        passwordHash: data.passwordHash,
        phone: data.phone,
        role: data.role ?? "CUSTOMER",
      },
    });
    return this.toDomain(row);
  }
}
