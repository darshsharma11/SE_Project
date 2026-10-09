import { prisma } from "@/lib/prisma";
import { ShoppingCart } from "@/domain/ShoppingCart";
import { CartItem } from "@/domain/CartItem";

export class ShoppingCartRepository {
  static async getOrCreateForCustomer(customerId: number): Promise<ShoppingCart> {
    let cart = await prisma.shoppingCart.findUnique({
      where: { customerId },
      include: { items: true },
    });

    if (!cart) {
      cart = await prisma.shoppingCart.create({
        data: { customerId, totalAmount: 0 },
        include: { items: true },
      });
    }

    const domainItems = cart.items.map(
      (item) =>
        new CartItem({
          cartItemId: item.cartItemId,
          quantity: item.quantity,
          price: item.price,
          cartId: item.cartId,
          productId: item.productId,
          priceHoldExpiresAt: item.priceHoldExpiresAt,
        })
    );

    return new ShoppingCart({
      cartId: cart.cartId,
      customerId: cart.customerId,
      totalAmount: cart.totalAmount,
      items: domainItems,
    });
  }

  static async save(cart: ShoppingCart): Promise<void> {
    await prisma.shoppingCart.update({
      where: { cartId: cart.cartId },
      data: { totalAmount: cart.calculateTotal() },
    });
  }
}
