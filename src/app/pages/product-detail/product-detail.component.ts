import {
  ChangeDetectorRef, Component, OnInit, AfterViewChecked
} from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { ApiService, CartService } from '../../services/services';
import { Product, Category } from '../../models/models';

@Component({
  selector: 'app-product-detail',
  templateUrl: './product-detail.component.html',
  styleUrls: ['./product-detail.component.scss']
})
export class ProductDetailComponent implements OnInit, AfterViewChecked {

  product: Product | null = null;
  quantity    = 1;
  loading     = true;
  drawerOpen  = false;
  categories: Category[] = [];

  selectedRegion = '';
  selectedValue  = '';
  currentPrice   = 0;
  pricesMap: { [key: string]: number } = {};

  constructor(
    private route:  ActivatedRoute,
    private router: Router,
    private api:    ApiService,
    public  cartService: CartService,
    private cdr:    ChangeDetectorRef
  ) {}

  // ── Lifecycle ─────────────────────────────────────────────
  ngOnInit() {
    this.loadCategories();
    const id = Number(this.route.snapshot.paramMap.get('id'));
    this.api.getProducts().subscribe(products => {
      this.product = products.find(p => p.id === id) || null;
      this.loading = false;
      if (this.product) this.initAttributes();
    });
  }

  ngAfterViewChecked() {
    // Rien à faire ici — detectChanges() est appelé dans onAddToCart()
  }

  // ── Attributs ─────────────────────────────────────────────
  initAttributes() {
    if (!this.product) return;

    if (this.product.pricesByValue) {
      try { this.pricesMap = JSON.parse(this.product.pricesByValue); }
      catch { this.pricesMap = {}; }
    }

    if (this.product.regionList?.length)
      this.selectedRegion = this.product.regionList[0];

    if (this.product.valueList?.length) {
      this.selectedValue = this.product.valueList[0];
      this.updatePrice();
    } else {
      this.currentPrice = this.product.price;
    }
  }

  selectRegion(region: string) { this.selectedRegion = region; }

  selectValue(value: string) {
    this.selectedValue = value;
    this.updatePrice();
  }

  updatePrice() {
    this.currentPrice = (this.selectedValue && this.pricesMap[this.selectedValue])
      ? this.pricesMap[this.selectedValue]
      : (this.product?.price ?? 0);
  }

  getRegionFlag(region: string): string {
    const flags: { [k: string]: string } = {
      'Global': '🌍', 'EU': '🇪🇺', 'US': '🇺🇸', 'TR': '🇹🇷',
      'UK': '🇬🇧', 'FR': '🇫🇷', 'DE': '🇩🇪', 'SA': '🇸🇦', 'AE': '🇦🇪'
    };
    return flags[region.trim()] || '🌐';
  }

  // ── Quantité ──────────────────────────────────────────────
  increaseQty() { if (this.product && this.quantity < this.product.stock) this.quantity++; }
  decreaseQty() { if (this.quantity > 1) this.quantity--; }

  // ── Panier + Modal ────────────────────────────────────────
  onAddToCart(): void {
    if (!this.product || this.product.stock === 0) return;

    // Passer le prix courant (valeur/région sélectionnée) au produit
    const productToAdd = { ...this.product, price: this.currentPrice };
    this.cartService.addToCart(productToAdd, this.quantity);
    this.cdr.detectChanges();   // Force Angular à voir showAddedModal = true
  }

  closeModal(): void {
    this.cartService.closeAddedModal();
    this.cdr.detectChanges();
  }

goToCheckout(): void {
  this.cartService.closeAddedModal();
  this.router.navigate(['/'], { queryParams: { checkout: 'true' } });
}

  // ── Navigation ────────────────────────────────────────────
  goBack(): void { this.router.navigate(['/']); }

  onCategorySelected(categoryId: number): void {
    this.router.navigate(['/'], { queryParams: { category: categoryId } });
  }

  loadCategories() {
    this.api.getCategories().subscribe(cats => { this.categories = cats; });
  }
}