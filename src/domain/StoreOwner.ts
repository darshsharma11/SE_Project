import { User } from "./User";
import { Store } from "./Store";
import { Product } from "./Product";
import { InventoryItem } from "./InventoryItem";

export class StoreOwner extends User {
  ownerId: number;

  constructor(params: {
    userId: number;
    name: string;
    email: string;
    passwordHash: string;
    phone: string;
    ownerId: number;
  }) {
    super({
      userId: params.userId,
      name: params.name,
      email: params.email,
      passwordHash: params.passwordHash,
      phone: params.phone,
    });
    this.ownerId = params.ownerId;
  }

  registerStore(): void {
    throw new Error("NotImplemented: handled via Store management");
  }

  /**
   * Diagram method: manageProducts()
   * Delegates to Store.addProduct() or Store.updateInventory().
   */
  manageProducts(
    action: "ADD_PRODUCT" | "UPDATE_INVENTORY",
    store: Store,
    payload?: any
  ): Product | void {
    if (action === "ADD_PRODUCT") {
      return store.addProduct(payload);
    }
    if (action === "UPDATE_INVENTORY") {
      return store.updateInventory(payload.item, payload.delta);
    }
  }

  viewAnalytics(): void {
    throw new Error("NotImplemented: out of scope for Module 1/2");
  }
}

