import { Component, OnInit, OnDestroy, ViewChild, ElementRef, AfterViewChecked, ChangeDetectorRef, NgZone } from '@angular/core';
import { Router, ActivatedRoute } from '@angular/router';
import { Subscription } from 'rxjs';
import { ApiService, CartService, WebSocketService, ClientAuthService } from '../../services/services';
import { Product, ChatSession, Category } from '../../models/models';
import { HeaderComponent } from 'src/app/components/header/header.component';

@Component({
  selector: 'app-home',
  templateUrl: './home.component.html',
  styleUrls: ['./home.component.scss']
})
export class HomeComponent implements OnInit, OnDestroy, AfterViewChecked {

  @ViewChild('chatMessages') chatMessagesRef!: ElementRef;
  @ViewChild('profileMessages') profileMessagesRef!: ElementRef;
  @ViewChild('trackingMessages') trackingMessagesRef!: ElementRef;
  @ViewChild(HeaderComponent) headerComponent!: HeaderComponent;


  drawerOpen = false;
  trackingNewMessage = '';
  private shouldScrollTracking = false;

  // ── Products ──────────────────────────────────────────────
  currentSlide = 0;
  sliderInterval: any;
  slides: { product: Product; title: string; desc: string }[] = [];
  promoProducts: Product[] = [];
  newProducts: Product[] = [];
  exclusiveProducts: Product[] = [];
  selectedCategoryProducts: Product[] = [];
  selectedCategoryId: number | null = null;
  selectedCategoryName = '';
  searchQuery = '';
  categories: Category[] = [];

  // ── Cart (données pour les modales) ───────────────────────
  cartItems: any[] = [];

  // ── Toast ─────────────────────────────────────────────────
  toastVisible = false;
  toastProduct = '';
  private toastTimer: any;
profilePhone: string = '';

  // ── Client info ───────────────────────────────────────────
  clientName = '';
  clientPhone = '';
  formError = false;
  isLoading = false;

  // ── Chat ──────────────────────────────────────────────────
  chatSession: ChatSession | null = null;
  chatOpen = false;
  newMessage = '';

  // ── Auth modal ────────────────────────────────────────────
  authModalOpen = false;
  authMode: 'choice' | 'login' | 'register' | 'guest' = 'choice';
  authUsername = '';
  authPassword = '';
  authPassword2 = '';
  authLoading = false;
  authError = '';
  authSuccess = '';

  // ── Tracking ──────────────────────────────────────────────
  trackingOpen = false;
  trackingPhone = '';
  trackingLoading = false;
  trackingError = '';
  trackingSessions: ChatSession[] = [];
  selectedTrackingSession: ChatSession | null = null;
  trackingChatOpen = false;

  // ── Profile ───────────────────────────────────────────────
  profileOpen = false;
  profileLoading = false;
  profileError = '';
  profileAllSessions: ChatSession[] = []; // ← AJOUTE
  profileSessions: ChatSession[] = [];
  selectedProfileSession: ChatSession | null = null;
  profileChatOpen = false;
  profileNewMessage = '';

  // ── Scroll flags ──────────────────────────────────────────
  private shouldScrollChat = false;
  private shouldScrollProfile = false;
  private subscriptions: Subscription[] = [];

  constructor(
    private api: ApiService,
    public cartService: CartService,
    private wsService: WebSocketService,
    public clientAuth: ClientAuthService,
    private router: Router,
    private route: ActivatedRoute,
    private cdr: ChangeDetectorRef,
    private zone: NgZone
  ) {}

  // ══════════════════════════════════════════════════════════
  // LIFECYCLE
  // ══════════════════════════════════════════════════════════

  ngOnInit() {
    this.loadProducts();
    this.loadCategories();

    // S'abonner au panier (pour les récapitulatifs dans les modales)
    this.subscriptions.push(
      this.cartService.cart$.subscribe(items => this.cartItems = items)
    );

    this.route.queryParams.subscribe(params => {
      if (params['category']) {
        this.onCategorySelected(Number(params['category']));
      }
      if (params['checkout'] === 'true') {
        this.router.navigate([], {
          relativeTo: this.route,
          queryParams: {},
          replaceUrl: true
        });
        setTimeout(() => this.openAuthModal(), 50);
      }
    });

    if (this.clientAuth.isLoggedIn) {
      this.clientName = this.clientAuth.currentUser?.username || '';
    }
  }

  ngAfterViewChecked() {
    if (this.shouldScrollChat) {
      this.scrollToBottom(this.chatMessagesRef);
      this.shouldScrollChat = false;
    }
    if (this.shouldScrollProfile) {
      this.scrollToBottom(this.profileMessagesRef);
      this.shouldScrollProfile = false;
    }
    if (this.shouldScrollTracking) {
      this.scrollToBottom(this.trackingMessagesRef);
      this.shouldScrollTracking = false;
    }
  }

  ngOnDestroy() {
    if (this.sliderInterval) clearInterval(this.sliderInterval);
    this.subscriptions.forEach(s => s.unsubscribe());
    this.wsService.disconnect();
  }

  private scrollToBottom(ref: ElementRef) {
    try {
      const el = ref?.nativeElement;
      if (el) el.scrollTop = el.scrollHeight;
    } catch {}
  }

  // ══════════════════════════════════════════════════════════
  // DATA
  // ══════════════════════════════════════════════════════════

  loadCategories() {
    this.api.getCategories().subscribe(cats => this.categories = cats);
  }

  loadProducts() {
    this.api.getProducts().subscribe(products => {
      const withImg = products.filter(p => p.imageUrl && p.imageUrl.startsWith('http'));
      this.slides = withImg.slice(0, 3).map(p => ({
        product: p,
        title: p.name.toUpperCase(),
        desc: p.description
      }));
      this.startSlider();
      this.promoProducts = products.filter(p => p.stock <= 5 && p.stock > 0).slice(0, 5);
      if (this.promoProducts.length === 0) this.promoProducts = products.slice(0, 5);
      this.newProducts = products.slice(5, 10).length > 0 ? products.slice(5, 10) : products.slice(0, 5);
      this.exclusiveProducts = products.slice(10, 15).length > 0 ? products.slice(10, 15) : products.slice(0, 5);
    });
  }

  onCategorySelected(categoryId: number) {
    this.selectedCategoryId = categoryId;
    this.api.getProducts(categoryId).subscribe(products => {
      this.selectedCategoryProducts = products;
      this.selectedCategoryName = products[0]?.categoryName || 'Produits';
    });
  }

  clearCategoryFilter() {
    this.selectedCategoryId = null;
    this.selectedCategoryProducts = [];
    this.selectedCategoryName = '';
  }

  onSearch(query: string) {
    this.searchQuery = query;
    if (query) {
      this.selectedCategoryId = null;
      this.selectedCategoryProducts = [];
    }
  }

  selectCarteCadeauItem(name: string) {
    this.selectedCategoryId = 6;
    this.selectedCategoryName = name;
    this.api.getProducts(6).subscribe(products => {
      this.selectedCategoryProducts = products.filter(p =>
        p.name?.toLowerCase().includes(name.toLowerCase()) ||
        p.categoryName?.toLowerCase().includes(name.toLowerCase())
      );
    });
  }

  // ══════════════════════════════════════════════════════════
  // SLIDER
  // ══════════════════════════════════════════════════════════

  startSlider() {
    if (this.sliderInterval) clearInterval(this.sliderInterval);
    this.sliderInterval = setInterval(() => {
      this.currentSlide = (this.currentSlide + 1) % Math.max(this.slides.length, 1);
    }, 4000);
  }

  goToSlide(i: number) { this.currentSlide = i; }
  prevSlide() { this.currentSlide = (this.currentSlide - 1 + this.slides.length) % this.slides.length; }
  nextSlide() { this.currentSlide = (this.currentSlide + 1) % this.slides.length; }

  // ══════════════════════════════════════════════════════════
  // NAVIGATION
  // ══════════════════════════════════════════════════════════

  goToProduct(id: number) { this.router.navigate(['/product', id]); }

  goToShop(categoryId?: number) {
    if (categoryId) this.router.navigate(['/shop'], { queryParams: { cat: categoryId } });
    else this.router.navigate(['/shop']);
  }

  // ══════════════════════════════════════════════════════════
  // CART HELPERS (pour les modales uniquement)
  // ══════════════════════════════════════════════════════════

  get cartCount() { return this.cartService.count; }
  get cartTotal() { return this.cartService.total; }

  // ══════════════════════════════════════════════════════════
  // ADD TO CART + TOAST
  // ══════════════════════════════════════════════════════════



addToCart(product: Product, quantity: number = 1) {
  if (!product) return;
  this.cartService.addToCart(product, quantity);  // ← un seul endroit
  
  this.toastProduct = product.name || 'Produit';
  this.toastVisible = true;
  this.cdr.detectChanges();

  if (this.toastTimer) clearTimeout(this.toastTimer);
  this.toastTimer = setTimeout(() => {
    this.toastVisible = false;
    this.cdr.detectChanges();
  }, 4000);
}

 openCartFromToast() {
  this.toastVisible = false;
  // Ouvre le panier du Header
  if (this.headerComponent) {
    this.headerComponent.openCart();
  }
}

  closeAddedModal() {
    this.toastVisible = false;
  }

  goToCheckout() {
    this.toastVisible = false;
    this.openAuthModal();
  }

  // ══════════════════════════════════════════════════════════
  // AUTH MODAL
  // ══════════════════════════════════════════════════════════

openAuthModal() {
  if (this.clientAuth.isLoggedIn) {
    this.clientName = this.clientAuth.currentUser!.username;
    this.clientPhone = '';
    this.authError = '';
    this.authModalOpen = true;
    this.authMode = 'guest';
    this.cartItems = this.cartService.items; // ← synchronise le panier au moment d'ouverture
  } else {
    this.authModalOpen = true;
    this.authMode = 'choice';
    this.authError = '';
    this.authSuccess = '';
    this.authUsername = '';
    this.authPassword = '';
    this.authPassword2 = '';
  }
}

  closeAuthModal() {
    this.authModalOpen = false;
    this.authError = '';
    this.authSuccess = '';
  }

  setAuthMode(mode: 'choice' | 'login' | 'register' | 'guest') {
    this.authMode = mode;
    this.authError = '';
    this.authSuccess = '';
  }

doLogin() {
  if (!this.authUsername.trim() || !this.authPassword.trim()) {
    this.authError = 'Remplissez tous les champs.';
    return;
  }
  this.authLoading = true;
  this.authError = '';
  this.api.clientLogin(this.authUsername.trim(), this.authPassword).subscribe({
    next: (res) => {
      this.authLoading = false;
      this.clientAuth.saveSession(res.data.token, res.data.username);
      this.clientName = res.data.username;
      this.authSuccess = `Bienvenue ${res.data.username} ! 👋`;

      setTimeout(() => {
        this.authSuccess = '';
        // ✅ Si panier non vide → aller au checkout, sinon → profil
        if (this.cartService.count > 0) {
          this.cartItems = this.cartService.items; // sync panier
          this.clientPhone = '';
          this.authMode = 'guest'; // ← reste dans la modal, passe à l'étape téléphone
        } else {
          this.closeAuthModal();
          this.openProfile();
        }
      }, 800);
    },
    error: () => {
      this.authLoading = false;
      this.authError = 'Identifiant ou mot de passe incorrect.';
    }
  });
}

doRegister() {
  if (!this.authUsername.trim() || !this.authPassword.trim()) {
    this.authError = 'Remplissez tous les champs.';
    return;
  }
  if (this.authPassword !== this.authPassword2) {
    this.authError = 'Les mots de passe ne correspondent pas.';
    return;
  }
  this.authLoading = true;
  this.authError = '';
  this.api.clientRegister(this.authUsername.trim(), this.authPassword).subscribe({
    next: () => {
      this.api.clientLogin(this.authUsername.trim(), this.authPassword).subscribe({
        next: (res) => {
          this.authLoading = false;
          this.clientAuth.saveSession(res.data.token, res.data.username);
          this.clientName = res.data.username;
          this.authSuccess = 'Compte créé ! Bienvenue 🎉';
         setTimeout(() => {
  this.authSuccess = '';
  if (this.cartService.count > 0) {
    this.cartItems = this.cartService.items;
    this.clientPhone = '';
    this.authMode = 'guest';
  } else {
    this.closeAuthModal();
    this.openProfile();
  }
}, 800);
        },
        error: () => {
          this.authLoading = false;
          this.authSuccess = 'Compte créé ! Connectez-vous.';
          setTimeout(() => this.setAuthMode('login'), 1200);
        }
      });
    },
    error: (err) => {
      this.authLoading = false;
      this.authError = err?.error?.message || "Nom d'utilisateur déjà pris.";
    }
  });
}
openNewOrderFromProfile() {
  this.closeProfile();
  // Ferme tout et scroll vers les produits
  window.scrollTo({ top: 0, behavior: 'smooth' });
}



  clientLogout() {
    this.clientAuth.logout();
    this.clientName = '';
    this.clientPhone = '';
    this.closeProfile();
  }

  continueAsGuest() { this.authMode = 'guest'; }
confirmPhoneAndCheckout() {
  const phone = this.clientPhone.trim();

  // Validation numéro tunisien
  // Accepte : 9 chiffres commençant par 2,3,4,5,7,9
  // Avec ou sans indicatif +216 / 00216
  const cleaned = phone.replace(/^(\+216|00216)/, '').replace(/\s/g, '');
  const tunisianPhone = /^[2345679]\d{7}$/.test(cleaned);

  if (!phone) {
    this.authError = 'Numéro de téléphone requis.';
    return;
  }

  if (!tunisianPhone) {
    this.authError = 'Veuillez entrer un numéro tunisien valide (ex: 55 123 456).';
    return;
  }

  if (!this.clientAuth.isLoggedIn && !this.clientName.trim()) {
    this.authError = 'Veuillez entrer votre nom.';
    return;
  }

  if (this.clientAuth.isLoggedIn) {
    this.clientName = this.clientAuth.currentUser!.username;
  }

  // Normaliser le numéro avant envoi
  this.clientPhone = cleaned;

  this.formError = false;
  this.closeAuthModal();
  this.startChat();
}

  // ══════════════════════════════════════════════════════════
  // CHECKOUT / CHAT
  // ══════════════════════════════════════════════════════════

 startChat() {
  if (!this.clientName || !this.clientPhone) { 
    this.formError = true; 
    return; 
  }
  this.formError = false;
  this.isLoading = true;
  
  // ❌ SUPPRIME la recherche de session existante
  // ✅ Crée toujours une nouvelle session
  this.createNewSession();
}

 private createNewSession() {
  const req = {
    clientName: this.clientName.trim(),
    clientPhone: this.clientPhone.trim(),
    items: this.cartItems.map((i: any) => ({
      productId: i.product?.id || i.id,
      productName: i.product?.name || i.name,
      quantity: i.quantity || 1,
      unitPrice: i.product?.price || i.price
    }))
  };
  
  this.api.createSession(req).subscribe({
    next: (session) => {
      this.chatSession = session;
      this.chatOpen = true;
      this.isLoading = false;
      this.shouldScrollChat = true;
      this.subscribeToWebSocket(session.id);
      
      // ✅ Vider le panier après création de la commande
       this.cartService.clear();
    },
    error: () => {
      this.isLoading = false;
      alert('Erreur de connexion au serveur.');
    }
  });
}

  subscribeToWebSocket(sessionId: number) {
    this.wsService.subscribeToChat(sessionId, (notification) => {
      this.zone.run(() => {
        if (notification.type === 'SESSION_CLOSED') {
          this.chatSession = { ...this.chatSession!, status: 'CLOSED' };
          return;
        }
        if (this.chatSession && (notification.type === 'NEW_MESSAGE' || notification.message)) {
          this.api.getSession(this.chatSession.id).subscribe(session => {
            this.chatSession = session;
            this.shouldScrollChat = true;
          });
        }
      });
    });
  }

  sendClientMessage() {
    if (!this.newMessage.trim() || !this.chatSession) return;
    const req = {
      sessionId: this.chatSession.id,
      message: this.newMessage.trim(),
      senderType: 'CLIENT',
      senderName: this.clientName
    };
    const optimistic = {
      senderType: 'CLIENT' as const,
      senderName: this.clientName,
      message: req.message,
      isRead: false,
      sentAt: new Date().toISOString()
    };
    this.chatSession.messages = [...(this.chatSession.messages || []), optimistic];
    this.newMessage = '';
    this.shouldScrollChat = true;
    this.api.sendMessage(req).subscribe();
  }

  closeChat() {
    this.chatOpen = false;
    this.wsService.disconnect();
  }

  // ══════════════════════════════════════════════════════════
  // TRACKING
  // ══════════════════════════════════════════════════════════

  openTracking() {
    this.trackingOpen = true;
    this.trackingPhone = '';
    this.trackingError = '';
    this.trackingSessions = [];
    this.selectedTrackingSession = null;
    this.trackingChatOpen = false;
  }

  closeTracking() {
    this.trackingOpen = false;
    this.selectedTrackingSession = null;
    this.trackingChatOpen = false;
  }

  searchByPhone() {
    if (!this.trackingPhone.trim()) { this.trackingError = 'Veuillez entrer votre numéro de téléphone.'; return; }
    this.trackingLoading = true;
    this.trackingError = '';
    this.trackingSessions = [];
    this.api.getSessionsByPhone(this.trackingPhone.trim()).subscribe({
      next: (sessions: ChatSession[]) => {
        this.trackingLoading = false;
        if (!sessions || sessions.length === 0) this.trackingError = 'Aucune commande trouvée pour ce numéro.';
        else this.trackingSessions = sessions;
      },
      error: () => { this.trackingLoading = false; this.trackingError = 'Erreur de connexion. Réessayez.'; }
    });
  }

  openTrackingSession(session: ChatSession) {
    this.selectedTrackingSession = { ...session, messages: [...(session.messages || [])] };
    this.trackingChatOpen = true;
    this.trackingNewMessage = '';
    this.shouldScrollTracking = true;

    this.wsService.subscribeToChat(session.id, (msg: any) => {
      this.zone.run(() => {
        if (msg.type === 'SESSION_CLOSED') {
          if (this.selectedTrackingSession) {
            this.selectedTrackingSession = { ...this.selectedTrackingSession, status: 'CLOSED' };
          }
          return;
        }
        if (msg.senderType === 'ADMIN' && this.selectedTrackingSession?.id === session.id) {
          this.selectedTrackingSession = {
            ...this.selectedTrackingSession,
            messages: [...(this.selectedTrackingSession.messages || []), msg]
          };
          this.shouldScrollTracking = true;
        }
      });
    });
  }

  backToList() {
    this.selectedTrackingSession = null;
    this.trackingChatOpen = false;
    this.trackingNewMessage = '';
    this.wsService.disconnect();
  }

  sendTrackingMessage() {
    if (!this.trackingNewMessage.trim() || !this.selectedTrackingSession) return;
    if (this.selectedTrackingSession.status === 'CLOSED') return;

    const senderName = this.selectedTrackingSession.clientName;
    const req = {
      sessionId: this.selectedTrackingSession.id,
      message: this.trackingNewMessage.trim(),
      senderType: 'CLIENT',
      senderName: senderName
    };
    const optimistic = {
      senderType: 'CLIENT' as const,
      senderName: senderName,
      message: req.message,
      isRead: false,
      sentAt: new Date().toISOString()
    };
    this.selectedTrackingSession = {
      ...this.selectedTrackingSession,
      messages: [...(this.selectedTrackingSession.messages || []), optimistic]
    };
    this.trackingNewMessage = '';
    this.shouldScrollTracking = true;
    this.api.sendMessage(req).subscribe();
  }

  // ══════════════════════════════════════════════════════════
  // PROFILE
  // ══════════════════════════════════════════════════════════
openProfile() {
  if (!this.clientAuth.isLoggedIn) { this.openAuthModal(); return; }
  this.profileOpen = true;
  this.profileLoading = true;
  this.profileError = '';
  this.profileAllSessions = [];
  this.profileSessions = [];
  this.profilePhone = '';
  this.profileChatOpen = false;
  this.profileNewMessage = '';

  this.api.getMySessions().subscribe({
    next: (sessions: ChatSession[]) => {
      if (sessions.length === 0) {
        this.profileLoading = false;
        return;
      }

      let loaded = 0;
      const results: ChatSession[] = new Array(sessions.length);

      sessions.forEach((s, i) => {
        this.api.getSession(s.id).subscribe(full => {
          results[i] = full;
          loaded++;
          if (loaded === sessions.length) {
            // ✅ Stocker TOUTES les sessions avec leurs messages
            this.profileAllSessions = results;
            this.profileLoading = false;
          }
        });
      });
    },
    error: () => {
      this.profileLoading = false;
      this.profileError = 'Impossible de charger vos commandes.';
    }
  });
}
get profileGroups(): { phone: string; sessions: ChatSession[]; lastDate: string }[] {
  const map = new Map<string, ChatSession[]>();
  for (const s of this.profileAllSessions) {
    if (!map.has(s.clientPhone)) map.set(s.clientPhone, []);
    map.get(s.clientPhone)!.push(s);
  }
  return Array.from(map.entries()).map(([phone, sessions]) => {
    const sortedDesc = [...sessions].sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );
    return {
      phone,
      sessions: sortedDesc,
      lastDate: sortedDesc[0].createdAt
    };
  }).sort((a, b) => new Date(b.lastDate).getTime() - new Date(a.lastDate).getTime());
}

openProfileGroup(phone: string) {
  this.profilePhone = phone;
  this.profileSessions = this.profileAllSessions
    .filter(s => s.clientPhone === phone)
    .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
  this.profileChatOpen = true;
  this.shouldScrollProfile = true;
  this.profileSessions
    .filter(s => s.status !== 'CLOSED')
    .forEach(s => this.openProfileSession(s));
}

get mergedProfileMessages(): any[] {
  const allMessages: any[] = [];
  const sorted = [...this.profileSessions].sort(
    (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
  );
  for (const session of sorted) {
    const msgs = (session.messages || []).map((m: any, i: number) => ({
      ...m,
      sessionId: session.id,
      isFirstOfSession: i === 0,
      sessionDate: session.createdAt,
      sessionStatus: session.status,
      orderItems: session.orderItems
    }));
    allMessages.push(...msgs);
  }
  return allMessages.sort(
    (a, b) => new Date(a.sentAt).getTime() - new Date(b.sentAt).getTime()
  );
}

get activeProfileSession(): ChatSession | null {
  return this.profileSessions.find(s => s.status !== 'CLOSED') || null;
}

get allProfileSessionsClosed(): boolean {
  return this.profileSessions.length > 0 &&
         this.profileSessions.every(s => s.status === 'CLOSED');
}

closeProfile() {
  this.profileOpen = false;
  this.selectedProfileSession = null;
  this.profileChatOpen = false;
  this.profileNewMessage = '';
  this.profilePhone = '';
  this.profileSessions = [];
  this.profileAllSessions = [];
}

openProfileSession(session: ChatSession) {
  // Plus utilisé directement — le profil s'ouvre en vue unifiée
  // Mais on garde le WS pour chaque session
  this.wsService.subscribeToChat(session.id, (msg: any) => {
    this.zone.run(() => {
      if (msg.type === 'SESSION_CLOSED') {
        this.profileSessions = this.profileSessions.map(s =>
          s.id === session.id ? { ...s, status: 'CLOSED' } : s
        );
        return;
      }
      if (msg.senderType === 'ADMIN') {
        this.api.getSession(session.id).subscribe(updated => {
          this.profileSessions = this.profileSessions.map(s =>
            s.id === updated.id ? updated : s
          );
          this.shouldScrollProfile = true;
        });
      }
    });
  });
}

backToProfile() {
  this.profileChatOpen = false;
  this.profilePhone = '';
  this.profileSessions = [];
  this.profileNewMessage = '';
  this.wsService.disconnect();
}

 sendProfileMessage() {
  const targetSession = this.activeProfileSession;
  if (!this.profileNewMessage.trim() || !targetSession) return;

  const senderName = this.clientAuth.currentUser?.username || this.clientName;
  const req = {
    sessionId: targetSession.id,
    message: this.profileNewMessage.trim(),
    senderType: 'CLIENT',
    senderName: senderName
  };
  const optimistic: any = {
    senderType: 'CLIENT' as const,
    senderName: senderName,
    message: req.message,
    isRead: false,
    sentAt: new Date().toISOString(),
    sessionId: targetSession.id,
    isFirstOfSession: false,
    sessionStatus: targetSession.status
  };
  this.profileSessions = this.profileSessions.map(s =>
    s.id === targetSession.id
      ? { ...s, messages: [...(s.messages || []), optimistic] }
      : s
  );
  this.profileNewMessage = '';
  this.shouldScrollProfile = true;
  this.api.sendMessage(req).subscribe();
}

  // ══════════════════════════════════════════════════════════
  // UTILS
  // ══════════════════════════════════════════════════════════

  getStatusLabel(status: string): string {
    const labels: { [k: string]: string } = {
      'PENDING': '⏳ En attente',
      'ACTIVE': '✅ Actif',
      'CLOSED': '🔒 Clôturé'
    };
    return labels[status] || status;
  }

  getStatusClass(status: string): string {
    return ({ 'PENDING': 'status-pending', 'ACTIVE': 'status-active', 'CLOSED': 'status-closed' } as any)[status] || '';
  }
}