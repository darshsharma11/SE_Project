import { Product } from "./Product";
import { InventoryItem } from "./InventoryItem";
import { clock } from "@/lib/clock";

export type StoreStatus = "PENDING_VERIFICATION" | "VERIFIED" | "SUSPENDED";

export class Store {
  storeId: number;
  storeName: string;
  address: string;
  status: string;
  ownerId?: number; // SRS extension for relational persistence

  constructor(params: {
    storeId: number;
    storeName: string;
    address: string;
    status: string;
    ownerId?: number;
  }) {
    this.storeId = params.storeId;
    this.storeName = params.storeName;
    this.address = params.address;
    this.status = params.status;
    this.ownerId = params.ownerId;
  }

  /**
   * Diagram method: addProduct()
   * Only VERIFIED stores are allowed to add products (BR-1).
   * Also rejects expiry <= now (BR-4).
   */
  addProduct(params?: {
    name: string;
    category: string;
    originalPrice: number;
    currentPrice?: number;
    expiryDateTime: Date;
    pricingRuleId?: number;
    now?: Date;
  }): Product {
    if (this.status !== "VERIFIED") {
      throw new Error("Store must be VERIFIED to add products");
    }

    if (params) {
      const currentNow = params.now ?? clock.now();
      if (params.expiryDateTime.getTime() <= currentNow.getTime()) {
        throw new Error("Product creation rejected: expiry date must be in the future");
      }

      return new Product({
        productId: 0,
        name: params.name,
        category: params.category,
        originalPrice: params.originalPrice,
        currentPrice: params.currentPrice ?? params.originalPrice,
        expiryDateTime: params.expiryDateTime,
        status: "ACTIVE",
        storeId: this.storeId,
        pricingRuleId: params.pricingRuleId,
        now: currentNow,
      });
    }

    return null as any;
  }

  /**
   * Diagram method: updateInventory()
   */
  updateInventory(inventoryItem: InventoryItem, delta: number): void {
    inventoryItem.updateQuantity(delta);
  }

  /**
   * Diagram method: acceptOrder()
   * Transitions order from CONFIRMED -> PREPARING.
   */
  acceptOrder(order?: { status: string; updateStatus?: (s: any) => void }): void {
    if (order) {
      if (order.status !== "CONFIRMED") {
        throw new Error(`Cannot accept order in status '${order.status}' (must be CONFIRMED)`);
      }
      if (typeof order.updateStatus === "function") {
        order.updateStatus("PREPARING");
      } else {
        order.status = "PREPARING";
      }
    }
  }

  viewStoreAnalytics(): void {
    throw new Error("NotImplemented: out of scope for Module 1/2");
  }
}

