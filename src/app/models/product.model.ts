export interface Product {
  id: number;
  name: string;
  description: string;
  price: number;
  category: string;
  imageUrl: string;
  quantity?: number;
}

export interface Slide {
  id: number;
  category: string;
  name: string;
  description: string;
  price: number;
  imageUrl: string;
  bgColor: string;
  glowColor: string;
  watermarkText: string;
}

export interface NavItem {
  label: string;
  children?: { label: string; link: string }[];
}

export interface DrawerGroup {
  label: string;
  children: { label: string; link: string }[];
}
