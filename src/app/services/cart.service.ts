import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable } from 'rxjs';
import { Product } from '../models/models';

export interface CartItem extends Product {
  cartQuantity: number;
}

@Injectable({
  providedIn: 'root'
})
export class CartService {
  private cartItems: CartItem[] = [];
  private cartCountSubject = new BehaviorSubject<number>(0);
  private cartItemsSubject = new BehaviorSubject<CartItem[]>([]);

  cartCount$: Observable<number> = this.cartCountSubject.asObservable();
  cartItems$: Observable<CartItem[]> = this.cartItemsSubject.asObservable();

  constructor() {}

  addToCart(product: Product, quantity: number = 1): void {
    const existingItem = this.cartItems.find(item => item.id === product.id);

    if (existingItem) {
      existingItem.cartQuantity += quantity;
    } else {
      this.cartItems.push({
        ...product,
        cartQuantity: quantity
      });
    }

    this.updateCartState();
  }

  removeFromCart(productId: number): void {
    this.cartItems = this.cartItems.filter(item => item.id !== productId);
    this.updateCartState();
  }

  updateQuantity(productId: number, quantity: number): void {
    const item = this.cartItems.find(item => item.id === productId);
    if (item) {
      if (quantity <= 0) {
        this.removeFromCart(productId);
      } else {
        item.cartQuantity = quantity;
        this.updateCartState();
      }
    }
  }

  getCartCount(): number {
    return this.cartItems.reduce((sum, item) => sum + item.cartQuantity, 0);
  }

  clearCart(): void {
    this.cartItems = [];
    this.updateCartState();
  }

  private updateCartState(): void {
    this.cartCountSubject.next(this.getCartCount());
    this.cartItemsSubject.next([...this.cartItems]);
  }
}
