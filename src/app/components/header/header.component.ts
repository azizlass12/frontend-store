import {
  Component, OnInit, OnDestroy, Output, EventEmitter,
  HostListener, ViewChild, ElementRef, AfterViewChecked
} from '@angular/core';
import { Router } from '@angular/router';
import { Subscription } from 'rxjs';
import { CartService } from '../../services/services';
import { ApiService, WebSocketService } from '../../services/services';
import { Product, CartItem, ChatSession } from '../../models/models';

@Component({
  selector: 'app-header',
  templateUrl: './header.component.html',
  styleUrls: ['./header.component.scss']
})
export class HeaderComponent implements OnInit, OnDestroy, AfterViewChecked {
  @Output() menuClick = new EventEmitter<void>();
  @Output() search = new EventEmitter<string>();
  @Output() productSelect = new EventEmitter<Product>();
  @Output() checkout = new EventEmitter<void>();    // ← AJOUTÉ

  @ViewChild('chatMessages') chatMessagesRef!: ElementRef;

  searchQuery = '';

  // Live search
  allProducts: Product[] = [];
  searchResults: Product[] = [];
  showSearchDropdown = false;

  // Cart
  cartItems: CartItem[] = [];
  cartOpen = false;

  private subscriptions: Subscription[] = [];

  constructor(
    private cartService: CartService,
    private api: ApiService,
    private router: Router
  ) {}

  ngOnInit(): void {
    this.loadProducts();
    this.subscriptions.push(
      this.cartService.cart$.subscribe((items: CartItem[]) => {
        this.cartItems = items;
      })
    );
  }

  ngAfterViewChecked(): void {}

  ngOnDestroy(): void {
    this.subscriptions.forEach(s => s.unsubscribe());
  }

  // ===== SEARCH =====
  loadProducts(): void {
    this.api.getProducts().subscribe(products => {
      this.allProducts = products;
    });
  }

  onInputChange(): void {
    const query = this.searchQuery.trim().toLowerCase();
    if (query.length === 0) {
      this.showSearchDropdown = false;
      this.searchResults = [];
      return;
    }
    this.searchResults = this.allProducts
      .filter(p =>
        p.name.toLowerCase().includes(query) ||
        p.description?.toLowerCase().includes(query) ||
        p.categoryName?.toLowerCase().includes(query)
      ).slice(0, 8);
    this.showSearchDropdown = true;
  }

  selectProduct(product: Product): void {
    this.showSearchDropdown = false;
    this.searchQuery = '';
    this.router.navigate(['/product', product.id]);
  }

  @HostListener('document:click', ['$event'])
  onDocumentClick(event: MouseEvent): void {
    const target = event.target as HTMLElement;
    if (!target.closest('.header__search')) {
      this.showSearchDropdown = false;
    }
  }

  onSearch(): void {
    this.search.emit(this.searchQuery.trim());
    this.showSearchDropdown = false;
  }

  onMenuClick(): void { this.menuClick.emit(); }

  // ===== CART =====
  get cartCount(): number { return this.cartService.count; }
  get cartTotal(): number { return this.cartService.total; }

  toggleCart(): void {
    this.cartOpen = !this.cartOpen;
  }

  openCart(): void {
    this.cartOpen = true;
  }

  updateQty(productId: number, qty: number): void {
    this.cartService.updateQuantity(productId, qty);
  }

  removeItem(productId: number): void {
    this.cartService.removeFromCart(productId);
  }

  // ===== CHECKOUT → émet vers le Home =====
  onCheckout(): void {
    if (this.cartItems.length === 0) return;
    this.cartOpen = false;          // Ferme le panier
    this.checkout.emit();           // Informe le Home
  }
}