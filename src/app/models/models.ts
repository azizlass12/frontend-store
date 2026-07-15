// ============================================
// models/product.model.ts
// ============================================
export interface Product {
  id: number;
  name: string;
  description: string;
  price: number;
  stock: number;
  imageUrl: string;
  categoryId: number;
  categoryName: string;
  // ===== NOUVEAUX =====
  regions?: string;           // "Global,EU,US,TR"
  valuesAvailable?: string;   // "10$,20$,50$"
  pricesByValue?: string;     // JSON string
  regionList?: string[];      // parsé par le backend
  valueList?: string[];       // parsé par le backend
}

export interface Category {
  id: number;
  name: string;
  description: string;
  icon: string;
}

export interface CartItem {
  product: Product;
  quantity: number;
}

// ============================================
// models/chat.model.ts
// ============================================
export interface ChatSession {
  id: number;
  clientName: string;
  clientPhone: string;
  status: 'PENDING' | 'ACTIVE' | 'CLOSED';
  isReadByAdmin: boolean;
  orderItems: OrderItem[];
  messages: ChatMessage[];
  createdAt: string;
  unreadCount: number;
}

export interface OrderItem {
  productId: number;
  productName: string;
  quantity: number;
  unitPrice: number;
}

export interface ChatMessage {
  id?: number;
  senderType: 'CLIENT' | 'ADMIN';
  senderName: string;
  message: string;
  isRead: boolean;
  edited?: boolean;   // ← AJOUTER
  sentAt: string;
}

export interface CreateSessionRequest {
  clientName: string;
  clientPhone: string;
  items: {
    productId: number;
    productName: string;
    quantity: number;
    unitPrice: number;
  }[];
}

export interface SendMessageRequest {
  sessionId: number;
  message: string;
  senderType: string;
  senderName: string;
}

// ============================================
// models/auth.model.ts
// ============================================
export interface AuthRequest {
  username: string;
  password: string;
}

export interface AuthResponse {
  token: string;
  username: string;
  message: string;
  roles?: string[]; // ← AJOUTE

}

export interface ApiResponse<T> {
  success: boolean;
  message: string;
  data: T;
}
export interface SubCategory {
  name: string;
  items: string[];
}

export interface CardCategory {
  name: string;
  subCategories: SubCategory[];
}
