import { Component, OnInit, Input, Output, EventEmitter, HostListener } from '@angular/core';
import { Product } from '../../models/models';
import { CartService } from '../../services/services';
import { ApiService } from '../../services/services';

@Component({
  selector: 'app-products',
  templateUrl: './products.component.html',
  styleUrls: ['./products.component.scss']
})
export class ProductsComponent implements OnInit {

  @Input() searchQuery = '';
  @Output() addToCart = new EventEmitter<Product>();   // ← AJOUTÉ

  products: Product[] = [];
  loading = true;
  error: string | null = null;

  currentPage = 1;
  columns = 4;

  constructor(
    private cartService: CartService,
    private api: ApiService
  ) {}

  ngOnInit(): void {
    this.updateColumns();
    this.loadProducts();
  }

  @HostListener('window:resize')
  onResize(): void {
    this.updateColumns();
  }

  updateColumns(): void {
    const width = window.innerWidth;
    if (width <= 768) this.columns = 2;
    else this.columns = 4;
    this.currentPage = 1;
  }

  loadProducts(): void {
    this.loading = true;
    this.error = null;
    this.api.getProducts().subscribe({
      next: (products) => {
        this.products = products;
        this.loading = false;
      },
      error: (err) => {
        console.error('Failed to load products:', err);
        this.error = 'Impossible de charger les produits';
        this.loading = false;
      }
    });
  }

  get filteredProducts(): Product[] {
    if (!this.searchQuery.trim()) return this.products;
    const query = this.searchQuery.toLowerCase().trim();
    return this.products.filter(p =>
      p.name.toLowerCase().includes(query) ||
      p.description?.toLowerCase().includes(query) ||
      p.categoryName?.toLowerCase().includes(query)
    );
  }

  get productsCount(): number {
    return this.filteredProducts.length;
  }

  get itemsPerPage(): number {
    return 4 * this.columns;
  }

  get totalPages(): number {
    return Math.ceil(this.filteredProducts.length / this.itemsPerPage);
  }

  get paginatedProducts(): Product[] {
    const start = (this.currentPage - 1) * this.itemsPerPage;
    return this.filteredProducts.slice(start, start + this.itemsPerPage);
  }

  get pageNumbers(): number[] {
    return Array.from({ length: this.totalPages }, (_, i) => i + 1);
  }

  get startItem(): number {
    return (this.currentPage - 1) * this.itemsPerPage + 1;
  }

  get endItem(): number {
    return Math.min(this.currentPage * this.itemsPerPage, this.filteredProducts.length);
  }

  goToPage(page: number): void {
    if (page < 1 || page > this.totalPages) return;
    this.currentPage = page;
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  prevPage(): void {
    this.goToPage(this.currentPage - 1);
  }

  nextPage(): void {
    this.goToPage(this.currentPage + 1);
  }

  onAddToCart(event: { product: Product; quantity: number }): void {
    this.addToCart.emit(event.product);        // ← C'est cette ligne qui manquait
  }
}