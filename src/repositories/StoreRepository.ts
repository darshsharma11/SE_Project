import { prisma } from "@/lib/prisma";
import { Store } from "@/domain/Store";

export class StoreRepository {
  static toDomain(row: {
    storeId: number;
    storeName: string;
    address: string;
    status: string;
    ownerId: number;
  }): Store {
    return new Store({
      storeId: row.storeId,
      storeName: row.storeName,
      address: row.address,
      status: row.status,
      ownerId: row.ownerId,
    });
  }

  static async findById(storeId: number): Promise<Store | null> {
    const row = await prisma.store.findUnique({ where: { storeId } });
    return row ? this.toDomain(row) : null;
  }

  static async findByOwnerId(ownerId: number): Promise<Store[]> {
    const rows = await prisma.store.findMany({ where: { ownerId } });
    return rows.map((r) => this.toDomain(r));
  }

  static async findAllVerified(): Promise<Store[]> {
    const rows = await prisma.store.findMany({
      where: { status: "VERIFIED" },
    });
    return rows.map((r) => this.toDomain(r));
  }
}
