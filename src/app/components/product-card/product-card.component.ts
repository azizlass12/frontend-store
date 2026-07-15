import { Component, OnInit, Input, Output, EventEmitter } from '@angular/core';
import { Product } from '../../models/models';
import { Router } from '@angular/router';

@Component({
  selector: 'app-product-card',
  templateUrl: './product-card.component.html',
  styleUrls: ['./product-card.component.scss']
})
export class ProductCardComponent implements OnInit {
  @Input() product!: Product;
  @Output() addToCart = new EventEmitter<{ product: Product; quantity: number }>();

  quantity = 1;

  constructor(private router: Router) {}

  ngOnInit(): void {}

  increaseQuantity(): void {
    this.quantity++;
  }

  decreaseQuantity(): void {
    if (this.quantity > 1) {
      this.quantity--;
    }
  }

  onAddToCart(): void {
    this.addToCart.emit({ product: this.product, quantity: this.quantity });
    // Reset quantity after adding
    this.quantity = 1;
  }

  onCardClick(): void {
    this.router.navigate(['/product', this.product.id]);
  }
}
