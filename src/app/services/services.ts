// ============================================
// services.ts — VERSION COMPLÈTE AVEC AUTH CLIENT
// ============================================
import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders, HttpParams } from '@angular/common/http';
import { Observable, BehaviorSubject } from 'rxjs';
import { map } from 'rxjs/operators';
import { Router } from '@angular/router';
import { Client, IMessage } from '@stomp/stompjs';
import {
  Product, Category, ApiResponse, AuthRequest, AuthResponse,
  ChatSession, CreateSessionRequest, SendMessageRequest, CartItem
} from '../models/models';
import { environment } from 'src/environments/environment';

// ============================================
// CLIENT AUTH SERVICE
// ============================================
export interface ClientUser {
  username: string;
  token: string;
}

@Injectable({ providedIn: 'root' })
export class ClientAuthService {
  private CLIENT_TOKEN_KEY = 'client_token';
  private CLIENT_NAME_KEY  = 'client_username';
  private currentUser$     = new BehaviorSubject<ClientUser | null>(this.getStoredUser());

  getStoredUser(): ClientUser | null {
    const token    = localStorage.getItem(this.CLIENT_TOKEN_KEY);
    const username = localStorage.getItem(this.CLIENT_NAME_KEY);
    return token && username ? { token, username } : null;
  }

  get user$()          { return this.currentUser$.asObservable(); }
  get currentUser()    { return this.currentUser$.value; }
  get isLoggedIn()     { return !!this.currentUser$.value; }
  getClientToken()     { return localStorage.getItem(this.CLIENT_TOKEN_KEY); }

  saveSession(token: string, username: string) {
    localStorage.setItem(this.CLIENT_TOKEN_KEY, token);
    localStorage.setItem(this.CLIENT_NAME_KEY, username);
    this.currentUser$.next({ token, username });
  }

  logout() {
    localStorage.removeItem(this.CLIENT_TOKEN_KEY);
    localStorage.removeItem(this.CLIENT_NAME_KEY);
    this.currentUser$.next(null);
  }
}

// ============================================
// API SERVICE
// ============================================
@Injectable({ providedIn: 'root' })
export class ApiService {

  private baseUrl = environment.apiUrl;

  constructor(private http: HttpClient) {}

  private getAuthHeaders(): HttpHeaders {
    const token = localStorage.getItem('admin_token');
    return token ? new HttpHeaders({ Authorization: `Bearer ${token}` }) : new HttpHeaders();
  }

  getMySessions(): Observable<ChatSession[]> {
    const token = localStorage.getItem('client_token');
    const headers = token
      ? new HttpHeaders({ Authorization: `Bearer ${token}` })
      : new HttpHeaders();
    return this.http.get<ApiResponse<ChatSession[]>>(
      `${this.baseUrl}/chat/my-sessions`, { headers }
    ).pipe(map(r => r.data));
  }

  editMessage(messageId: number, newText: string): Observable<ChatSession> {
    return this.http.put<ApiResponse<ChatSession>>(
      `${this.baseUrl}/chat/admin/message/${messageId}`,
      { message: newText },
      { headers: this.getAuthHeaders() }
    ).pipe(map(r => r.data));
  }

  deleteMessage(messageId: number): Observable<ChatSession> {
    return this.http.delete<ApiResponse<ChatSession>>(
      `${this.baseUrl}/chat/admin/message/${messageId}`,
      { headers: this.getAuthHeaders() }
    ).pipe(map(r => r.data));
  }

  private getClientHeaders(): HttpHeaders {
    const token = localStorage.getItem('client_token');
    return token ? new HttpHeaders({ Authorization: `Bearer ${token}` }) : new HttpHeaders();
  }

  login(req: AuthRequest): Observable<ApiResponse<AuthResponse>> {
    return this.http.post<ApiResponse<AuthResponse>>(`${this.baseUrl}/auth/login`, req);
  }

  clientRegister(username: string, password: string): Observable<ApiResponse<string>> {
    return this.http.post<ApiResponse<string>>(`${this.baseUrl}/auth/register`, { username, password });
  }

  clientLogin(username: string, password: string): Observable<ApiResponse<AuthResponse>> {
    return this.http.post<ApiResponse<AuthResponse>>(`${this.baseUrl}/auth/login`, { username, password });
  }

  getProducts(categoryId?: number, search?: string): Observable<Product[]> {
    let params = new HttpParams();
    if (categoryId) params = params.set('categoryId', categoryId.toString());
    if (search)     params = params.set('search', search);
    return this.http.get<ApiResponse<Product[]>>(`${this.baseUrl}/products`, { params })
      .pipe(map(r => r.data));
  }

  getCategories(): Observable<Category[]> {
    return this.http.get<ApiResponse<Category[]>>(`${this.baseUrl}/categories`)
      .pipe(map(r => r.data));
  }

  createProduct(product: Partial<Product>): Observable<Product> {
    return this.http.post<ApiResponse<Product>>(`${this.baseUrl}/admin/products`, product,
      { headers: this.getAuthHeaders() }).pipe(map(r => r.data));
  }

  updateProduct(id: number, product: Partial<Product>): Observable<Product> {
    return this.http.put<ApiResponse<Product>>(`${this.baseUrl}/admin/products/${id}`, product,
      { headers: this.getAuthHeaders() }).pipe(map(r => r.data));
  }

  deleteProduct(id: number): Observable<void> {
    return this.http.delete<ApiResponse<void>>(`${this.baseUrl}/admin/products/${id}`,
      { headers: this.getAuthHeaders() }).pipe(map(() => undefined));
  }

  createCategory(cat: Partial<Category>): Observable<Category> {
    return this.http.post<ApiResponse<Category>>(
      `${this.baseUrl}/admin/categories`, cat,
      { headers: this.getAuthHeaders() }
    ).pipe(map(r => r.data));
  }

  updateCategory(id: number, cat: Partial<Category>): Observable<Category> {
    return this.http.put<ApiResponse<Category>>(
      `${this.baseUrl}/admin/categories/${id}`, cat,
      { headers: this.getAuthHeaders() }
    ).pipe(map(r => r.data));
  }

  deleteCategory(id: number): Observable<void> {
    return this.http.delete<ApiResponse<void>>(
      `${this.baseUrl}/admin/categories/${id}`,
      { headers: this.getAuthHeaders() }
    ).pipe(map(() => undefined));
  }

  createSession(req: CreateSessionRequest): Observable<ChatSession> {
    return this.http.post<ApiResponse<ChatSession>>(`${this.baseUrl}/chat/session`, req)
      .pipe(map(r => r.data));
  }

  sendMessage(req: SendMessageRequest): Observable<ChatSession> {
    return this.http.post<ApiResponse<ChatSession>>(`${this.baseUrl}/chat/message`, req)
      .pipe(map(r => r.data));
  }

  getSession(id: number): Observable<ChatSession> {
    return this.http.get<ApiResponse<ChatSession>>(`${this.baseUrl}/chat/session/${id}/messages`)
      .pipe(map(r => r.data));
  }

  getSessionsByPhone(clientPhone: string): Observable<ChatSession[]> {
    return this.http.get<ApiResponse<ChatSession[]>>(
      `${this.baseUrl}/chat/sessions/by-phone?clientPhone=${encodeURIComponent(clientPhone)}`
    ).pipe(map(r => r.data));
  }

  getAllSessions(): Observable<ChatSession[]> {
    return this.http.get<ApiResponse<ChatSession[]>>(`${this.baseUrl}/chat/admin/sessions`,
      { headers: this.getAuthHeaders() }).pipe(map(r => r.data));
  }

  getUnreadCount(): Observable<number> {
    return this.http.get<ApiResponse<{ count: number }>>(`${this.baseUrl}/chat/admin/unread-count`,
      { headers: this.getAuthHeaders() }).pipe(map(r => r.data.count));
  }

  markSessionAsRead(id: number): Observable<void> {
    return this.http.post<ApiResponse<void>>(`${this.baseUrl}/chat/admin/session/${id}/read`, {},
      { headers: this.getAuthHeaders() }).pipe(map(() => undefined));
  }

  closeSession(id: number): Observable<void> {
    return this.http.delete<ApiResponse<void>>(
      `${this.baseUrl}/chat/admin/session/${id}`,
      { headers: this.getAuthHeaders() }
    ).pipe(map(() => undefined));
  }
}

// ============================================
// AUTH SERVICE (ADMIN)
// ============================================
@Injectable({ providedIn: 'root' })
export class AuthService {
  private loggedIn$ = new BehaviorSubject<boolean>(this.isLoggedIn());

  constructor(private api: ApiService, private router: Router) {}

  isLoggedIn(): boolean { return !!localStorage.getItem('admin_token'); }

  login(username: string, password: string) {
    return this.api.login({ username, password });
  }

  saveToken(token: string, username: string) {
    localStorage.setItem('admin_token', token);
    localStorage.setItem('admin_username', username);
    this.loggedIn$.next(true);
  }

  logout() {
    localStorage.removeItem('admin_token');
    localStorage.removeItem('admin_username');
    this.loggedIn$.next(false);
    this.router.navigate(['/admin']);
  }

  getUsername(): string { return localStorage.getItem('admin_username') || 'Admin'; }
  get isLoggedIn$()     { return this.loggedIn$.asObservable(); }
}

// ============================================
// CART SERVICE
// ============================================
@Injectable({ providedIn: 'root' })
export class CartService {
  private items$ = new BehaviorSubject<CartItem[]>([]);

  // ── Modal état ──────────────────────────────────────────────
  showAddedModal: boolean = false;
  lastAddedProduct: Product | null = null;

  get cart$()  { return this.items$.asObservable(); }
  get items()  { return this.items$.value; }

  addToCart(product: Product, quantity: number = 1) {
    const current  = this.items$.value;
    const existing = current.find(i => i.product.id === product.id);
    if (existing) {
      existing.quantity = Math.min(existing.quantity + quantity, product.stock);
      this.items$.next([...current]);
    } else {
      this.items$.next([...current, { product, quantity }]);
    }

    // Déclencher le modal
    this.lastAddedProduct = product;
    this.showAddedModal   = true;
  }

  closeAddedModal(): void {
    this.showAddedModal   = false;
    this.lastAddedProduct = null;
  }

  removeFromCart(productId: number) {
    this.items$.next(this.items$.value.filter(i => i.product.id !== productId));
  }

  updateQuantity(productId: number, quantity: number) {
    const items = this.items$.value;
    const item  = items.find(i => i.product.id === productId);
    if (item) {
      item.quantity = quantity;
      if (item.quantity <= 0) { this.removeFromCart(productId); }
      else { this.items$.next([...items]); }
    }
  }

  get total() { return this.items$.value.reduce((sum, i) => sum + i.product.price * i.quantity, 0); }
  get count() { return this.items$.value.reduce((sum, i) => sum + i.quantity, 0); }
  clear()     { this.items$.next([]); }
}

// ============================================
// WEBSOCKET SERVICE
// ============================================
@Injectable({ providedIn: 'root' })
export class WebSocketService {
  private client: Client | null = null;

  connect() {
    const wsUrl = environment.wsUrl.replace(/^http/, 'ws');
    this.client = new Client({
      brokerURL: wsUrl,
      reconnectDelay: 5000,
    });
    this.client.activate();
    return this.client;
  }

  subscribeToAdminNotifications(callback: (msg: any) => void) {
    if (!this.client) this.connect();
    this.client!.onConnect = () => {
      this.client!.subscribe('/topic/admin/notifications', (msg: IMessage) => {
        callback(JSON.parse(msg.body));
      });
    };
  }

  subscribeToChat(sessionId: number, callback: (msg: any) => void) {
    if (!this.client || !this.client.connected) this.connect();
    const subscribe = () => {
      this.client!.subscribe(`/topic/chat/${sessionId}`, (msg: IMessage) => {
        callback(JSON.parse(msg.body));
      });
    };
    if (this.client!.connected) { subscribe(); }
    else { this.client!.onConnect = () => subscribe(); }
  }

  disconnect() {
    if (this.client) { this.client.deactivate(); this.client = null; }
  }
}