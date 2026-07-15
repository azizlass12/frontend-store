import { Component, OnInit, Output, EventEmitter } from '@angular/core';
import { Router } from '@angular/router';
import { NavItem } from '../../models/product.model';
import { Category } from '../../models/models';
import { ApiService } from '../../services/services';

@Component({
  selector: 'app-navbar',
  templateUrl: './navbar.component.html',
  styleUrls: ['./navbar.component.scss']
})
export class NavbarComponent implements OnInit {
  @Output() burgerClick       = new EventEmitter<void>();
  @Output() categoryClick     = new EventEmitter<number>();
  @Output() carteCadeauSelect = new EventEmitter<string>();

  carteCadeauOpen = false;
  carteCadeauMenu = [
    { name: 'Carte PlayStation', items: ['Carte PSN', 'Carte PS Plus'] },
    { name: 'Carte Nintendo',    items: ['Carte Nintendo eShop', 'Carte Nintendo Online'] },
    { name: 'Carte XBOX',        items: ['Carte Xbox', 'XBOX Game Pass Essential', 'XBOX Game Pass Premium'] },
    { name: 'Carte Plateforme',  items: ['Carte Steam', 'Carte Blizzard - Battle Net', 'Carte Razer Gold', 'Carte EA Origin'] },
    { name: 'Carte Réseaux',     items: ['Abonnement Discord Nitro', 'Carte Tinder'] }
  ];
  carteCadeauSingles = ['Carte Netflix', 'Abonnement Crunchyroll', 'Carte Twitch.tv'];

  categories: Category[] = [];
  navItems: NavItem[] = [];

  specialLinks = [
    { label: '🌐 Promotion', icon: 'fa-globe' },
    { label: '🎮 Jeux à Petit Prix', icon: 'fa-gamepad' }
  ];

  constructor(
    public router: Router,
    private api: ApiService
  ) {}

  ngOnInit(): void {
    this.loadCategories();
  }

  loadCategories() {
    this.api.getCategories().subscribe(cats => {
      this.categories = cats;
      this.navItems = cats.map(cat => ({
        label: cat.name,
        children: [{ label: 'Voir tout', link: `/shop?category=${cat.id}` }]
      }));
    });
  }

  selectCategory(categoryId: number) {
    this.carteCadeauOpen = false;
    this.categoryClick.emit(categoryId);
  }

  onBurgerClick(): void {
    this.burgerClick.emit();
  }

  toggleCarteCadeau()    { this.carteCadeauOpen = !this.carteCadeauOpen; }
  closeCarteCadeauMenu() { this.carteCadeauOpen = false; }

  selectCarteCadeauItem(name: string) {
    this.carteCadeauOpen = false;
    this.carteCadeauSelect.emit(name);
  }
}