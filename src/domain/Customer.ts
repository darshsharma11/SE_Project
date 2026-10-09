import { User } from "./User";

export class Customer extends User {
  customerId: number;
  deliveryAddress: string;

  constructor(params: {
    userId: number;
    name: string;
    email: string;
    passwordHash: string;
    phone: string;
    customerId: number;
    deliveryAddress: string;
  }) {
    super({
      userId: params.userId,
      name: params.name,
      email: params.email,
      passwordHash: params.passwordHash,
      phone: params.phone,
    });
    this.customerId = params.customerId;
    this.deliveryAddress = params.deliveryAddress;
  }

  register(): void {
    throw new Error("NotImplemented: handled via Registration flow");
  }

  /**
   * Sequence Step 20: placeOrder() calls CheckoutService.checkout()
   */
  async placeOrder(checkoutService: { checkout: (params: any) => Promise<any> }, checkoutParams?: any): Promise<any> {
    return await checkoutService.checkout({
      ...checkoutParams,
      customerId: this.customerId,
    });
  }

  viewOrderHistory(): void {
    throw new Error("NotImplemented: handled via OrderRepository");
  }
}
