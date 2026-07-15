import { Component, OnInit, OnDestroy, HostListener, Output, EventEmitter } from '@angular/core';
import { Product } from '../../models/models';
import { ApiService } from '../../services/services';

@Component({
  selector: 'app-hero-carousel',
  templateUrl: './hero-carousel.component.html',
  styleUrls: ['./hero-carousel.component.scss']
})
export class HeroCarouselComponent implements OnInit, OnDestroy {
  @Output() addToCart = new EventEmitter<Product>();

  currentIndex = 0;
  private autoSlideInterval: any;
  private readonly slideInterval = 5000;
  private touchStartX = 0;

  products: Product[] = [];
  loading = true;

  // Styling config for each slide position
  private slideStyles = [
    { bg: '#180808', glow: '#e63946', watermark: 'XBOX' },
    { bg: '#080e1a', glow: '#1e5cf5', watermark: 'NINTENDO' },
    { bg: '#040e07', glow: '#22c55e', watermark: 'GAMING' },
    { bg: '#0f070f', glow: '#a855f7', watermark: 'ASUS ROG' }
  ];

  constructor(private api: ApiService) {}

  ngOnInit(): void {
    this.loadProducts();
  }

  loadProducts(): void {
    this.api.getProducts().subscribe({
      next: (products) => {
        // Take first 4 products with images for carousel
        this.products = products
          .filter(p => p.imageUrl && p.imageUrl.startsWith('http'))
          .slice(0, 4);
        this.loading = false;
        if (this.products.length > 0) {
          this.startAutoSlide();
        }
      },
      error: (err) => {
        console.error('Failed to load carousel products:', err);
        this.loading = false;
      }
    });
  }

  getSlideStyle(index: number): { bg: string; glow: string; watermark: string } {
    return this.slideStyles[index % this.slideStyles.length];
  }

  ngOnDestroy(): void {
    this.stopAutoSlide();
  }

  @HostListener('touchstart', ['$event'])
  onTouchStart(event: TouchEvent): void {
    this.touchStartX = event.touches[0].clientX;
  }

  @HostListener('touchend', ['$event'])
  onTouchEnd(event: TouchEvent): void {
    const diff = this.touchStartX - event.changedTouches[0].clientX;
    if (Math.abs(diff) > 40) {
      if (diff > 0) {
        this.nextSlide();
      } else {
        this.prevSlide();
      }
      this.resetAutoSlide();
    }
  }

  getProgressWidth(): string {
    return '100%';
  }

  goToSlide(index: number): void {
    this.currentIndex = (index + this.products.length) % Math.max(this.products.length, 1);
    this.resetAutoSlide();
  }

  nextSlide(): void {
    this.goToSlide(this.currentIndex + 1);
  }

  prevSlide(): void {
    this.goToSlide(this.currentIndex - 1);
  }

  isActiveSlide(index: number): boolean {
    return this.currentIndex === index;
  }

  get productsCount(): number {
    return this.products.length;
  }

  private startAutoSlide(): void {
    this.autoSlideInterval = setInterval(() => {
      this.nextSlide();
    }, this.slideInterval);
  }

  private stopAutoSlide(): void {
    if (this.autoSlideInterval) {
      clearInterval(this.autoSlideInterval);
    }
  }

  private resetAutoSlide(): void {
    this.stopAutoSlide();
    this.startAutoSlide();
  }

  onAddToCart(product: Product): void {
    this.addToCart.emit(product);
  }
}
