import { Component, OnInit, OnDestroy, ViewChild, ElementRef, AfterViewChecked, ViewEncapsulation } from '@angular/core';
import { Subscription } from 'rxjs';
import { Product, Category, ChatSession } from '../../models/models';
import { ApiService, AuthService, WebSocketService } from '../../services/services';

@Component({
  selector: 'app-admin-dashboard',
  templateUrl: './admin-dashboard.component.html',
  styleUrls: ['./admin-dashboard.component.scss'],
  encapsulation: ViewEncapsulation.None
})
export class AdminDashboardComponent implements OnInit, OnDestroy, AfterViewChecked {

  @ViewChild('adminMessages') adminMessagesRef!: ElementRef;

  isLoggedIn = false;
  loginForm  = { username: '', password: '' };
  loginError = '';
  isLoading  = false;
  sidebarOpen = false;

  currentTab: 'chats' | 'products' | 'categories' = 'chats';

  sessions: ChatSession[]             = [];
  selectedSession: ChatSession | null = null;
  adminReply    = '';
  unreadCount   = 0;
  sessionSearch = '';
  pinnedSessionIds: Set<number> = new Set(
    JSON.parse(localStorage.getItem('pinned_sessions') || '[]')
  );
  private shouldScrollMessages = false;

  // ── Groupement par téléphone ──────────────────────────────────
  selectedPhone:    string | null   = null;
  groupedSessions:  ChatSession[]   = [];
  cachedMergedMessages: any[]       = []; // ← NOUVEAU

  // ── Produits ──────────────────────────────────────────────────
  adminProducts: Product[]      = [];
  showProductForm               = false;
  editingProduct: Product | null = null;
  productForm: Partial<Product> = {};
  productSaving                 = false;
  productError                  = '';
  productSuccess                = '';

  // ── Catégories ────────────────────────────────────────────────
  categories: Category[]           = [];
  showCatForm                      = false;
  editingCategory: Category | null = null;
  catForm: Partial<Category>       = {};
  catSaving                        = false;
  catError                         = '';
  catSuccess                       = '';

  iconOptions = [
    { value: 'gamepad',    emoji: '🎮', label: 'Gamepad'  },
    { value: 'monitor',    emoji: '🖥',  label: 'Monitor'  },
    { value: 'headphones', emoji: '🎧', label: 'Casque'   },
    { value: 'disc',       emoji: '💿', label: 'Disque'   },
    { value: 'chair',      emoji: '🪑', label: 'Chaise'   },
    { value: 'gamepade',   emoji: '🎁', label: 'Cadeau'   },
  ];

  confirmModal: {
    open: boolean; title: string; message: string;
    targetName: string; onConfirm: () => void;
  } = { open: false, title: '', message: '', targetName: '', onConfirm: () => {} };

  // ── Édition de message ────────────────────────────────────────
  editingMessage:  { id: number; text: string } | null = null;
  editMessageText  = '';

  private subscriptions: Subscription[] = [];
  private pollInterval: any;

  constructor(
    private api:         ApiService,
    private authService: AuthService,
    private wsService:   WebSocketService
  ) {}

  // ══════════════════════════════════════════════════════════════
  // LIFECYCLE
  // ══════════════════════════════════════════════════════════════
  ngOnInit() {
    this.isLoggedIn = this.authService.isLoggedIn();
    if (this.isLoggedIn) { this.initDashboard(); }
  }

  ngAfterViewChecked() {
    if (this.shouldScrollMessages) {
      this.scrollToBottom();
      this.shouldScrollMessages = false;
    }
  }

  ngOnDestroy() {
    this.subscriptions.forEach(s => s.unsubscribe());
    if (this.pollInterval) clearInterval(this.pollInterval);
    this.wsService.disconnect();
  }

  get adminUsername() { return this.authService.getUsername(); }

  private scrollToBottom() {
    try {
      const el = this.adminMessagesRef?.nativeElement;
      if (el) el.scrollTop = el.scrollHeight;
    } catch {}
  }

  // ══════════════════════════════════════════════════════════════
  // BUILD MERGED MESSAGES (remplace le getter)
  // ══════════════════════════════════════════════════════════════
  private buildMergedMessages(): void {
    const allMessages: any[] = [];
    const sortedSessions = [...this.groupedSessions].sort(
      (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
    );
    for (const session of sortedSessions) {
      const msgs = (session.messages || []).map((m: any, i: number) => ({
        ...m,
        sessionId:        session.id,
        orderLabel:       this.getOrderLabel(session),
        isFirstOfSession: i === 0,
        sessionStatus:    session.status
      }));
      allMessages.push(...msgs);
    }
    this.cachedMergedMessages = allMessages.sort(
      (a, b) => new Date(a.sentAt).getTime() - new Date(b.sentAt).getTime()
    );
  }

  // ══════════════════════════════════════════════════════════════
  // AUTH
  // ══════════════════════════════════════════════════════════════
private decodeJwtRoles(token: string): string[] {
  try {
    const payload = JSON.parse(atob(token.split('.')[1]));
    return payload.roles || [];
  } catch {
    return [];
  }
}

login() {
  if (!this.loginForm.username || !this.loginForm.password) {
    this.loginError = 'Veuillez remplir tous les champs.'; return;
  }
  this.isLoading = true; this.loginError = '';
  this.authService.login(this.loginForm.username, this.loginForm.password).subscribe({
    next: (res) => {
      if (res.success) {
        const roles = this.decodeJwtRoles(res.data.token);
        if (!roles.includes('ROLE_ADMIN')) {
          this.isLoading = false;
          this.loginError = '🚫 Accès refusé. Cette interface est réservée aux administrateurs.';
          return;
        }
        this.authService.saveToken(res.data.token, res.data.username);
        this.isLoggedIn = true;
        this.isLoading = false;
        this.initDashboard();
      }
    },
    error: () => { this.loginError = 'Identifiants invalides.'; this.isLoading = false; }
  });
}

  logout() {
    if (this.pollInterval) clearInterval(this.pollInterval);
    this.authService.logout(); this.isLoggedIn = false;
  }

  // ══════════════════════════════════════════════════════════════
  // INIT DASHBOARD
  // ══════════════════════════════════════════════════════════════
  initDashboard() {
    this.loadSessions();
    this.loadProducts();
    this.loadCategories();
    this.connectWebSocket();
    this.pollInterval = setInterval(() => {
      this.loadSessions();
      this.api.getUnreadCount().subscribe(count => this.unreadCount = count);
    }, 10000);
  }

  connectWebSocket() {
    this.wsService.subscribeToAdminNotifications((notification) => {
      if (notification.type === 'NEW_SESSION' || notification.type === 'NEW_MESSAGE') {
        this.loadSessions();
        this.api.getUnreadCount().subscribe(count => this.unreadCount = count);

        if (this.selectedPhone && notification.sessionId) {
          const concerned = this.groupedSessions.find(s => s.id === notification.sessionId);
          if (concerned) {
            this.api.getSession(notification.sessionId).subscribe(updated => {
              this.groupedSessions = this.groupedSessions.map(s =>
                s.id === updated.id ? updated : s
              );
              this.buildMergedMessages(); // ← AJOUTE
              this.shouldScrollMessages = true;
            });
          }
        }
      }
    });
  }

  setTab(tab: 'chats' | 'products' | 'categories') {
    this.currentTab = tab;
    this.sidebarOpen = false;
    if (tab === 'products')   { this.loadProducts(); }
    if (tab === 'categories') { this.loadCategories(); }
  }

  // ══════════════════════════════════════════════════════════════
  // SESSIONS
  // ══════════════════════════════════════════════════════════════
  loadSessions() {
    this.api.getAllSessions().subscribe({
      next: (sessions) => {
        this.sessions    = sessions;
        this.unreadCount = sessions.filter(s => !s.isReadByAdmin).length;

        if (this.selectedPhone) {
          const refreshed = sessions.filter(s => s.clientPhone === this.selectedPhone);
          if (refreshed.length) {
            this.groupedSessions = this.groupedSessions.map(existing => {
              const found = refreshed.find(r => r.id === existing.id);
              return found ? { ...found, messages: existing.messages } : existing;
            });
            this.buildMergedMessages(); // ← AJOUTE
            for (const s of refreshed) {
              if (!this.groupedSessions.find(g => g.id === s.id)) {
                this.api.getSession(s.id).subscribe(full => {
                  this.groupedSessions = [...this.groupedSessions, full];
                  this.buildMergedMessages(); // ← AJOUTE
                  this.shouldScrollMessages = true;
                });
              }
            }
          }
        }
      }
    });
  }

  // ── Groupement ────────────────────────────────────────────────
  get filteredSessions(): {
    phone: string; clientName: string;
    sessions: ChatSession[]; hasUnread: boolean; lastDate: string;
  }[] {
    let list = this.sessions;
    if (this.sessionSearch.trim()) {
      const q = this.sessionSearch.toLowerCase();
      list = list.filter(s =>
        s.clientName.toLowerCase().includes(q) || s.clientPhone.includes(q)
      );
    }

    const map = new Map<string, ChatSession[]>();
    for (const s of list) {
      if (!map.has(s.clientPhone)) map.set(s.clientPhone, []);
      map.get(s.clientPhone)!.push(s);
    }

    return Array.from(map.entries())
      .map(([phone, sessions]) => {
        const sorted = [...sessions].sort(
          (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
        );
        return {
          phone,
          clientName: sorted[0].clientName,
          sessions:   sorted,
          hasUnread:  sorted.some(s => !s.isReadByAdmin),
          lastDate:   sorted[0].createdAt
        };
      })
      .sort((a, b) => {
        const aPinned = this.pinnedSessionIds.has(a.sessions[0].id) ? 1 : 0;
        const bPinned = this.pinnedSessionIds.has(b.sessions[0].id) ? 1 : 0;
        if (bPinned !== aPinned) return bPinned - aPinned;
        return new Date(b.lastDate).getTime() - new Date(a.lastDate).getTime();
      });
  }

  // ── Ouvrir un groupe ──────────────────────────────────────────
  openPhoneGroup(group: { phone: string; clientName: string; sessions: ChatSession[] }) {
    this.selectedPhone   = group.phone;
    this.groupedSessions = [];
    this.selectedSession = null;
    this.adminReply      = '';
    this.cachedMergedMessages = [];

    for (const session of group.sessions) {
      if (!session.isReadByAdmin) {
        this.api.markSessionAsRead(session.id).subscribe(() => {
          session.isReadByAdmin = true;
          this.unreadCount = Math.max(0, this.unreadCount - 1);
        });
      }
    }

    const sorted = [...group.sessions].sort(
      (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
    );

    let loaded = 0;
    const results: ChatSession[] = new Array(sorted.length);
    sorted.forEach((s, i) => {
      this.api.getSession(s.id).subscribe(full => {
        results[i] = full;
        loaded++;
        if (loaded === sorted.length) {
          this.groupedSessions = results;
          this.buildMergedMessages(); // ← AJOUTE
          this.shouldScrollMessages = true;
        }
      });
    });
  }

  backToList() {
    this.selectedPhone        = null;
    this.groupedSessions      = [];
    this.cachedMergedMessages = [];
    this.selectedSession      = null;
    this.adminReply           = '';
  }

  // ── Session active pour envoi ─────────────────────────────────
  get activeSession(): ChatSession | null {
    return this.groupedSessions.find(s => s.status !== 'CLOSED') || null;
  }

  get allSessionsClosed(): boolean {
    return this.groupedSessions.length > 0 &&
           this.groupedSessions.every(s => s.status === 'CLOSED');
  }

  // ── Pin ───────────────────────────────────────────────────────
  togglePin(sessionId: number, event: Event) {
    event.stopPropagation();
    if (this.pinnedSessionIds.has(sessionId)) { this.pinnedSessionIds.delete(sessionId); }
    else { this.pinnedSessionIds.add(sessionId); }
    localStorage.setItem('pinned_sessions', JSON.stringify([...this.pinnedSessionIds]));
  }

  isPinned(id: number): boolean { return this.pinnedSessionIds.has(id); }

  // ── Clôturer une session ──────────────────────────────────────
  closeSession(sessionId: number): void {
    this.confirmModal = {
      open:       true,
      title:      'Clôturer la commande',
      message:    'La conversation sera clôturée et définitivement supprimée.',
      targetName: 'Commande',
      onConfirm:  () => {
        this.confirmModal.open = false;
        this.api.closeSession(sessionId).subscribe({
          next: () => {
            this.sessions        = this.sessions.filter(s => s.id !== sessionId);
            this.groupedSessions = this.groupedSessions.filter(s => s.id !== sessionId);
            this.buildMergedMessages(); // ← AJOUTE
            this.unreadCount = this.sessions.filter(s => !s.isReadByAdmin).length;
            if (this.groupedSessions.length === 0) { this.backToList(); }
          },
          error: () => alert('Erreur lors de la suppression.')
        });
      }
    };
  }

  // ══════════════════════════════════════════════════════════════
  // MESSAGES
  // ══════════════════════════════════════════════════════════════
  sendAdminMessage() {
    const targetSession = this.activeSession;
    if (!this.adminReply.trim() || !targetSession) return;

    const req = {
      sessionId:  targetSession.id,
      message:    this.adminReply.trim(),
      senderType: 'ADMIN',
      senderName: 'Support Gaming Shop'
    };
    const optimistic: any = {
      senderType:       'ADMIN' as const,
      senderName:       'Support Gaming Shop',
      message:          req.message,
      isRead:           true,
      sentAt:           new Date().toISOString(),
      sessionId:        targetSession.id,
      orderLabel:       this.getOrderLabel(targetSession),
      isFirstOfSession: false,
      sessionStatus:    targetSession.status
    };

    this.groupedSessions = this.groupedSessions.map(s =>
      s.id === targetSession.id
        ? { ...s, messages: [...(s.messages || []), optimistic] }
        : s
    );
    this.buildMergedMessages(); // ← AJOUTE
    this.adminReply           = '';
    this.shouldScrollMessages = true;

    this.api.sendMessage(req).subscribe({
      next: (updated) => {
        this.groupedSessions = this.groupedSessions.map(s =>
          s.id === updated.id ? updated : s
        );
        this.buildMergedMessages(); // ← AJOUTE
        this.shouldScrollMessages = true;
      }
    });
  }

  onEnterSend(event: Event) {
    if (!(event as KeyboardEvent).shiftKey) {
      event.preventDefault();
      this.sendAdminMessage();
    }
  }

  // ══════════════════════════════════════════════════════════════
  // ÉDITION / SUPPRESSION DE MESSAGES
  // ══════════════════════════════════════════════════════════════
  startEditMessage(msg: any): void {
    this.editingMessage  = { id: msg.id, text: msg.message };
    this.editMessageText = msg.message;
  }

  cancelEditMessage(): void {
    this.editingMessage  = null;
    this.editMessageText = '';
  }

  saveEditMessage(): void {
    if (!this.editingMessage || !this.editMessageText.trim()) return;
    this.api.editMessage(this.editingMessage.id, this.editMessageText.trim()).subscribe({
      next: (updated) => {
        this.groupedSessions = this.groupedSessions.map(s =>
          s.id === updated.id ? updated : s
        );
        this.buildMergedMessages(); // ← AJOUTE
        this.editingMessage  = null;
        this.editMessageText = '';
      },
      error: () => alert('Erreur lors de la modification du message.')
    });
  }

  confirmDeleteMessage(msg: any): void {
    this.confirmModal = {
      open:       true,
      title:      'Supprimer le message',
      message:    'Ce message sera définitivement supprimé.',
      targetName: `"${msg.message.slice(0, 60)}${msg.message.length > 60 ? '…' : ''}"`,
      onConfirm:  () => {
        this.confirmModal.open = false;
        this.api.deleteMessage(msg.id).subscribe({
          next: (updated) => {
            this.groupedSessions = this.groupedSessions.map(s =>
              s.id === updated.id ? updated : s
            );
            this.buildMergedMessages(); // ← AJOUTE
          },
          error: () => alert('Erreur lors de la suppression du message.')
        });
      }
    };
  }

  onEditKeydown(event: KeyboardEvent): void {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      this.saveEditMessage();
    } else if (event.key === 'Escape') {
      this.cancelEditMessage();
    }
  }

  // ══════════════════════════════════════════════════════════════
  // PRODUITS
  // ══════════════════════════════════════════════════════════════
  loadProducts() { this.api.getProducts().subscribe(p => this.adminProducts = p); }

  resetProductForm() {
    this.productForm    = { stock: 0, price: 0 };
    this.editingProduct = null;
    this.productError   = '';
    this.productSuccess = '';
  }

  openProductForm() { this.resetProductForm(); this.showProductForm = true; }

  editProduct(product: Product) {
    this.editingProduct  = product;
    this.productForm     = { ...product };
    this.showProductForm = true;
    this.productError    = '';
    this.productSuccess  = '';
  }

  saveProduct() {
    if (!this.productForm.name?.trim())
      { this.productError = 'Le nom est obligatoire.'; return; }
    if (!this.productForm.price || this.productForm.price <= 0)
      { this.productError = 'Le prix doit être > 0.'; return; }
    if (this.productForm.stock === undefined || this.productForm.stock < 0)
      { this.productError = 'Le stock ne peut pas être négatif.'; return; }

    this.productSaving = true; this.productError = '';
    const obs = this.editingProduct
      ? this.api.updateProduct(this.editingProduct.id, this.productForm)
      : this.api.createProduct(this.productForm);

    obs.subscribe({
      next: () => {
        this.productSaving  = false;
        this.productSuccess = this.editingProduct ? '✅ Produit mis à jour !' : '✅ Produit créé !';
        this.loadProducts();
        setTimeout(() => { this.showProductForm = false; this.resetProductForm(); }, 1400);
      },
      error: (err) => {
        this.productSaving = false;
        this.productError  = err?.error?.message || 'Erreur lors de la sauvegarde.';
      }
    });
  }

  confirmDeleteProduct(product: Product) {
    this.confirmModal = {
      open:       true,
      title:      'Supprimer le produit',
      message:    'Cette action est irréversible. Le produit sera définitivement supprimé.',
      targetName: product.name,
      onConfirm:  () => {
        this.confirmModal.open = false;
        this.api.deleteProduct(product.id).subscribe({
          next:  () => { this.loadProducts(); },
          error: () => { alert('Erreur lors de la suppression.'); }
        });
      }
    };
  }

  // ══════════════════════════════════════════════════════════════
  // CATÉGORIES
  // ══════════════════════════════════════════════════════════════
  loadCategories() { this.api.getCategories().subscribe(cats => this.categories = cats); }

  resetCatForm() {
    this.catForm         = {};
    this.editingCategory = null;
    this.catError        = '';
    this.catSuccess      = '';
  }

  openCatForm() { this.resetCatForm(); this.showCatForm = true; }

  editCategory(cat: Category) {
    this.editingCategory = cat;
    this.catForm         = { ...cat };
    this.showCatForm     = true;
    this.catError        = '';
    this.catSuccess      = '';
  }

  saveCategory() {
    if (!this.catForm.name?.trim()) { this.catError = 'Le nom est obligatoire.'; return; }
    this.catSaving = true; this.catError = '';
    const obs = this.editingCategory
      ? this.api.updateCategory(this.editingCategory.id, this.catForm)
      : this.api.createCategory(this.catForm);

    obs.subscribe({
      next: () => {
        this.catSaving  = false;
        this.catSuccess = this.editingCategory ? '✅ Catégorie mise à jour !' : '✅ Catégorie créée !';
        this.loadCategories();
        setTimeout(() => { this.showCatForm = false; this.resetCatForm(); }, 1400);
      },
      error: (err) => {
        this.catSaving = false;
        this.catError  = err?.error?.message || 'Erreur lors de la sauvegarde.';
      }
    });
  }

  confirmDeleteCategory(cat: Category) {
    this.confirmModal = {
      open:       true,
      title:      'Supprimer la catégorie',
      message:    'Attention : les produits liés perdront leur catégorie.',
      targetName: cat.name,
      onConfirm:  () => {
        this.confirmModal.open = false;
        this.api.deleteCategory(cat.id).subscribe({
          next:  () => { this.loadCategories(); },
          error: () => { alert('Impossible de supprimer. Des produits sont liés à cette catégorie.'); }
        });
      }
    };
  }

  getCatIcon(icon: string): string {
    const icons: { [key: string]: string } = {
      'gamepad': '🎮', 'monitor': '🖥', 'headphones': '🎧',
      'disc': '💿', 'chair': '🪑', 'gamepade': '🎁'
    };
    return icons[icon] || '📦';
  }

  onBackdropClick(event: Event, type: 'product' | 'cat') {
    if (type === 'product') { this.showProductForm = false; this.resetProductForm(); }
    else                    { this.showCatForm = false; this.resetCatForm(); }
  }

  // ── Helpers ───────────────────────────────────────────────────
  getSessionItemsLabel(session: ChatSession): string {
    if (!session.orderItems?.length) return '';
    return ' · ' + session.orderItems.map(i => i.productName).join(', ');
  }

  getOrderLabel(session: ChatSession): string {
    return `📦 Commande — ${new Date(session.createdAt).toLocaleDateString('fr-FR')}${this.getSessionItemsLabel(session)}`;
  }

  getChipItems(session: ChatSession): string {
    if (!session.orderItems?.length) return '';
    return session.orderItems.map(i => i.productName).join(', ');
  }

  getGroupOrderCount(group: { sessions: ChatSession[] }): string {
    const n = group.sessions.length;
    return `${n} commande${n > 1 ? 's' : ''}`;
  }

  getClientInitial(name: string): string {
    return name?.[0]?.toUpperCase() || '?';
  }

  getStatusLabel(status: string): string {
    const labels: { [k: string]: string } = {
      'PENDING': '🟡 En attente',
      'ACTIVE':  '🟢 Active',
      'CLOSED':  '⚫ Clôturée'
    };
    return labels[status] || status;
  }
}