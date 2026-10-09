import { User } from "./User";
import { Store } from "./Store";

export class Administrator extends User {
  adminId: number;

  constructor(params: {
    userId: number;
    name: string;
    email: string;
    passwordHash: string;
    phone: string;
    adminId: number;
  }) {
    super({
      userId: params.userId,
      name: params.name,
      email: params.email,
      passwordHash: params.passwordHash,
      phone: params.phone,
    });
    this.adminId = params.adminId;
  }

  /**
   * Diagram method: verifyStore()
   * Verifies a store, allowing it to add products (BR-1).
   */
  verifyStore(store: Store): void {
    store.status = "VERIFIED";
  }

  manageUsers(): void {
    throw new Error("NotImplemented: handled via Admin service");
  }

  viewReports(): void {
    throw new Error("NotImplemented: out of scope for Module 1/2");
  }
}

