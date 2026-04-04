"use strict";
/* ═══════════════════════════════════════════════════════════
   CloudPay — ui.js
   Dépend de : utils.js   (DB, currentUser, fmtAmt, fmtDate, fmtDateShort, esc, exportCSV)
               payments.js (escrowCardHTML, txItemHTML, recalcSplitConfig, renderApiKeys,
                            renderWebhookList, saveSplitConfig)
   Contient :
   ── Navigation ─────────────────────────────────────────
   • NAV / PAGE_LABELS  → configuration des menus par mode
   • setMode()          → bascule entre Client / Marchand / Dev
   • buildNav()         → construit dynamiquement la sidebar
   • nav()              → affiche une page et met à jour le menu
   • afterRender()      → hooks post-rendu (tableaux, badges...)
   ── Rendu des pages ────────────────────────────────────
   • renderPage()       → dispatcher de pages
   • pageDashboard()    → tableau de bord
   • escrowCardHTML()   → carte d'un séquestre actif ou terminé
   • txItemHTML()       → ligne d'une transaction (cliquable)
   • pageEscrow()       → liste des paiements sécurisés
   • pageRecharge()     → recharge du compte
   • pageTransfer()     → transfert d'argent
   • pageTransactions() → historique complet
   • renderTxTable()    → peuple le tableau des transactions
   • pageNotifications()→ liste des notifications
   • pageProfile()      → profil utilisateur
   • pageSecurity()     → paramètres de sécurité
   • pageSplit()        → configuration du partage de revenus
   • pageAnalytics()    → analytiques marchand
   • pageMerchantCfg()  → configuration boutique
   • pageApiKeys()      → gestion des clés API
   • renderApiKeys()    → peuple la liste des clés
   • apiKeyRowHTML()    → rendu d'une ligne de clé API
   • pageApiDocs()      → documentation complète de l'API
   • epHTML()           → rendu d'un endpoint API cliquable
   • schemaStep()       → étape du schéma d'intégration
   • schemaArrow()      → flèche du schéma
   • pageDevPayments()  → configuration des moyens de paiement
   • pageWebhooks()     → gestion des webhooks
   • pageFraudCfg()     → configuration anti-fraude IA
   • pageSDK()          → SDK & Plugins
   ── Modales ────────────────────────────────────────────
   • openModal()        → ouvre une modale par ID
   • closeModal()       → ferme une modale par ID
   • showTxDetail()     → modale détail d'une transaction
   • showNotifDetail()  → modale détail d'une notification
   • showDetailModal()  → modale générique réutilisable
   ── Composants UI ──────────────────────────────────────
   • switchTab()        → bascule entre onglets
   • toggleEp()         → ouvre/ferme un endpoint API
   • updateNotifBadge() → met à jour le badge de notifications
   ── Toasts ─────────────────────────────────────────────
   • toast()            → notification temporaire en coin
═══════════════════════════════════════════════════════════ */

/* ─────────────────────────────────────────────
   CONFIGURATION DE LA NAVIGATION
   Chaque mode (user/merchant/dev) a sa propre
   liste d'items de menu.
───────────────────────────────────────────── */
const NAV = {
  user: [
    { lbl: 'Principal' },
    { id: 'dashboard',     ic: '🏠', txt: 'Tableau de bord' },
    { id: 'escrow',        ic: '🔒', txt: 'Paiement Sécurisé' },
    { id: 'recharge',      ic: '💳', txt: 'Recharger' },
    { id: 'transfer',      ic: '↗️', txt: 'Transfert' },
    { lbl: 'Activité' },
    { id: 'transactions',  ic: '📋', txt: 'Transactions' },
    { id: 'notifications', ic: '🔔', txt: 'Notifications', notif: true },
    { lbl: 'Compte' },
    { id: 'profile',       ic: '👤', txt: 'Profil' },
    { id: 'security',      ic: '🛡️', txt: 'Sécurité' },
  ],
  merchant: [
    { lbl: 'Principal' },
    { id: 'dashboard',     ic: '🏠', txt: 'Tableau de bord' },
    { id: 'escrow',        ic: '🔒', txt: 'Paiement Sécurisé' },
    { id: 'recharge',      ic: '💳', txt: 'Recharger' },
    { id: 'transfer',      ic: '↗️', txt: 'Transfert' },
    { lbl: 'Marchand' },
    { id: 'split',         ic: '⚖️', txt: 'Partage revenus',  tag: 'NEW' },
    { id: 'analytics',     ic: '📊', txt: 'Analytiques' },
    { id: 'merchant-cfg',  ic: '⚙️', txt: 'Configuration' },
    { lbl: 'Activité' },
    { id: 'transactions',  ic: '📋', txt: 'Transactions' },
    { id: 'notifications', ic: '🔔', txt: 'Notifications', notif: true },
    { lbl: 'Compte' },
    { id: 'profile',       ic: '👤', txt: 'Profil' },
    { id: 'security',      ic: '🛡️', txt: 'Sécurité' },
  ],
  dev: [
    { lbl: 'Tableau de bord' },
    { id: 'dashboard',     ic: '🏠', txt: 'Vue générale' },
    { lbl: 'Développeur' },
    { id: 'api-keys',      ic: '🔑', txt: 'Clés API' },
    { id: 'api-docs',      ic: '📖', txt: 'Documentation API' },
    { id: 'dev-payments',  ic: '💳', txt: 'Config. Paiements', tag: 'NEW' },
    { id: 'webhooks',      ic: '🔗', txt: 'Webhooks' },
    { id: 'fraud-cfg',     ic: '🛡️', txt: 'Anti-Fraude' },
    { id: 'sdk',           ic: '🧩', txt: 'SDK & Plugins' },
    { lbl: 'Activité' },
    { id: 'transactions',  ic: '📋', txt: 'Transactions' },
    { id: 'notifications', ic: '🔔', txt: 'Notifications', notif: true },
    { lbl: 'Compte' },
    { id: 'profile',       ic: '👤', txt: 'Profil' },
    { id: 'security',      ic: '🛡️', txt: 'Sécurité' },
  ]
};

const PAGE_LABELS = {
  dashboard:      'Tableau de bord',
  escrow:         'Paiement Sécurisé',
  recharge:       'Recharger',
  transfer:       'Transfert',
  transactions:   'Transactions',
  notifications:  'Notifications',
  profile:        'Profil',
  security:       'Sécurité',
  split:          'Partage de revenus',
  analytics:      'Analytiques',
  'merchant-cfg': 'Configuration Marchand',
  'api-keys':     'Clés API',
  'api-docs':     'Documentation API',
  'dev-payments': 'Configuration Paiements',
  webhooks:       'Webhooks',
  'fraud-cfg':    'Anti-Fraude',
  sdk:            'SDK & Plugins',
};

/* ─────────────────────────────────────────────
   NAVIGATION
───────────────────────────────────────────── */

/**
 * Change le mode d'affichage (Client / Marchand / Dev).
 * Reconstruit la sidebar et navigue vers la page d'accueil du mode.
 * @param {string} mode - 'user' | 'merchant' | 'dev'
 * @param {HTMLElement} btn - Bouton mode cliqué
 */
function setMode(mode, btn) {
  currentMode = mode;
  document.querySelectorAll('.mode-btn').forEach(b => b.classList.remove('active'));
  if (btn) btn.classList.add('active');
  buildNav(mode);
  nav(mode === 'dev' ? 'api-keys' : 'dashboard');
}

/**
 * Construit dynamiquement la navigation latérale
 * selon le mode actif.
 * @param {string} mode - Mode actif
 */
function buildNav(mode) {
  const navEl = document.getElementById('sideNav');
  navEl.innerHTML = (NAV[mode] || NAV.user).map(item => {
    if (item.lbl) return `<div class="nav-label">${item.lbl}</div>`;
    const notifHtml = item.notif
      ? `<span class="nav-badge" id="notifNavBadge" style="display:none;">0</span>`
      : '';
    const tagHtml = item.tag
      ? `<span class="nav-tag-new">${item.tag}</span>`
      : '';
    return `
      <button class="nav-item" id="nav-${item.id}" onclick="nav('${item.id}')">
        <span class="ic">${item.ic}</span>
        <span>${item.txt}</span>
        ${notifHtml}${tagHtml}
      </button>`;
  }).join('');
  updateNotifBadge();
}

/**
 * Navigue vers une page : rend le contenu HTML,
 * met à jour le menu actif et le fil d'Ariane.
 * @param {string} pageId - Identifiant de la page
 */
function nav(pageId) {
  const content = document.getElementById('mainContent');
  content.innerHTML = renderPage(pageId);

  /* Mettre à jour l'item actif dans la sidebar */
  document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
  const btn = document.getElementById('nav-' + pageId);
  if (btn) btn.classList.add('active');

  /* Mettre à jour le fil d'Ariane */
  document.getElementById('breadcrumb').textContent = PAGE_LABELS[pageId] || pageId;

  afterRender(pageId);
}

/**
 * Hooks exécutés après le rendu d'une page.
 * Permet d'initialiser des éléments nécessitant
 * que le DOM soit déjà présent.
 * @param {string} id - ID de la page rendue
 */
function afterRender(id) {
  if (id === 'transactions')  renderTxTable();
  if (id === 'notifications') { DB.markRead(); updateNotifBadge(); }
  if (id === 'split')         setTimeout(recalcSplitConfig, 50);
  if (id === 'api-keys')      renderApiKeys();
  if (id === 'webhooks')      renderWebhookList();
}

/* ─────────────────────────────────────────────
   DISPATCHER DE PAGES
───────────────────────────────────────────── */

/** Retourne le HTML de la page demandée. */
function renderPage(id) {
  switch (id) {
    case 'dashboard':     return pageDashboard();
    case 'escrow':        return pageEscrow();
    case 'recharge':      return pageRecharge();
    case 'transfer':      return pageTransfer();
    case 'transactions':  return pageTransactions();
    case 'notifications': return pageNotifications();
    case 'profile':       return pageProfile();
    case 'security':      return pageSecurity();
    case 'split':         return pageSplit();
    case 'analytics':     return pageAnalytics();
    case 'merchant-cfg':  return pageMerchantCfg();
    case 'api-keys':      return pageApiKeys();
    case 'api-docs':      return pageApiDocs();
    case 'dev-payments':  return pageDevPayments();
    case 'webhooks':      return pageWebhooks();
    case 'fraud-cfg':     return pageFraudCfg();
    case 'sdk':           return pageSDK();
    default: return `<div class="card"><p style="padding:20px;color:var(--muted);">Page "${id}" — bientôt disponible.</p></div>`;
  }
}

/* ─────────────────────────────────────────────
   PAGE : TABLEAU DE BORD
───────────────────────────────────────────── */
function pageDashboard() {
  const u       = currentUser;
  const balance = u ? u.balance : 0;
  const txs     = DB.getTx();
  const escrows = DB.getEscrows().filter(e => e.status === 'pending' || e.status === 'locked');
  const blocked = DB.getEscrows().filter(e => e.status === 'pending' || e.status === 'locked')
                    .reduce((s, e) => s + e.amount, 0);
  const totalIn = txs.filter(t => t.amount > 0).reduce((s, t) => s + t.amount, 0);

  const escrowCards = escrows.length
    ? escrows.map(e => escrowCardHTML(e)).join('')
    : `<div style="text-align:center;padding:24px;color:var(--muted);font-size:13px;">
        <div style="font-size:32px;margin-bottom:8px;">📦</div>Aucune commande active
        ${u ? `<br><button class="btn btn-ghost btn-sm" style="margin-top:10px;" onclick="openModal('escrowModal')">+ Nouveau paiement sécurisé</button>` : ''}
      </div>`;

  const recentTx = txs.slice(0, 5).map(t => txItemHTML(t)).join('')
    || `<div style="text-align:center;padding:20px;color:var(--muted);font-size:13px;">Aucune transaction</div>`;

  return `
  <div class="page-header">
    <div>
      <div class="ph-t">${u ? 'Bonjour, ' + esc(u.firstName) + ' 👋' : 'Bienvenue sur CloudPay 🔐'}</div>
      <div class="ph-s">${fmtDate(new Date())} · ${u ? 'Abidjan, CI' : 'Mode visiteur — explorez librement'}</div>
    </div>
    <div style="display:flex;gap:8px;">
      <button class="btn btn-ghost btn-sm" onclick="${u ? "openModal('rechargeModal')" : "openModal('loginModal')"}">💰 Recharger</button>
      <button class="btn btn-cta  btn-sm" onclick="${u ? "openModal('escrowModal')"  : "openModal('loginModal')"}">🔒 Paiement sécurisé</button>
    </div>
  </div>

  <div class="stats-row">
    <div class="stat">
      <div class="stat-label">Solde disponible</div>
      <div class="stat-value">${fmtAmt(balance)}</div>
      <div class="stat-sub">FCFA${!u ? ' (connectez-vous)' : ''}</div>
      <div class="stat-icon-bg si-indigo">💰</div>
    </div>
    <div class="stat">
      <div class="stat-label">En séquestre</div>
      <div class="stat-value">${fmtAmt(blocked)}</div>
      <div class="stat-sub">FCFA protégés</div>
      <div class="stat-icon-bg si-blue">🔒</div>
    </div>
    <div class="stat">
      <div class="stat-label">Total reçu</div>
      <div class="stat-value">${fmtAmt(totalIn)}</div>
      <div class="stat-sub">FCFA (cumul)</div>
      <div class="stat-icon-bg si-green">📈</div>
    </div>
    <div class="stat">
      <div class="stat-label">Transactions</div>
      <div class="stat-value">${txs.length}</div>
      <div class="stat-sub">total</div>
      <div class="stat-icon-bg si-amber">📋</div>
    </div>
  </div>

  <div class="card" style="margin-bottom:16px;">
    <div class="card-title">🔐 Comment CloudPay vous protège</div>
    <div class="flow-steps">
      <div class="fs"><div class="fs-dot done">💳</div><div class="fs-label">Vous payez via CloudPay</div></div>
      <div class="fs-line"></div>
      <div class="fs"><div class="fs-dot done">🏦</div><div class="fs-label">Argent en séquestre</div></div>
      <div class="fs-line"></div>
      <div class="fs"><div class="fs-dot active">📦</div><div class="fs-label">Vendeur expédie</div></div>
      <div class="fs-line-idle"></div>
      <div class="fs"><div class="fs-dot idle">✅</div><div class="fs-label">Vous validez</div></div>
      <div class="fs-line-idle"></div>
      <div class="fs"><div class="fs-dot idle">💸</div><div class="fs-label">Vendeur reçoit</div></div>
    </div>
    <p style="font-size:12px;color:var(--muted);text-align:center;margin-top:8px;">
      Si délai dépassé sans livraison → remboursement automatique sur votre compte
    </p>
  </div>

  <div class="g2">
    <div class="card">
      <div class="card-title"><div class="ct-icon" style="background:var(--am-light)">📦</div>Commandes actives</div>
      ${escrowCards}
    </div>
    <div class="card">
      <div class="card-title"><div class="ct-icon" style="background:var(--b-light)">📋</div>Transactions récentes</div>
      <div class="tx-list">${recentTx}</div>
      ${txs.length > 5 ? `<button class="btn btn-ghost btn-sm btn-full" style="margin-top:8px;" onclick="nav('transactions')">Voir tout →</button>` : ''}
    </div>
  </div>`;
}

/* ─────────────────────────────────────────────
   COMPOSANT : CARTE SÉQUESTRE
───────────────────────────────────────────── */
/**
 * Génère le HTML d'une carte de séquestre.
 * Le bouton "Valider livraison" n'apparaît QUE si
 * le statut est 'pending' ou 'locked' (commande active).
 */
function escrowCardHTML(e) {
  const now      = new Date();
  const deadline = new Date(e.deadline);
  const created  = new Date(e.createdAt);
  const span     = Math.max(1, deadline - created);
  const pct      = Math.min(100, Math.max(0, Math.round(((now - created) / span) * 100)));
  const daysLeft = Math.max(0, Math.ceil((deadline - now) / 86400000));
  const isActive = e.status === 'pending' || e.status === 'locked';

  const statusMap = {
    pending:   { chip: 'chip-amber',  lbl: '⏳ En attente livraison' },
    locked:    { chip: 'chip-indigo', lbl: '🔒 Verrouillé' },
    delivered: { chip: 'chip-green',  lbl: '✅ Livré & validé' },
    refunded:  { chip: 'chip-red',    lbl: '↩️ Remboursé' },
    cancelled: { chip: 'chip-gray',   lbl: '❌ Annulé' },
  };
  const { chip, lbl } = statusMap[e.status] || { chip: 'chip-gray', lbl: e.status };

  /* Actions : boutons uniquement pour les séquestres actifs */
  const actions = isActive ? `
    <div style="display:flex;gap:8px;margin-top:12px;">
      ${e.status !== 'locked'
        ? `<button class="btn btn-ghost btn-sm" onclick="cancelEscrow('${e.id}')">Annuler</button>`
        : `<button class="btn btn-ghost btn-sm" disabled style="opacity:.4;cursor:not-allowed;">🔒 Bloqué</button>`}
      <button class="btn btn-green btn-sm" style="flex:1;" onclick="openValidate('${e.id}')">
        📦 Le colis est arrivé — Valider
      </button>
    </div>
    <p style="font-size:11px;color:var(--muted);text-align:center;margin-top:5px;">
      ⚠️ Cliquez uniquement si vous avez reçu et vérifié le colis
    </p>`
  : `<div style="margin-top:10px;"><span class="chip ${chip}">${lbl}</span></div>`;

  return `
  <div class="escrow-card ${e.status}">
    <div class="ec-header">
      <div>
        <div class="ec-product">${esc(e.productName)}</div>
        <div class="ec-seller">${esc(e.sellerAccount)}</div>
      </div>
      <div style="text-align:right;">
        <div class="ec-amount">${fmtAmt(e.amount)} FCFA</div>
        <span class="chip ${chip}" style="margin-top:4px;">${lbl}</span>
      </div>
    </div>
    <div class="ec-row">
      <span class="ec-key">Date limite</span>
      <span style="color:var(--${isActive && daysLeft < 2 ? 'red' : 'amber'});font-weight:600;">
        ⏰ ${fmtDate(deadline)} ${isActive ? `(${daysLeft}j)` : ''}
      </span>
    </div>
    ${e.notes ? `<div class="ec-row"><span class="ec-key">Note</span><span>${esc(e.notes)}</span></div>` : ''}
    ${isActive ? `<div class="progress-bar" style="margin-top:8px;"><div class="progress-fill" style="width:${pct}%"></div></div>` : ''}
    ${actions}
  </div>`;
}

/* ─────────────────────────────────────────────
   COMPOSANT : LIGNE DE TRANSACTION (cliquable)
───────────────────────────────────────────── */
/**
 * Génère le HTML d'une ligne de transaction.
 * Cliquable pour afficher les détails complets.
 */
function txItemHTML(t) {
  const isPos    = t.amount > 0;
  const icons    = { escrow: '🔒', credit: '💰', debit: '↗️', split: '⚖️', refund: '↩️' };
  const classes  = { escrow: 'ti-escrow', credit: 'ti-in', debit: 'ti-out', split: 'ti-split', refund: 'ti-in' };
  const amtCls   = t.type === 'escrow' ? 'hold' : isPos ? 'pos' : 'neg';
  const statusM  = { pending: 'chip-amber', done: 'chip-green', failed: 'chip-red', refunded: 'chip-blue' };

  return `
  <div class="tx-item tx-item-clickable" onclick="showTxDetail('${t.id}')">
    <div class="tx-ico ${classes[t.type] || 'ti-in'}">${icons[t.type] || '💸'}</div>
    <div class="tx-meta">
      <div class="tx-name">${esc(t.description)}</div>
      <div class="tx-date">${fmtDateShort(new Date(t.ts))}</div>
    </div>
    <div class="tx-amt">
      <div class="tx-amount ${amtCls}">${isPos ? '+' : ''}${fmtAmt(t.amount)} FCFA</div>
      <span class="chip ${statusM[t.status] || 'chip-gray'}" style="margin-top:3px;">${t.statusLabel || t.status}</span>
    </div>
    <div style="color:var(--muted);font-size:16px;padding-left:4px;">›</div>
  </div>`;
}

/* ─────────────────────────────────────────────
   PAGES
───────────────────────────────────────────── */

function pageEscrow() {
  const all   = DB.getEscrows();
  const cards = all.length
    ? all.map(e => escrowCardHTML(e)).join('')
    : `<div style="text-align:center;padding:40px;color:var(--muted);">
        <div style="font-size:40px;margin-bottom:10px;">📦</div>
        <p>Aucun paiement sécurisé</p>
        <button class="btn btn-cta btn-sm" style="margin-top:14px;"
          onclick="${currentUser ? "openModal('escrowModal')" : "openModal('loginModal')"}">
          ${currentUser ? '+ Nouveau paiement' : 'Connectez-vous pour commencer'}
        </button>
      </div>`;
  return `
  <div class="page-header">
    <div><div class="ph-t">🔒 Paiements Sécurisés</div><div class="ph-s">Séquestre automatique — vos fonds sont protégés</div></div>
    ${currentUser ? `<button class="btn btn-cta btn-sm" onclick="openModal('escrowModal')">+ Nouveau paiement</button>` : ''}
  </div>
  <div class="g3" style="margin-bottom:16px;">
    <div class="alert alert-success"><div class="alert-icon">🛡️</div><div><div class="alert-title">Fonds 100% protégés</div><div class="alert-body">Bloqués jusqu'à validation ou date limite</div></div></div>
    <div class="alert alert-warn"><div class="alert-icon">⏰</div><div><div class="alert-title">Remboursement auto</div><div class="alert-body">Si délai dépassé sans livraison</div></div></div>
    <div class="alert alert-info"><div class="alert-icon">🔐</div><div><div class="alert-title">Chiffrement AES-256</div><div class="alert-body">Toutes les données sécurisées</div></div></div>
  </div>
  <div class="g2">
    <div>${cards}</div>
    <div class="card">
      <div class="card-title">❓ Comment ça marche</div>
      <div class="step-row"><div class="step-num">1</div><div><div class="step-title">Copiez l'URL du produit</div><div class="step-desc">Depuis Jumia, Amazon ou tout site e-commerce</div></div></div>
      <div class="step-row"><div class="step-num">2</div><div><div class="step-title">Remplissez les informations</div><div class="step-desc">Nom, montant, compte vendeur, date limite</div></div></div>
      <div class="step-row"><div class="step-num">3</div><div><div class="step-title">Votre argent est bloqué</div><div class="step-desc">Le vendeur est notifié mais ne peut pas encore retirer</div></div></div>
      <div class="step-row"><div class="step-num">4</div><div><div class="step-title">Livraison → Vous validez</div><div class="step-desc">Le vendeur reçoit son argent immédiatement</div></div></div>
      <div class="step-row" style="margin-bottom:0;"><div class="step-num">5</div><div><div class="step-title">Pas de livraison → Remboursement auto</div><div class="step-desc">À l'échéance, votre argent vous revient automatiquement</div></div></div>
    </div>
  </div>`;
}

function pageRecharge() {
  const bal = currentUser ? currentUser.balance : 0;
  return `
  <div class="page-header">
    <div><div class="ph-t">💳 Recharger</div><div class="ph-s">Ajoutez des fonds à votre compte</div></div>
    ${currentUser ? `<button class="btn btn-cta btn-sm" onclick="openModal('rechargeModal')">+ Recharger</button>` : ''}
  </div>
  <div class="g2">
    <div class="card">
      <div class="card-title">💰 Solde actuel</div>
      <div style="text-align:center;padding:28px 0;">
        <div style="font-size:13px;color:var(--muted);margin-bottom:6px;">Disponible</div>
        <div style="font-size:48px;font-weight:800;color:var(--accent);letter-spacing:-2px;">${fmtAmt(bal)}</div>
        <div style="font-size:15px;color:var(--muted);margin-top:4px;">FCFA</div>
      </div>
      <div class="divider"></div>
      <div class="kv-row"><span class="kv-key">Frais de recharge</span><span class="kv-val" style="color:var(--green);">Gratuit</span></div>
      <div class="kv-row"><span class="kv-key">Limite journalière</span><span class="kv-val">2 000 000 FCFA</span></div>
      <div class="kv-row"><span class="kv-key">Délai crédit</span><span class="kv-val">Instantané</span></div>
      ${currentUser
        ? `<button class="btn btn-cta btn-full btn-lg" style="margin-top:20px;" onclick="openModal('rechargeModal')">Recharger maintenant →</button>`
        : `<button class="btn btn-cta btn-full btn-lg" style="margin-top:20px;" onclick="openModal('loginModal')">Connexion requise →</button>`}
    </div>
    <div class="card">
      <div class="card-title">📋 Historique recharges</div>
      <div class="tx-list">
        ${DB.getTx().filter(t => t.type === 'credit').slice(0, 8).map(t => txItemHTML(t)).join('')
          || '<p style="text-align:center;color:var(--muted);padding:20px;font-size:13px;">Aucune recharge</p>'}
      </div>
    </div>
  </div>`;
}

function pageTransfer() {
  return `
  <div class="page-header">
    <div><div class="ph-t">↗️ Transfert</div><div class="ph-s">Envoyez des fonds rapidement</div></div>
  </div>
  <div class="g2">
    <div class="card">
      <div class="card-title">Nouveau transfert</div>
      <div class="tabs">
        <button class="tab-btn active" onclick="switchTab(this,'tp-coud')">CloudPay</button>
        <button class="tab-btn" onclick="switchTab(this,'tp-mobile')">Mobile Money</button>
        <button class="tab-btn" onclick="switchTab(this,'tp-bank')">Banque</button>
      </div>
      <div class="tab-pane active" id="tp-coud">
        <div class="form-group"><label class="form-label">👤 Destinataire <span class="label-hint">Email ou n° CloudPay</span></label><input type="text" class="form-input" id="trDest" placeholder="email@cloudpay.ci"/></div>
        <div class="form-group"><label class="form-label">💵 Montant (FCFA)</label><div class="input-group"><span class="ig-pre">FCFA</span><input type="number" class="form-input" id="trAmt" placeholder="0"/></div></div>
        <div class="form-group"><label class="form-label">📝 Motif (optionnel)</label><input type="text" class="form-input" id="trReason" placeholder="Remboursement, achat..."/></div>
        <button class="btn btn-cta btn-full" onclick="initTransfer('coud')">Envoyer →</button>
      </div>
      <div class="tab-pane" id="tp-mobile">
        <div class="form-group"><label class="form-label">Opérateur</label><select class="form-select" id="trOp"><option>Orange Money</option><option>MTN MoMo</option><option>Wave</option><option>Moov Money</option></select></div>
        <div class="form-group"><label class="form-label">📱 Numéro</label><input type="tel" class="form-input" id="trPhone" placeholder="+225 07 00 00 00 00"/></div>
        <div class="form-group"><label class="form-label">💵 Montant (FCFA)</label><div class="input-group"><span class="ig-pre">FCFA</span><input type="number" class="form-input" id="trAmtM" placeholder="0"/></div></div>
        <button class="btn btn-cta btn-full" onclick="initTransfer('mobile')">Envoyer →</button>
      </div>
      <div class="tab-pane" id="tp-bank">
        <div class="form-group"><label class="form-label">🏦 Banque</label><select class="form-select"><option>SGCI</option><option>BICICI</option><option>Ecobank</option><option>BOA</option><option>SIB</option></select></div>
        <div class="form-group"><label class="form-label">N° Compte / IBAN</label><input type="text" class="form-input" id="trIban" placeholder="CI00 0000 0000 0000"/></div>
        <div class="form-group"><label class="form-label">💵 Montant (FCFA)</label><div class="input-group"><span class="ig-pre">FCFA</span><input type="number" class="form-input" id="trAmtB" placeholder="0"/></div></div>
        <button class="btn btn-cta btn-full" onclick="initTransfer('bank')">Virer →</button>
      </div>
    </div>
    <div class="card">
      <div class="card-title">⚡ Transferts récents</div>
      <div class="tx-list">
        ${DB.getTx().filter(t => t.type === 'debit').slice(0, 6).map(t => txItemHTML(t)).join('')
          || '<p style="text-align:center;color:var(--muted);padding:20px;font-size:13px;">Aucun transfert</p>'}
      </div>
    </div>
  </div>`;
}

function pageTransactions() {
  return `
  <div class="page-header">
    <div><div class="ph-t">📋 Transactions</div><div class="ph-s">Historique complet · Cliquez sur une ligne pour les détails</div></div>
    <button class="btn btn-ghost btn-sm" onclick="exportCSV()">📥 Exporter CSV</button>
  </div>
  <div class="card">
    <div id="txTableContainer"><p style="padding:20px;text-align:center;color:var(--muted);">Chargement...</p></div>
  </div>`;
}

function renderTxTable() {
  const txs = DB.getTx();
  const el  = document.getElementById('txTableContainer');
  if (!el) return;

  if (!txs.length) {
    el.innerHTML = `<div style="text-align:center;padding:40px;color:var(--muted);">
      <div style="font-size:40px;margin-bottom:10px;">📋</div><p>Aucune transaction</p></div>`;
    return;
  }

  const smMap = { pending: 'chip-amber', done: 'chip-green', failed: 'chip-red', refunded: 'chip-blue' };
  el.innerHTML = `
  <div class="table-wrap"><table>
    <thead><tr><th>ID</th><th>Description</th><th>Type</th><th>Montant</th><th>Statut</th><th>Date</th></tr></thead>
    <tbody>
      ${txs.map(t => {
        const isPos = t.amount > 0;
        const color = t.type === 'escrow' ? 'var(--amber)' : isPos ? 'var(--green)' : 'var(--red)';
        const typeL = { escrow: '🔒 Séquestre', credit: '💰 Crédit', debit: '↗️ Débit', split: '⚖️ Split', refund: '↩️ Remboursement' }[t.type] || t.type;
        return `<tr onclick="showTxDetail('${t.id}')" style="cursor:pointer;">
          <td><code style="font-size:11px;color:var(--accent);">${t.id}</code></td>
          <td style="max-width:200px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${esc(t.description)}</td>
          <td>${typeL}</td>
          <td style="font-weight:700;color:${color};">${isPos ? '+' : ''}${fmtAmt(t.amount)} FCFA</td>
          <td><span class="chip ${smMap[t.status] || 'chip-gray'}">${t.statusLabel || t.status}</span></td>
          <td style="color:var(--muted);font-size:12px;">${fmtDateShort(new Date(t.ts))}</td>
        </tr>`;
      }).join('')}
    </tbody>
  </table></div>`;
}

function pageNotifications() {
  const notifs = DB.getNotifs();
  if (!notifs.length) return `
  <div class="page-header"><div><div class="ph-t">🔔 Notifications</div></div></div>
  <div class="card"><div style="text-align:center;padding:40px;color:var(--muted);">
    <div style="font-size:40px;margin-bottom:10px;">🔔</div><p>Aucune notification</p>
  </div></div>`;

  return `
  <div class="page-header">
    <div><div class="ph-t">🔔 Notifications</div><div class="ph-s">${notifs.length} notification(s) · Cliquez pour voir les détails</div></div>
  </div>
  ${notifs.map(n => {
    const bc = n.type === 'error' ? 'var(--red)' : n.type === 'warn' ? 'var(--amber)' : 'var(--accent)';
    const cc = n.type === 'error' ? 'chip-red'  : n.type === 'warn' ? 'chip-amber'  : 'chip-indigo';
    const cl = n.type === 'error' ? 'Urgente'   : n.type === 'warn' ? 'Avertissement' : 'Info';
    return `
    <div class="card notif-card" onclick="showNotifDetail('${n.id}')"
         style="margin-bottom:10px;border-left:3px solid ${bc};">
      <div style="display:flex;gap:14px;align-items:flex-start;">
        <div style="font-size:24px;">${n.icon || '🔔'}</div>
        <div style="flex:1;">
          <div style="font-weight:700;font-size:14px;">${esc(n.title)}</div>
          <div style="font-size:13px;color:var(--t2);margin-top:4px;">${esc(n.body)}</div>
          <div style="font-size:11px;color:var(--muted);margin-top:5px;">🕐 ${fmtDateShort(new Date(n.ts))}</div>
        </div>
        <div style="display:flex;flex-direction:column;align-items:flex-end;gap:6px;">
          <span class="chip ${cc}">${cl}</span>
          <span style="font-size:11px;color:var(--muted);">Voir ›</span>
        </div>
      </div>
    </div>`;
  }).join('')}`;
}

function pageProfile() {
  const u = currentUser;
  if (!u) return `
  <div class="page-header"><div><div class="ph-t">👤 Profil</div></div></div>
  <div class="card" style="text-align:center;padding:40px;">
    <div style="font-size:48px;margin-bottom:14px;">👤</div>
    <div style="font-size:18px;font-weight:700;margin-bottom:8px;">Vous n'êtes pas connecté</div>
    <p style="color:var(--muted);margin-bottom:20px;">Créez un compte ou connectez-vous pour accéder à votre profil.</p>
    <div style="display:flex;gap:10px;justify-content:center;">
      <button class="btn btn-ghost" onclick="openModal('loginModal')">Se connecter</button>
      <button class="btn btn-cta"   onclick="openModal('registerModal')">Créer un compte</button>
    </div>
  </div>`;

  return `
  <div class="page-header"><div><div class="ph-t">👤 Mon Profil</div></div></div>
  <div class="g2">
    <div class="card">
      <div style="display:flex;align-items:center;gap:16px;margin-bottom:20px;">
        <div class="avatar" style="width:60px;height:60px;font-size:22px;">${(u.firstName[0] + u.lastName[0]).toUpperCase()}</div>
        <div>
          <div style="font-size:18px;font-weight:800;">${esc(u.firstName)} ${esc(u.lastName)}</div>
          <div style="font-size:13px;color:var(--muted);">${esc(u.email)}</div>
          <span class="chip chip-green" style="margin-top:6px;">✓ Compte actif</span>
        </div>
      </div>
      <div class="form-row">
        <div class="form-group"><label class="form-label">Prénom</label><input type="text" class="form-input" id="pfFirst" value="${esc(u.firstName)}"/></div>
        <div class="form-group"><label class="form-label">Nom</label><input type="text" class="form-input" id="pfLast" value="${esc(u.lastName)}"/></div>
      </div>
      <div class="form-group"><label class="form-label">Email</label><input type="email" class="form-input" id="pfEmail" value="${esc(u.email)}"/></div>
      <div class="form-group"><label class="form-label">Téléphone</label><input type="tel" class="form-input" id="pfPhone" value="${esc(u.phone || '')}"/></div>
      <button class="btn btn-cta" onclick="saveProfile()">💾 Enregistrer</button>
    </div>
    <div>
      <div class="card" style="margin-bottom:14px;">
        <div class="card-title">📊 Résumé</div>
        <div class="kv-row"><span class="kv-key">ID</span><code style="font-size:11px;color:var(--accent);">${u.id}</code></div>
        <div class="kv-row"><span class="kv-key">Type</span><span class="kv-val">${{ personal: 'Particulier', merchant: 'Marchand', developer: 'Développeur' }[u.type] || u.type}</span></div>
        <div class="kv-row"><span class="kv-key">Membre depuis</span><span class="kv-val">${fmtDate(new Date(u.createdAt))}</span></div>
        <div class="kv-row"><span class="kv-key">Transactions</span><span class="kv-val">${DB.getTx().length}</span></div>
        <div class="kv-row"><span class="kv-key">Solde</span><span class="kv-val" style="color:var(--accent);">${fmtAmt(u.balance)} FCFA</span></div>
      </div>
      <div class="card" style="border:1.5px solid var(--r-light);">
        <div class="card-title" style="color:var(--red);">⚠️ Déconnexion</div>
        <p style="font-size:13px;color:var(--t2);margin-bottom:14px;">Vos données sont sauvegardées — reconnectez-vous à tout moment.</p>
        <button class="btn btn-red btn-full" onclick="confirmLogout()">🚪 Se déconnecter</button>
      </div>
    </div>
  </div>`;
}

function pageSecurity() {
  return `
  <div class="page-header"><div><div class="ph-t">🛡️ Sécurité</div></div></div>
  <div class="g2">
    <div class="card">
      <div class="card-title">Paramètres de sécurité</div>
      <div class="toggle-wrap"><div class="toggle-info"><div class="tl">🔐 Authentification 2FA</div><div class="ts">Code OTP par SMS à chaque connexion</div></div><button class="toggle on" onclick="this.classList.toggle('on')"></button></div>
      <div class="toggle-wrap"><div class="toggle-info"><div class="tl">📧 Alertes email</div><div class="ts">Notification pour chaque paiement</div></div><button class="toggle on" onclick="this.classList.toggle('on')"></button></div>
      <div class="toggle-wrap"><div class="toggle-info"><div class="tl">🔒 PIN obligatoire</div><div class="ts">Code PIN à 6 chiffres pour chaque paiement</div></div><button class="toggle on" onclick="this.classList.toggle('on')"></button></div>
      <div class="toggle-wrap" style="border-bottom:none;"><div class="toggle-info"><div class="tl">📍 Vérification localisation</div><div class="ts">Alerte si connexion depuis nouvel appareil</div></div><button class="toggle on" onclick="this.classList.toggle('on')"></button></div>
    </div>
    <div class="card">
      <div class="card-title">🔑 Changer le PIN</div>
      <div class="form-group"><label class="form-label">PIN actuel</label><input type="password" class="form-input" id="oldPin" maxlength="6" placeholder="••••••"/></div>
      <div class="form-group"><label class="form-label">Nouveau PIN (6 chiffres)</label><input type="password" class="form-input" id="newPin" maxlength="6" placeholder="••••••"/></div>
      <div class="form-group"><label class="form-label">Confirmer</label><input type="password" class="form-input" id="cPin2" maxlength="6" placeholder="••••••"/></div>
      <button class="btn btn-cta btn-full" onclick="changePin()">Modifier le PIN</button>
    </div>
  </div>`;
}

function pageSplit() {
  const rules = DB.getSplitRules();
  const cfg   = DB.getDevCfg().split_config || { seller: 70, platform: 25, delivery: 5, delivery_enabled: false };
  return `
  <div class="page-header">
    <div><div class="ph-t">⚖️ Partage de revenus</div><div class="ph-s">Distribution automatique à chaque validation de livraison</div></div>
    <button class="btn btn-cta btn-sm" onclick="saveSplitConfig()">💾 Sauvegarder</button>
  </div>
  <div class="alert alert-info" style="margin-bottom:18px;">
    <div class="alert-icon">💡</div>
    <div><div class="alert-title">Comment fonctionne le partage</div>
    <div class="alert-body">Quand un client valide une livraison, CloudPay distribue instantanément le montant selon les pourcentages définis. Le livreur est optionnel. La somme doit toujours être égale à 100%.</div></div>
  </div>
  <div class="g2">
    <div>
      <div class="card" style="margin-bottom:16px;">
        <div class="card-title">👥 Bénéficiaires</div>
        <div class="split-party-card" style="border-left:4px solid var(--green);background:var(--g-light);">
          <div class="split-party-header">
            <div class="split-party-icon" style="background:var(--green);">🏪</div>
            <div class="split-party-info">
              <div class="split-party-name">Vendeur</div>
              <div class="split-party-desc">Reçoit le paiement principal. Versement immédiat après validation de la livraison.</div>
            </div>
            <span class="chip chip-green">Obligatoire</span>
          </div>
          <div class="form-group" style="margin-top:10px;margin-bottom:0;">
            <label class="form-label">Pourcentage vendeur</label>
            <div class="input-group suf"><input type="number" class="form-input" id="sp-seller" min="0" max="100" value="${cfg.seller}" oninput="recalcSplitConfig()"/><span class="ig-suf">%</span></div>
            <div class="form-hint">💡 Part reversée au marchand après confirmation du client</div>
          </div>
        </div>
        <div class="split-party-card" style="border-left:4px solid var(--accent);background:var(--a-light);">
          <div class="split-party-header">
            <div class="split-party-icon" style="background:var(--accent);">🏛️</div>
            <div class="split-party-info">
              <div class="split-party-name">Plateforme CloudPay</div>
              <div class="split-party-desc">Commission couvrant la protection escrow, l'anti-fraude IA, et le traitement des paiements mobiles.</div>
            </div>
            <span class="chip chip-indigo">Obligatoire</span>
          </div>
          <div class="form-group" style="margin-top:10px;margin-bottom:0;">
            <label class="form-label">Commission plateforme</label>
            <div class="input-group suf"><input type="number" class="form-input" id="sp-platform" min="0" max="100" value="${cfg.platform}" oninput="recalcSplitConfig()"/><span class="ig-suf">%</span></div>
            <div class="form-hint">💡 Inclut les frais de traitement Orange Money, MTN, Wave, Carte bancaire...</div>
          </div>
        </div>
        <div class="split-party-card" id="deliveryCard" style="border-left:4px solid ${cfg.delivery_enabled ? 'var(--amber)' : 'var(--border)'};background:${cfg.delivery_enabled ? 'var(--am-light)' : 'var(--s2)'};">
          <div class="split-party-header">
            <div class="split-party-icon" id="deliveryIcon" style="background:${cfg.delivery_enabled ? 'var(--amber)' : 'var(--muted)'};">🚚</div>
            <div class="split-party-info">
              <div class="split-party-name">Livreur / Service de livraison</div>
              <div class="split-party-desc">Frais versés directement au livreur partenaire. Activez uniquement si vous travaillez avec un livreur externe.</div>
            </div>
            <div style="display:flex;flex-direction:column;align-items:flex-end;gap:4px;">
              <span class="chip chip-gray">Facultatif</span>
              <button class="toggle ${cfg.delivery_enabled ? 'on' : ''}" id="deliveryToggle" onclick="toggleDelivery(this)"></button>
            </div>
          </div>
          <div id="deliveryFields" style="display:${cfg.delivery_enabled ? 'block' : 'none'};margin-top:10px;">
            <div class="form-group" style="margin-bottom:0;">
              <label class="form-label">Pourcentage livreur</label>
              <div class="input-group suf"><input type="number" class="form-input" id="sp-delivery" min="0" max="100" value="${cfg.delivery}" oninput="recalcSplitConfig()"/><span class="ig-suf">%</span></div>
              <div class="form-hint">💡 Déduit et versé au livreur dès la validation de la livraison</div>
            </div>
          </div>
        </div>
        <div class="split-total" id="splitConfigTotal" style="margin-top:12px;"><span>Total réparti</span><span id="splitConfigPct">—</span></div>
        <button class="btn btn-cta btn-full" style="margin-top:14px;" onclick="saveSplitConfig()">💾 Enregistrer</button>
      </div>
    </div>
    <div>
      <div class="card" style="margin-bottom:16px;">
        <div class="card-title">🧮 Simulateur</div>
        <div class="form-group"><label class="form-label">Montant simulé (FCFA)</label><div class="input-group"><span class="ig-pre">FCFA</span><input type="number" class="form-input" id="simAmt" value="100000" oninput="recalcSplitConfig()"/></div></div>
        <div id="simResults"></div>
      </div>
      <div class="card">
        <div class="card-title">📋 Historique</div>
        ${rules.length
          ? rules.map(r => `<div class="tx-item" style="margin-bottom:8px;">
              <div style="width:8px;height:8px;border-radius:50%;background:var(--green);flex-shrink:0;"></div>
              <div class="tx-meta"><div class="tx-name">${esc(r.name)}</div><div class="tx-date">${fmtDateShort(new Date(r.createdAt))}</div></div>
              <span class="chip chip-green">Active</span>
            </div>`).join('')
          : '<p style="text-align:center;color:var(--muted);padding:20px;font-size:13px;">Aucune configuration sauvegardée</p>'}
      </div>
    </div>
  </div>`;
}

function pageAnalytics() {
  const txs   = DB.getTx();
  const total = txs.reduce((s, t) => s + Math.abs(t.amount), 0);
  const ok    = txs.filter(t => t.status === 'done').length;
  return `
  <div class="page-header"><div><div class="ph-t">📊 Analytiques</div></div></div>
  <div class="stats-row">
    <div class="stat"><div class="stat-label">Volume total</div><div class="stat-value">${fmtAmt(total)}</div><div class="stat-sub">FCFA traités</div><div class="stat-icon-bg si-indigo">📈</div></div>
    <div class="stat"><div class="stat-label">Transactions</div><div class="stat-value">${txs.length}</div><div class="stat-sub">total</div><div class="stat-icon-bg si-blue">📋</div></div>
    <div class="stat"><div class="stat-label">Réussies</div><div class="stat-value">${ok}</div><div class="stat-sub">validées</div><div class="stat-icon-bg si-green">✅</div></div>
    <div class="stat"><div class="stat-label">Taux succès</div><div class="stat-value">${txs.length ? Math.round(ok / txs.length * 100) : 0}%</div><div class="stat-sub"></div><div class="stat-icon-bg si-amber">🎯</div></div>
  </div>`;
}

function pageMerchantCfg() {
  return `
  <div class="page-header"><div><div class="ph-t">⚙️ Configuration Marchand</div></div></div>
  <div class="card">
    <div class="card-title">Informations boutique</div>
    <div class="form-row">
      <div class="form-group"><label class="form-label">Nom de la boutique</label><input type="text" class="form-input" placeholder="Ma Boutique CI"/></div>
      <div class="form-group"><label class="form-label">Site web</label><input type="url" class="form-input" placeholder="https://maboutique.ci"/></div>
    </div>
    <div class="form-group"><label class="form-label">Secteur</label><select class="form-select"><option>E-commerce général</option><option>Électronique</option><option>Mode</option><option>Alimentation</option><option>Services</option></select></div>
    <button class="btn btn-cta" onclick="toast('✅','Configuration sauvegardée','','success')">Enregistrer</button>
  </div>`;
}

function pageApiKeys() {
  const userKeys = DB.getApiKeys();
  const pkTest   = userKeys.find(k => k.env === 'test')?.pk || 'pk_test_votre_cle';
  return `
  <div class="page-header">
    <div><div class="ph-t">🔑 Clés API</div><div class="ph-s">Intégrez CloudPay dans votre plateforme</div></div>
    <div style="display:flex;gap:8px;">
      <button class="btn btn-ghost btn-sm" onclick="genKey('test')">+ Clé Test</button>
      <button class="btn btn-cta   btn-sm" onclick="genKey('live')">+ Clé Production</button>
    </div>
  </div>
  <div class="alert alert-warn" style="margin-bottom:16px;">
    <div class="alert-icon">⚠️</div>
    <div><div class="alert-title">Ne partagez jamais votre clé secrète (sk_)</div>
    <div class="alert-body">Stockez-la dans une variable d'environnement (.env). Ne la commitez jamais dans Git ou dans votre code front-end.</div></div>
  </div>
  <div id="apiKeysContainer"></div>`;
}

function renderApiKeys() {
  const keys   = DB.getApiKeys();
  const el     = document.getElementById('apiKeysContainer');
  if (!el) return;
  const test = keys.filter(k => k.env === 'test');
  const live = keys.filter(k => k.env === 'live');
  const pkTest = test[0]?.pk || 'pk_test_xxx';

  el.innerHTML = `
  <div class="g2" style="margin-bottom:16px;">
    <div class="card">
      <div class="card-title"><div class="ct-icon" style="background:var(--g-light);">🧪</div>Clés Test</div>
      ${test.length ? test.map(k => apiKeyRowHTML(k)).join('') : '<p style="font-size:13px;color:var(--muted);margin-bottom:12px;">Aucune clé test</p>'}
      <button class="btn btn-ghost btn-sm btn-full" style="margin-top:8px;" onclick="genKey('test')">+ Nouvelle clé test</button>
      <div class="chip chip-blue" style="margin-top:10px;">Transactions simulées uniquement</div>
    </div>
    <div class="card">
      <div class="card-title"><div class="ct-icon" style="background:var(--am-light);">🚀</div>Clés Production</div>
      ${live.length ? live.map(k => apiKeyRowHTML(k)).join('') : '<p style="font-size:13px;color:var(--muted);margin-bottom:12px;">Aucune clé live</p>'}
      <button class="btn btn-cta btn-sm btn-full" style="margin-top:8px;" onclick="genKey('live')">+ Nouvelle clé prod</button>
      <div class="chip chip-green" style="margin-top:10px;">Transactions réelles</div>
    </div>
  </div>
  <div class="card">
    <div class="card-title">⚡ Démarrage rapide</div>
    <div class="section-title">Installation</div>
    <div class="code-block"><pre><span class="cm"># npm</span>
<span class="fn">npm install</span> <span class="str">cloudpay-js</span>
<span class="cm"># pip</span>
<span class="fn">pip install</span> <span class="str">cloudpay</span></pre><button class="copy-btn" onclick="copyText('npm install cloudpay-js')">Copier npm</button></div>
    <div class="section-title" style="margin-top:14px;">Initialisation</div>
    <div class="code-block"><pre><span class="kw">import</span> CloudPay <span class="kw">from</span> <span class="str">'cloudpay-js'</span>;
<span class="kw">const</span> client = <span class="kw">new</span> <span class="fn">CloudPay</span>({
  <span class="key">apiKey</span>: <span class="str">'${pkTest}'</span>,
  <span class="key">environment</span>: <span class="str">'sandbox'</span>
});</pre><button class="copy-btn" onclick="copyText(this.previousSibling.textContent)">Copier</button></div>
  </div>`;
}

function apiKeyRowHTML(k) {
  const masked = k.sk.slice(0, 12) + '••••••••••••••••••••';
  return `
  <div class="api-key-box" style="margin-bottom:10px;flex-direction:column;gap:8px;">
    <div style="display:flex;align-items:center;gap:8px;">
      <span style="font-size:10px;font-weight:700;color:var(--green);min-width:22px;">PK</span>
      <div class="api-key-text" style="flex:1;">${k.pk}</div>
      <button class="btn btn-ghost btn-sm" onclick="copyText('${k.pk}')">📋 Copier</button>
    </div>
    <div style="display:flex;align-items:center;gap:8px;">
      <span style="font-size:10px;font-weight:700;color:var(--red);min-width:22px;">SK</span>
      <div class="api-key-text" style="flex:1;" id="sk-${k.id}">${masked}</div>
      <button class="btn btn-ghost btn-sm" onclick="revealSk('${k.id}','${k.sk}')">👁 Voir</button>
      <button class="btn btn-ghost btn-sm" onclick="copyText('${k.sk}')">📋 Copier</button>
    </div>
    <div style="display:flex;align-items:center;justify-content:space-between;">
      <span style="font-size:11px;color:var(--muted);">${esc(k.name || 'Sans nom')} · ${fmtDateShort(new Date(k.createdAt))}</span>
      <button class="btn btn-ghost btn-sm" style="color:var(--red);" onclick="deleteApiKey('${k.id}')">🗑 Supprimer</button>
    </div>
  </div>`;
}

function pageApiDocs() {
  const userKeys = DB.getApiKeys();
  const pkTest   = userKeys.find(k => k.env === 'test')?.pk || 'pk_test_votre_cle';
  return `
  <div class="page-header">
    <div>
      <div class="ph-t">📖 Documentation API CloudPay</div>
      <div class="ph-s">Base URL : <code style="color:var(--accent);background:var(--a-light);padding:2px 8px;border-radius:4px;font-size:12px;">https://api.cloudpay.ci/v1</code></div>
    </div>
    <span class="chip chip-green"><span class="dot dot-green"></span>v1.4 · Stable</span>
  </div>

  <div class="card" style="margin-bottom:20px;">
    <div class="card-title">🗺️ Schéma d'intégration</div>
    <p style="font-size:13px;color:var(--t2);margin-bottom:16px;">Vue complète du flux — de l'installation au paiement distribué.</p>
    <div style="overflow-x:auto;">
      <div style="min-width:640px;display:flex;align-items:center;gap:0;">
        ${schemaStep('1','📦','Installation SDK','npm install cloudpay-js','var(--accent)','var(--a-light)')}
        ${schemaArrow()}
        ${schemaStep('2','🔑','Clés API','pk_ client / sk_ serveur','#7c3aed','rgba(124,58,237,.1)')}
        ${schemaArrow()}
        ${schemaStep('3','⚙️','Init Client','new CloudPay({apiKey})','var(--blue)','var(--b-light)')}
        ${schemaArrow()}
        ${schemaStep('4','🔒','Escrow','POST /escrow/create','var(--amber)','var(--am-light)')}
        ${schemaArrow()}
        ${schemaStep('5','📦','Livraison','Client reçoit le colis','var(--muted)','var(--s2)')}
        ${schemaArrow()}
        ${schemaStep('6','✅','Validation','POST /escrow/{id}/validate','var(--green)','var(--g-light)')}
        ${schemaArrow()}
        ${schemaStep('7','💸','Split Auto','Vendeur+Plateforme+Livreur','var(--green)','var(--g-light)')}
      </div>
    </div>
  </div>

  <div class="card" style="margin-bottom:20px;">
    <div class="card-title">🔑 Les 4 types de clés API</div>
    <div class="g2" style="gap:12px;">
      <div style="background:var(--g-light);border:1px solid rgba(16,185,129,.2);border-radius:var(--rs);padding:16px;">
        <div style="font-weight:800;font-size:14px;margin-bottom:6px;">🟢 Publishable Key (pk_)</div>
        <code style="font-size:11px;color:var(--green);">${pkTest}</code>
        <ul style="font-size:12px;color:var(--t2);padding-left:16px;line-height:1.9;margin-top:10px;">
          <li><strong>Usage :</strong> Côté client (navigateur, React, Vue, app mobile)</li>
          <li><strong>Sécurité :</strong> Peut être exposée publiquement dans votre HTML</li>
          <li><strong>Commence par :</strong> <code>pk_test_</code> (test) ou <code>pk_live_</code> (prod)</li>
        </ul>
        <div class="form-hint" style="margin-top:8px;">✅ Sûre dans le front-end</div>
      </div>
      <div style="background:var(--r-light);border:1px solid rgba(239,68,68,.2);border-radius:var(--rs);padding:16px;">
        <div style="font-weight:800;font-size:14px;margin-bottom:6px;">🔴 Secret Key (sk_)</div>
        <code style="font-size:11px;color:var(--red);">sk_live_••••••••••••••••••••</code>
        <ul style="font-size:12px;color:var(--t2);padding-left:16px;line-height:1.9;margin-top:10px;">
          <li><strong>Usage :</strong> Côté serveur uniquement (Node.js, PHP, Python)</li>
          <li><strong>Sécurité :</strong> <strong style="color:var(--red);">JAMAIS dans le code front-end</strong></li>
          <li><strong>Stocker dans :</strong> Variables d'environnement (<code>.env</code>)</li>
        </ul>
        <div class="form-hint" style="color:var(--red);">⛔ Accès complet — ne jamais exposer</div>
      </div>
      <div style="background:var(--b-light);border:1px solid rgba(59,130,246,.2);border-radius:var(--rs);padding:16px;">
        <div style="font-weight:800;font-size:14px;margin-bottom:6px;">🔵 Webhook Secret (whsec_)</div>
        <code style="font-size:11px;color:var(--blue);">whsec_••••••••••••••••</code>
        <ul style="font-size:12px;color:var(--t2);padding-left:16px;line-height:1.9;margin-top:10px;">
          <li><strong>Usage :</strong> Vérifier l'authenticité des webhooks reçus</li>
          <li><strong>Comment :</strong> Signature HMAC-SHA256 de chaque payload</li>
          <li><strong>Côté serveur uniquement</strong></li>
        </ul>
      </div>
      <div style="background:var(--am-light);border:1px solid rgba(245,158,11,.2);border-radius:var(--rs);padding:16px;">
        <div style="font-weight:800;font-size:14px;margin-bottom:6px;">🟡 Restricted Key (rk_)</div>
        <code style="font-size:11px;color:var(--amber);">rk_live_••••••••••••••</code>
        <ul style="font-size:12px;color:var(--t2);padding-left:16px;line-height:1.9;margin-top:10px;">
          <li><strong>Usage :</strong> Accès limité à certaines ressources</li>
          <li><strong>Idéal pour :</strong> Partenaires, dashboards tiers, analytics</li>
          <li><strong>Permissions :</strong> Configurables par ressource (read/write)</li>
        </ul>
        <div class="form-hint" style="margin-top:8px;">🔐 Principe du moindre privilège</div>
      </div>
    </div>
  </div>

  <div class="card" style="margin-bottom:20px;">
    <div class="card-title">⚡ Guide d'installation étape par étape</div>
    <div class="step-row"><div class="step-num">1</div><div style="flex:1;"><div class="step-title">Installer le SDK</div>
      <div class="code-block" style="margin-top:8px;"><pre><span class="cm"># JavaScript / Node.js</span>
<span class="fn">npm install</span> <span class="str">cloudpay-js</span>
<span class="cm"># Python</span>
<span class="fn">pip install</span> <span class="str">cloudpay</span>
<span class="cm"># PHP</span>
<span class="fn">composer require</span> <span class="str">cloudpay/cloudpay-php</span></pre><button class="copy-btn" onclick="copyText('npm install cloudpay-js')">Copier</button></div>
    </div></div>
    <div class="step-row"><div class="step-num">2</div><div style="flex:1;"><div class="step-title">Variables d'environnement (.env)</div>
      <div class="code-block" style="margin-top:8px;"><pre><span class="key">CLOUDPAY_SECRET_KEY</span>=<span class="str">sk_live_xxxxxxxxxxxxxxxxxxxx</span>
<span class="key">CLOUDPAY_WEBHOOK_SECRET</span>=<span class="str">whsec_xxxxxxxxxxxxxxxxxxxx</span>
<span class="key">CLOUDPAY_ENV</span>=<span class="str">production</span>  <span class="cm"># ou sandbox</span></pre><button class="copy-btn" onclick="copyText('CLOUDPAY_SECRET_KEY=sk_live_xxx')">Copier</button></div>
    </div></div>
    <div class="step-row"><div class="step-num">3</div><div style="flex:1;"><div class="step-title">Initialiser le client (serveur)</div>
      <div class="code-block" style="margin-top:8px;"><pre><span class="kw">import</span> CloudPay <span class="kw">from</span> <span class="str">'cloudpay-js'</span>;
<span class="kw">const</span> client = <span class="kw">new</span> <span class="fn">CloudPay</span>({
  <span class="key">apiKey</span>:      process.env.<span class="val">CLOUDPAY_SECRET_KEY</span>,
  <span class="key">environment</span>: process.env.<span class="val">CLOUDPAY_ENV</span>
});</pre><button class="copy-btn" onclick="copyText('const client = new CloudPay({...})')">Copier</button></div>
    </div></div>
    <div class="step-row"><div class="step-num">4</div><div style="flex:1;"><div class="step-title">Créer un paiement sécurisé</div>
      <div class="code-block" style="margin-top:8px;"><pre><span class="kw">const</span> escrow = <span class="kw">await</span> client.escrow.<span class="fn">create</span>({
  <span class="key">amount</span>:   <span class="num">125000</span>, <span class="key">currency</span>: <span class="str">'XOF'</span>,
  <span class="key">product</span>:  { <span class="key">name</span>: <span class="str">'iPhone 15'</span>, <span class="key">url</span>: <span class="str">'https://...'</span> },
  <span class="key">seller</span>:   { <span class="key">account</span>: <span class="str">'orange_money:+22507xxx'</span> },
  <span class="key">deadline</span>: <span class="str">'2026-04-15'</span>,
  <span class="key">split</span>:    { <span class="key">seller</span>:<span class="num">70</span>, <span class="key">platform</span>:<span class="num">25</span>, <span class="key">delivery</span>:<span class="num">5</span> }
});
<span class="fn">redirect</span>(escrow.<span class="val">checkout_url</span>);</pre><button class="copy-btn" onclick="copyText('const escrow = await client.escrow.create({...})')">Copier</button></div>
    </div></div>
    <div class="step-row"><div class="step-num">5</div><div style="flex:1;"><div class="step-title">Recevoir les webhooks</div>
      <div class="code-block" style="margin-top:8px;"><pre><span class="cm">// Express.js</span>
app.<span class="fn">post</span>(<span class="str">'/webhook/cloudpay'</span>, (req, res) => {
  <span class="kw">const</span> event = client.webhooks.<span class="fn">construct</span>(
    req.body, req.headers[<span class="str">'x-cloudpay-signature'</span>],
    process.env.<span class="val">CLOUDPAY_WEBHOOK_SECRET</span>
  );
  <span class="kw">if</span>(event.type === <span class="str">'escrow.validated'</span>) {
    <span class="fn">libereFonds</span>(event.data);
  }
  res.<span class="fn">json</span>({ received: <span class="kw">true</span> });
});</pre><button class="copy-btn" onclick="copyText('app.post(\"/webhook/cloudpay\", ...)')">Copier</button></div>
    </div></div>
    <div class="step-row" style="margin-bottom:0;"><div class="step-num">6</div><div style="flex:1;"><div class="step-title">Numéros de test Sandbox</div>
      <div class="code-block" style="margin-top:8px;"><pre><span class="cm">// Orange Money test : </span><span class="str">+22500000000</span> → <span class="val">succès</span>
<span class="cm">// MTN MoMo test :    </span><span class="str">+22500000001</span> → <span class="val">succès</span>
<span class="cm">// Visa test :        </span><span class="str">4111 1111 1111 1111</span> → <span class="val">succès</span>
<span class="cm">// Carte refusée :    </span><span class="str">4000 0000 0000 0002</span> → <span class="val">refus</span></pre><button class="copy-btn" onclick="copyText('4111 1111 1111 1111')">Copier carte test</button></div>
    </div></div>
  </div>

  <div class="g2">
    <div class="card">
      <div class="card-title">📡 Endpoints principaux</div>
      ${epHTML('POST','/escrow/create','Créer un paiement sécurisé','{ "amount":125000,"currency":"XOF","product":{"name":"..."},"seller":{"account":"orange_money:+225..."},"deadline":"2026-04-15","split":{"seller":70,"platform":25,"delivery":5} }',[['amount','integer','Montant FCFA','requis'],['currency','string','XOF, EUR, USD','requis'],['product.name','string','Nom du produit','requis'],['seller.account','string','Compte vendeur','requis'],['deadline','date','Date limite ISO 8601','requis'],['split','object','%  seller / platform / delivery','optionnel']])}
      ${epHTML('POST','/escrow/{id}/validate','Valider livraison → libère les fonds','{ "confirmed_by":"buyer" }\n// Réponse : { "status":"released","splits_executed":[...] }')}
      ${epHTML('GET', '/escrow/{id}','Consulter un escrow','{ "id":"esc_xxx","status":"pending","amount":125000,"fraud_score":8 }')}
      ${epHTML('POST','/charge','Paiement direct (sans escrow)','{ "amount":5000,"currency":"XOF","method":"orange_money","phone":"+22507xxx" }')}
      ${epHTML('GET', '/transactions','Lister les transactions','GET /transactions?status=pending&limit=20&page=1')}
    </div>
    <div>
      <div class="card" style="margin-bottom:16px;">
        <div class="card-title">📊 Codes HTTP</div>
        ${[['200','var(--green)','OK — Succès'],['201','var(--green)','Created — Ressource créée'],['400','var(--amber)','Bad Request — Paramètre invalide'],['401','var(--amber)','Unauthorized — Clé invalide'],['402','var(--red)','Payment Required — Solde insuffisant'],['403','var(--red)','Forbidden — Accès refusé'],['422','var(--red)','Fraude détectée — bloqué'],['429','var(--red)','Too Many Requests — 100 req/min max']]
          .map(([c, col, m]) => `<div class="kv-row"><span style="font-family:monospace;font-weight:700;color:${col};min-width:36px;">${c}</span><span style="font-size:12px;">${m}</span></div>`).join('')}
      </div>
      <div class="card">
        <div class="card-title">🔗 Événements Webhook</div>
        ${[['escrow.created','Nouveau séquestre créé'],['escrow.validated','Livraison validée → fonds libérés'],['escrow.refunded','Délai dépassé → remboursement auto'],['payment.completed','Paiement direct réussi'],['fraud.detected','IA a bloqué une transaction'],['split.executed','Distribution automatique effectuée'],['transfer.sent','Transfert émis']]
          .map(([ev, d]) => `<div class="kv-row"><code style="font-size:11px;color:var(--accent);">${ev}</code><span style="font-size:12px;color:var(--t2);text-align:right;max-width:180px;">${d}</span></div>`).join('')}
      </div>
    </div>
  </div>`;
}

/** Génère le HTML d'un endpoint API cliquable (accordéon). */
function epHTML(method, path, desc, code, params) {
  const mc = { POST: 'm-post', GET: 'm-get', PUT: 'm-put', DELETE: 'm-delete' }[method] || 'm-get';
  const paramsHtml = params ? `
    <div class="section-title" style="margin-top:10px;">Paramètres</div>
    <div class="table-wrap" style="margin-bottom:8px;"><table class="param-table">
      <thead><tr><th>Champ</th><th>Type</th><th>Description</th></tr></thead>
      <tbody>${params.map(p => `<tr><td>${p[0]}</td><td>${p[1]}</td><td>${p[2]}${p[3] === 'requis' ? `<span class="req-badge">requis</span>` : ''}</td></tr>`).join('')}</tbody>
    </table></div>` : '';
  return `
  <div class="endpoint">
    <div class="ep-header" onclick="toggleEp(this)">
      <span class="ep-method ${mc}">${method}</span>
      <span class="ep-path">${path}</span>
      <span class="ep-desc">${desc}</span>
      <span class="ep-arrow">▼</span>
    </div>
    <div class="ep-body">${paramsHtml}
      <div class="section-title" style="margin-top:8px;">Exemple</div>
      <div class="code-block"><pre>${esc(code)}</pre>
        <button class="copy-btn" onclick="copyText(this.previousSibling.textContent)">Copier</button>
      </div>
    </div>
  </div>`;
}

/** Génère une étape du schéma visuel d'intégration. */
function schemaStep(n, icon, title, desc, color, bg) {
  return `
  <div style="flex:1;display:flex;flex-direction:column;align-items:center;gap:6px;min-width:80px;">
    <div style="width:48px;height:48px;border-radius:50%;background:${bg};border:2px solid ${color};display:flex;align-items:center;justify-content:center;font-size:20px;position:relative;">
      ${icon}
      <span style="position:absolute;top:-4px;right:-4px;background:${color};color:#fff;font-size:9px;font-weight:800;width:16px;height:16px;border-radius:50%;display:flex;align-items:center;justify-content:center;">${n}</span>
    </div>
    <div style="text-align:center;">
      <div style="font-size:11px;font-weight:700;">${title}</div>
      <div style="font-size:10px;color:var(--muted);max-width:80px;line-height:1.3;">${desc}</div>
    </div>
  </div>`;
}

/** Génère une flèche du schéma d'intégration. */
function schemaArrow() {
  return `<div style="color:var(--muted);font-size:16px;flex-shrink:0;padding-bottom:28px;">→</div>`;
}

function pageDevPayments() {
  const cfg = DB.getDevCfg();
  const pm  = cfg.payment_methods;
  const methods = [
    { id: 'orange_money', icon: '🟠', name: 'Orange Money CI',       color: '#ff6b00', desc: 'API Mobile Money Orange Côte d\'Ivoire',
      fields: [{ id: 'merchantId', lbl: 'Merchant ID Orange', hint: 'Obtenu sur le portail Orange CI Business' }, { id: 'apiKey', lbl: 'API Key Orange', hint: 'Clé secrète fournie par Orange CI — ne jamais exposer côté client' }, { id: 'webhook', lbl: 'URL Callback Webhook', hint: 'CloudPay enverra les confirmations de paiement à cette URL' }] },
    { id: 'mtn_money',    icon: '🟡', name: 'MTN MoMo CI',            color: '#ffc107', desc: 'MTN Mobile Money — Collection & Disbursement',
      fields: [{ id: 'merchantId', lbl: 'Subscription Key (MTN Developer Hub)', hint: 'Créez une app sur developer.mtn.com et copiez la Subscription Key' }, { id: 'apiKey', lbl: 'API User Secret', hint: 'Généré via POST /apiuser sur le portail MTN Developer' }, { id: 'webhook', lbl: 'URL Callback MTN', hint: 'Recevra les événements payment.success de MTN MoMo' }] },
    { id: 'wave',         icon: '🌊', name: 'Wave CI',                color: '#0099ff', desc: 'Wave Mobile Money — Afrique de l\'Ouest',
      fields: [{ id: 'merchantId', lbl: 'Business ID Wave', hint: 'Disponible dans votre espace Wave for Business' }, { id: 'apiKey', lbl: 'Secret Key Wave', hint: 'Pour signer les requêtes HMAC — clé secrète Wave Business' }, { id: 'webhook', lbl: 'Webhook URL Wave', hint: 'Wave enverra les notifications de paiement à cette URL' }] },
    { id: 'moov',         icon: '💚', name: 'Moov Money (Flooz)',     color: '#00b050', desc: 'Moov Money CI',
      fields: [{ id: 'merchantId', lbl: 'Code Marchand Moov', hint: 'Code attribué par votre conseiller Moov CI Business' }, { id: 'apiKey', lbl: 'Token API Moov', hint: 'Token d\'authentification Moov — valable 24h, renouvelable' }, { id: 'webhook', lbl: 'URL de notification IPN', hint: 'Moov enverra les Instant Payment Notifications à cette adresse' }] },
    { id: 'mastercard',   icon: '💳', name: 'Mastercard (MPGS)',      color: '#eb001b', desc: 'Mastercard Payment Gateway Services',
      fields: [{ id: 'merchantId', lbl: 'Merchant ID MPGS', hint: 'ID attribué par votre acquéreur bancaire (SGCI, Ecobank...)' }, { id: 'apiKey', lbl: 'API Username MPGS', hint: 'Identifiant API du portail Merchant Administration (MA)' }, { id: 'secretKey', lbl: 'API Password MPGS', hint: 'JAMAIS côté client — toujours côté serveur' }, { id: 'endpoint', lbl: 'Endpoint MPGS', hint: 'Ex: https://ap.gateway.mastercard.com/api/rest/version/70' }] },
    { id: 'visa',         icon: '💙', name: 'Visa (CyberSource)',     color: '#1a1f71', desc: 'Visa CyberSource — Paiements carte internationale',
      fields: [{ id: 'merchantId', lbl: 'Merchant ID CyberSource', hint: 'ID dans le portail Business Center CyberSource' }, { id: 'apiKey', lbl: 'Shared Secret HMAC', hint: 'Pour signer les requêtes HMAC-256 — côté serveur uniquement' }, { id: 'secretKey', lbl: 'API Key ID CyberSource', hint: 'Généré dans EBC (Enterprise Business Center) de Visa' }, { id: 'endpoint', lbl: 'Endpoint CyberSource', hint: 'https://api.cybersource.com (prod) ou https://apitest.cybersource.com (test)' }] },
    { id: 'paypal',       icon: '🅿️', name: 'PayPal REST API',        color: '#0070ba', desc: 'Paiements internationaux PayPal',
      fields: [{ id: 'clientId', lbl: 'Client ID PayPal', hint: 'Créez une app sur developer.paypal.com et copiez le Client ID' }, { id: 'clientSecret', lbl: 'Client Secret PayPal', hint: 'Secret PayPal — JAMAIS dans le code front-end' }, { id: 'mode', lbl: 'Mode (sandbox ou live)', hint: '"sandbox" pour tester, "live" pour la production' }] },
    { id: 'stripe',       icon: '🟣', name: 'Stripe',                 color: '#635bff', desc: 'Stripe API — Cartes monde entier + SEPA',
      fields: [{ id: 'publishableKey', lbl: 'Publishable Key (pk_)', hint: 'pk_test_ ou pk_live_ — peut être exposée côté client' }, { id: 'secretKey', lbl: 'Secret Key (sk_)', hint: 'sk_test_ ou sk_live_ — JAMAIS dans le code client' }, { id: 'webhookSecret', lbl: 'Webhook Signing Secret (whsec_)', hint: 'Généré dans Dashboard Stripe > Webhooks > Signing secret' }] },
    { id: 'crypto',       icon: '₿',  name: 'Crypto (Bitcoin, USDT)', color: '#f7931a', desc: 'Paiements crypto via wallet',
      fields: [{ id: 'walletAddress', lbl: 'Adresse Wallet de réception', hint: 'Adresse publique Bitcoin, Ethereum ou USDT TRC-20' }, { id: 'network', lbl: 'Réseau blockchain', hint: 'BTC, ETH, USDT-TRC20, USDT-ERC20, MATIC...' }] },
  ];

  return `
  <div class="page-header">
    <div><div class="ph-t">💳 Configuration Paiements</div><div class="ph-s">Activez et configurez chaque méthode pour votre intégration</div></div>
    <button class="btn btn-cta btn-sm" onclick="saveDevConfig()">💾 Sauvegarder tout</button>
  </div>
  <div class="alert alert-info" style="margin-bottom:20px;">
    <div class="alert-icon">💡</div>
    <div><div class="alert-title">Comment configurer</div>
    <div class="alert-body">1. Activez le toggle · 2. Remplissez les champs API obtenus chez le fournisseur · 3. Configurez votre URL Webhook · 4. Cliquez "Sauvegarder tout" · 5. Cliquez "Tester la connexion" pour vérifier</div></div>
  </div>
  <div class="pm-config-grid">
    ${methods.map(m => {
      const conf = pm[m.id] || { enabled: false };
      return `
      <div class="pm-config-card ${conf.enabled ? 'enabled' : ''}" id="pmcard-${m.id}">
        <div class="pm-config-header">
          <div class="pm-config-icon" style="background:${m.color}22;">${m.icon}</div>
          <div style="flex:1;"><div class="pm-config-name">${m.name}</div><div class="pm-config-desc">${m.desc}</div></div>
          <button class="toggle ${conf.enabled ? 'on' : ''}" id="toggle-${m.id}" onclick="togglePmMethod('${m.id}',this)"></button>
        </div>
        <div id="fields-${m.id}" style="display:${conf.enabled ? 'block' : 'none'};margin-top:12px;">
          ${m.fields.map(f => `
          <div class="form-group" style="margin-bottom:10px;">
            <label class="form-label">${f.lbl}</label>
            <input type="${f.id.toLowerCase().includes('secret') || f.id.toLowerCase().includes('password') ? 'password' : 'text'}"
                   class="form-input" id="pm-${m.id}-${f.id}" value="${conf[f.id] || ''}" placeholder="${f.hint}" />
            <div class="form-hint">💡 ${f.hint}</div>
          </div>`).join('')}
          <button class="btn btn-ghost btn-sm btn-full" onclick="testPmConfig('${m.id}')">🧪 Tester la connexion</button>
        </div>
        ${!conf.enabled ? `<div class="pm-config-hint"><span>ℹ️</span><span>Activez pour configurer les credentials et accepter des paiements via ${m.name}.</span></div>` : ''}
      </div>`;
    }).join('')}
  </div>`;
}

function pageWebhooks() {
  return `
  <div class="page-header">
    <div><div class="ph-t">🔗 Webhooks</div><div class="ph-s">Recevez les événements CloudPay en temps réel sur votre serveur</div></div>
    <button class="btn btn-cta btn-sm" onclick="document.getElementById('whUrl').focus()">+ Ajouter endpoint</button>
  </div>
  <div class="g2">
    <div>
      <div class="card" style="margin-bottom:16px;">
        <div class="card-title">Endpoints actifs</div>
        <div id="webhookList"></div>
        <div class="divider"></div>
        <div class="form-group"><label class="form-label">URL de l'endpoint</label><input type="url" class="form-input" id="whUrl" placeholder="https://votre-site.com/webhook/cloudpay"/></div>
        <div class="form-group">
          <label class="form-label">Événements à écouter</label>
          <div style="display:flex;flex-wrap:wrap;gap:8px;margin-top:6px;">
            ${['escrow.created','escrow.validated','escrow.refunded','payment.completed','fraud.detected','split.executed','transfer.sent'].map(ev => `
            <label style="display:flex;align-items:center;gap:5px;font-size:12px;cursor:pointer;">
              <input type="checkbox" value="${ev}" checked/>${ev}
            </label>`).join('')}
          </div>
        </div>
        <button class="btn btn-cta btn-full" onclick="saveWebhook()">Enregistrer l'endpoint</button>
      </div>
    </div>
    <div class="card">
      <div class="card-title">📨 Exemple de payload</div>
      <div class="code-block"><pre>{\n  "event":   "escrow.validated",\n  "created": 1743425600,\n  "data": {\n    "escrow_id": "esc_xxx",\n    "amount":    125000,\n    "currency":  "XOF",\n    "splits": [\n      { "to": "seller",   "amount": 87500 },\n      { "to": "platform", "amount": 31250 },\n      { "to": "delivery", "amount": 6250 }\n    ],\n    "fraud_score": 8\n  },\n  "signature": "sha256=9f86d081..."\n}</pre><button class="copy-btn" onclick="copyText(this.previousSibling.textContent)">Copier</button></div>
      <div class="alert alert-info" style="margin-top:12px;"><div class="alert-icon">🔐</div><div><div class="alert-title">Vérification signature</div><div class="alert-body">Validez toujours la signature HMAC-SHA256 avant de traiter l'événement.</div></div></div>
    </div>
  </div>`;
}

function pageFraudCfg() {
  const fr = DB.getDevCfg().fraud_rules;
  return `
  <div class="page-header">
    <div><div class="ph-t">🛡️ Anti-Fraude IA</div><div class="ph-s">Score de risque 0-100 calculé pour chaque transaction en temps réel</div></div>
    <button class="btn btn-cta btn-sm" onclick="saveFraudConfig()">💾 Sauvegarder</button>
  </div>
  <div class="g2">
    <div class="card">
      <div class="card-title">Règles de détection</div>
      <div class="alert alert-info" style="margin-bottom:14px;"><div class="alert-icon">🤖</div><div><div class="alert-title">Détection par IA</div><div class="alert-body">Chaque transaction reçoit un score 0-100. Au-dessus du seuil, l'action définie s'applique automatiquement.</div></div></div>
      ${[['location_check','🌍 Localisation anormale','Alerte si paiement depuis un pays inhabituel'],['velocity_check','⚡ Vélocité excessive','Blocage si plus de 5 paiements en 10 minutes'],['card_multi','💳 Cartes multiples','Signalement si plusieurs cartes sur un même compte'],['temp_email','📧 Emails jetables','Refus des domaines blacklistés (mailinator, guerrilla...)'],['bot_detection','🤖 Détection bots','Analyse des patterns de navigation et timing'],['chargeback_block','🔄 Chargeback répété','Blacklist auto après 2 contestations de paiement']]
        .map(([k, t, s]) => `<div class="toggle-wrap"><div class="toggle-info"><div class="tl">${t}</div><div class="ts">${s}</div></div><button class="toggle ${fr[k] ? 'on' : ''}" id="fr-${k}" onclick="this.classList.toggle('on')"></button></div>`).join('')}
    </div>
    <div>
      <div class="card" style="margin-bottom:16px;">
        <div class="card-title">⚙️ Seuils & Actions</div>
        <div class="form-group"><label class="form-label">OTP obligatoire au-dessus de (FCFA)<div class="form-hint">Montant à partir duquel une vérification OTP SMS est requise</div></label><div class="input-group"><span class="ig-pre">FCFA</span><input type="number" class="form-input" id="fr-otp" value="${fr.otp_above || 50000}"/></div></div>
        <div class="form-group"><label class="form-label">Score max accepté (0–100)<div class="form-hint">Au-dessus de ce score, l'action définie s'applique</div></label><div class="input-group suf"><input type="number" class="form-input" id="fr-score" min="0" max="100" value="${fr.max_score || 70}"/><span class="ig-suf">/100</span></div></div>
        <div class="form-group"><label class="form-label">Action si score dépassé</label><select class="form-select" id="fr-action"><option value="block" ${fr.action === 'block' ? 'selected' : ''}>Bloquer automatiquement</option><option value="review" ${fr.action === 'review' ? 'selected' : ''}>Validation manuelle</option><option value="otp" ${fr.action === 'otp' ? 'selected' : ''}>OTP supplémentaire</option></select></div>
        <button class="btn btn-cta btn-full" onclick="saveFraudConfig()">Appliquer les règles</button>
      </div>
      <div class="card">
        <div class="card-title">📊 Statut IA</div>
        <div class="kv-row"><span class="kv-key">Modèle</span><span class="kv-val">CloudPay FraudNet v2.1</span></div>
        <div class="kv-row"><span class="kv-key">Précision</span><span class="kv-val" style="color:var(--green);">99.7%</span></div>
        <div class="kv-row" style="border-bottom:none;"><span class="kv-key">Mise à jour</span><span class="kv-val">31 Mar 2026</span></div>
      </div>
    </div>
  </div>`;
}

function pageSDK() {
  return `
  <div class="page-header"><div><div class="ph-t">🧩 SDK & Plugins</div><div class="ph-s">Intégrez CloudPay en quelques minutes</div></div></div>
  <div class="g2">
    <div class="card" style="margin-bottom:16px;">
      <div class="card-title">📦 SDKs officiels</div>
      ${[['🟨','JavaScript / Node.js','npm install cloudpay-js','ESM & CommonJS · TypeScript · Browser'],['🐍','Python','pip install cloudpay','Django, Flask, FastAPI, Celery'],['🐘','PHP','composer require cloudpay/cloudpay-php','Laravel, Symfony, WordPress'],['🦫','Go','go get github.com/cloudpay/go-cloudpay','Goroutines · context · idiomatic']]
        .map(([ic, lang, cmd, docs]) => `
        <div style="display:flex;align-items:center;gap:12px;padding:12px 0;border-bottom:1px solid var(--border);">
          <div style="font-size:22px;">${ic}</div>
          <div style="flex:1;"><div style="font-weight:700;font-size:13px;">${lang}</div><div style="font-size:11px;color:var(--muted);">${docs}</div>
          <div class="api-key-box" style="margin-top:6px;"><div class="api-key-text">${cmd}</div><button class="btn btn-ghost btn-sm" onclick="copyText('${cmd}')">📋</button></div></div>
        </div>`).join('')}
    </div>
    <div>
      <div class="card" style="margin-bottom:16px;">
        <div class="card-title">🛒 Plugins E-commerce</div>
        ${[['🛒','WooCommerce Plugin','WordPress · v2.1.0','Stable'],['🟣','Shopify App','Shopify App Store · v1.8','Stable'],['🦋','PrestaShop Module','PrestaShop · v3.0','Stable'],['🔶','Magento Extension','Magento 2 · v1.2','Beta'],['⚛️','React Component','npm · cloudpay-react','Stable'],['💚','Vue.js Plugin','npm · cloudpay-vue','Stable']]
          .map(([ic, name, plat, status]) => `
          <div style="display:flex;align-items:center;gap:10px;padding:10px 0;border-bottom:1px solid var(--border);">
            <span style="font-size:20px;">${ic}</span>
            <div style="flex:1;"><div style="font-weight:600;font-size:13px;">${name}</div><div style="font-size:11px;color:var(--muted);">${plat}</div></div>
            <span class="chip ${status === 'Stable' ? 'chip-green' : 'chip-amber'}">${status}</span>
          </div>`).join('')}
      </div>
      <div class="card">
        <div class="card-title">⚡ Drop-in UI (3 lignes)</div>
        <div class="code-block"><pre><span class="kw">&lt;script</span> <span class="key">src</span>=<span class="str">"https://js.cloudpay.ci/v1.js"</span><span class="kw">&gt;&lt;/script&gt;</span>
<span class="fn">CloudPay</span>.<span class="fn">button</span>(<span class="str">'#pay-btn'</span>, {
  <span class="key">amount</span>:  <span class="num">125000</span>,
  <span class="key">apiKey</span>:  <span class="str">'pk_live_xxx'</span>,
  <span class="key">product</span>: <span class="str">'iPhone 15 Pro'</span>
});</pre><button class="copy-btn" onclick="copyText(this.previousSibling.textContent)">Copier</button></div>
      </div>
    </div>
  </div>`;
}

/* ─────────────────────────────────────────────
   MODALES
───────────────────────────────────────────── */

/** Ouvre une modale en ajoutant la classe 'open'. */
function openModal(id)  { document.getElementById(id)?.classList.add('open'); }

/** Ferme une modale en retirant la classe 'open'. */
function closeModal(id) { document.getElementById(id)?.classList.remove('open'); }

/**
 * Affiche une modale avec le détail complet d'une transaction.
 * @param {string} txId - ID de la transaction à afficher
 */
function showTxDetail(txId) {
  const t = DB.getTx().find(x => x.id === txId);
  if (!t) return;

  const isPos    = t.amount > 0;
  const amtColor = t.type === 'escrow' ? 'var(--amber)' : isPos ? 'var(--green)' : 'var(--red)';
  const typeLabel = {
    escrow: '🔒 Séquestre', credit: '💰 Crédit',
    debit:  '↗️ Débit',    split:  '⚖️ Split', refund: '↩️ Remboursement'
  }[t.type] || t.type;
  const smMap = { pending: 'chip-amber', done: 'chip-green', failed: 'chip-red', refunded: 'chip-blue' };

  showDetailModal('📋 Détail de la transaction', `
    <div style="text-align:center;padding:12px 0 18px;">
      <div style="font-size:34px;font-weight:900;color:${amtColor};">${isPos ? '+' : ''}${fmtAmt(t.amount)} FCFA</div>
      <div style="font-size:13px;color:var(--muted);margin-top:4px;">${esc(t.description)}</div>
      <span class="chip ${smMap[t.status] || 'chip-gray'}" style="margin-top:8px;">${t.statusLabel || t.status}</span>
    </div>
    <div style="background:var(--s2);border-radius:var(--rs);padding:14px;">
      <div class="kv-row"><span class="kv-key">ID Transaction</span><code style="font-size:11px;color:var(--accent);">${t.id}</code></div>
      <div class="kv-row"><span class="kv-key">Type</span><span class="kv-val">${typeLabel}</span></div>
      <div class="kv-row"><span class="kv-key">Date & Heure</span><span class="kv-val">${fmtDateShort(new Date(t.ts))}</span></div>
      <div class="kv-row" style="border-bottom:none;"><span class="kv-key">Statut</span><span class="kv-val">${t.statusLabel || t.status}</span></div>
    </div>
    <button class="btn btn-ghost btn-full" style="margin-top:12px;" onclick="copyText('${t.id}')">📋 Copier l'ID de transaction</button>`
  );
}

/**
 * Affiche une modale avec le détail complet d'une notification.
 * @param {string} notifId - ID de la notification
 */
function showNotifDetail(notifId) {
  const n = DB.getNotifs().find(x => x.id === notifId);
  if (!n) return;

  const bc = n.type === 'error' ? 'var(--red)'    : n.type === 'warn' ? 'var(--amber)' : 'var(--accent)';
  const cc = n.type === 'error' ? 'chip-red'      : n.type === 'warn' ? 'chip-amber'   : 'chip-indigo';
  const cl = n.type === 'error' ? 'Urgente'       : n.type === 'warn' ? 'Avertissement' : 'Information';

  showDetailModal(`${n.icon || '🔔'} Notification`, `
    <div style="border-left:4px solid ${bc};padding:12px 16px;background:var(--s2);border-radius:var(--rs);margin-bottom:16px;">
      <div style="font-weight:800;font-size:15px;margin-bottom:5px;">${esc(n.title)}</div>
      <span class="chip ${cc}">${cl}</span>
    </div>
    <p style="font-size:14px;color:var(--t2);line-height:1.75;margin-bottom:16px;">${esc(n.body)}</p>
    <div style="background:var(--s2);border-radius:var(--rs);padding:12px;">
      <div class="kv-row"><span class="kv-key">ID</span><code style="font-size:11px;color:var(--accent);">${n.id}</code></div>
      <div class="kv-row" style="border-bottom:none;"><span class="kv-key">Date & Heure</span><span class="kv-val">${fmtDateShort(new Date(n.ts))}</span></div>
    </div>`
  );
}

/**
 * Modale générique réutilisable.
 * Crée la modale dynamiquement si elle n'existe pas encore.
 * @param {string} title    - Titre de la modale
 * @param {string} bodyHtml - Contenu HTML du corps
 */
function showDetailModal(title, bodyHtml) {
  let ov = document.getElementById('detailModal');
  if (!ov) {
    ov = document.createElement('div');
    ov.className = 'overlay';
    ov.id        = 'detailModal';
    ov.innerHTML = `
      <div class="modal">
        <button class="modal-close" onclick="closeModal('detailModal')">✕</button>
        <div id="dtTitle" class="modal-title" style="margin-bottom:14px;font-size:17px;"></div>
        <div id="dtBody"></div>
      </div>`;
    ov.addEventListener('click', e => { if (e.target === ov) ov.classList.remove('open'); });
    document.body.appendChild(ov);
  }
  document.getElementById('dtTitle').textContent = title;
  document.getElementById('dtBody').innerHTML    = bodyHtml;
  ov.classList.add('open');
}

/* ─────────────────────────────────────────────
   COMPOSANTS UI
───────────────────────────────────────────── */

/**
 * Bascule entre les onglets d'une carte.
 * Active le bouton cliqué et affiche le panneau correspondant.
 * @param {HTMLElement} btn    - Bouton tab cliqué
 * @param {string}      paneId - ID du panneau à afficher
 */
function switchTab(btn, paneId) {
  const parent = btn.closest('.card');
  parent.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  parent.querySelectorAll('.tab-pane').forEach(p => p.classList.toggle('active', p.id === paneId));
}

/**
 * Ouvre ou ferme un accordéon d'endpoint API.
 * @param {HTMLElement} header - En-tête de l'endpoint cliqué
 */
function toggleEp(header) {
  const body  = header.nextElementSibling;
  const arrow = header.querySelector('.ep-arrow');
  body.classList.toggle('open');
  if (arrow) arrow.textContent = body.classList.contains('open') ? '▲' : '▼';
}

/**
 * Met à jour le badge de notifications (topbar + sidebar).
 * Affiche le nombre de notifications non lues.
 */
function updateNotifBadge() {
  const unread = DB.getNotifs().filter(n => !n.read).length;
  const badge  = document.getElementById('notifBadge');
  const navB   = document.getElementById('notifNavBadge');
  if (badge) { badge.style.display = unread ? 'flex' : 'none'; badge.textContent = unread; }
  if (navB)  { navB.style.display  = unread ? 'inline' : 'none'; navB.textContent = unread; }
}

/* ─────────────────────────────────────────────
   TOASTS (notifications temporaires)
───────────────────────────────────────────── */

/**
 * Affiche un toast de notification en bas à droite.
 * Disparaît automatiquement après 3.5 secondes.
 * @param {string} icon  - Emoji icône
 * @param {string} title - Titre du toast
 * @param {string} body  - Texte secondaire (optionnel)
 * @param {string} type  - 'success' | 'warn' | 'error' | 'info'
 */
function toast(icon, title, body, type = 'info') {
  const wrap = document.getElementById('toastWrap');
  const div  = document.createElement('div');
  div.className = `toast ${type}`;
  div.innerHTML = `
    <div class="toast-ico">${icon}</div>
    <div>
      <div class="toast-title">${title}</div>
      ${body ? `<div class="toast-body">${body}</div>` : ''}
    </div>`;
  wrap.appendChild(div);
  setTimeout(() => { div.style.opacity = '0'; }, 3500);
  setTimeout(() => div.remove(), 3950);
}