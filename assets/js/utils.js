"use strict";
/* ═══════════════════════════════════════════════════════════
   CloudPay — utils.js
   Contient :
   • DB      → base de données localStorage (CRUD complet)
   • État global → currentUser, currentMode, variables pending
   • DEMO    → compte de démonstration
   • Utilitaires → formatage, copie, export CSV, escapeHTML
   • defaultDevCfg() → configuration développeur par défaut
═══════════════════════════════════════════════════════════ */

/* ─────────────────────────────────────────────
   BASE DE DONNÉES (localStorage)
   Toutes les données sont stockées côté client.
   Chaque utilisateur a ses propres données isolées
   via un préfixe basé sur son ID.
───────────────────────────────────────────── */
const DB = {

  /* Retourne l'identifiant de l'utilisateur courant.
     Si non connecté, utilise 'guest' comme espace commun. */
  _uid: () => (currentUser ? currentUser.id : 'guest'),

  /* Lecture / Écriture / Suppression générique */
  get(k)    { try { return JSON.parse(localStorage.getItem('cp_' + k)); } catch { return null; } },
  set(k, v) { localStorage.setItem('cp_' + k, JSON.stringify(v)); },
  rm(k)     { localStorage.removeItem('cp_' + k); },

  /* ── Utilisateurs ─────────────────────────── */
  getUsers()      { return this.get('users') || []; },
  setUsers(u)     { this.set('users', u); },
  findUser(email) {
    return this.getUsers().find(u => u.email.toLowerCase() === email.toLowerCase());
  },

  /* ── Session (connexion persistante) ─────── */
  getSession()    { return this.get('session'); },
  setSession(u)   { this.set('session', u); },
  clearSession()  { this.rm('session'); },

  /* ── Transactions ─────────────────────────── */
  getTx()   { return this.get('tx_' + this._uid()) || []; },
  setTx(v)  { this.set('tx_' + this._uid(), v); },
  addTx(t)  {
    t.id = 'TXN-' + Date.now();
    t.ts = new Date().toISOString();
    this.setTx([t, ...this.getTx()]);
    return t;
  },

  /* ── Notifications ────────────────────────── */
  getNotifs()   { return this.get('notifs_' + this._uid()) || []; },
  setNotifs(v)  { this.set('notifs_' + this._uid(), v); },
  addNotif(n)   {
    n.id   = 'NTF-' + Date.now();
    n.ts   = new Date().toISOString();
    n.read = false;
    this.setNotifs([n, ...this.getNotifs()]);
    updateNotifBadge(); // défini dans ui.js
    return n;
  },
  markRead() {
    this.setNotifs(this.getNotifs().map(n => ({ ...n, read: true })));
    updateNotifBadge();
  },

  /* ── Séquestres (Escrow) ──────────────────── */
  getEscrows()   { return this.get('esc_' + this._uid()) || []; },
  setEscrows(v)  { this.set('esc_' + this._uid(), v); },
  addEscrow(e)   {
    e.id        = 'ESC-' + Date.now();
    e.createdAt = new Date().toISOString();
    this.setEscrows([e, ...this.getEscrows()]);
    return e;
  },
  patchEscrow(id, patch) {
    this.setEscrows(this.getEscrows().map(e => e.id === id ? { ...e, ...patch } : e));
  },

  /* ── Clés API ─────────────────────────────── */
  getApiKeys()    { return this.get('keys_' + this._uid()) || []; },
  setApiKeys(v)   { this.set('keys_' + this._uid(), v); },
  addApiKey(k)    {
    k.id        = 'KEY-' + Date.now();
    k.createdAt = new Date().toISOString();
    this.setApiKeys([...this.getApiKeys(), k]);
    return k;
  },

  /* ── Règles de partage (Split) ─────────────── */
  getSplitRules()    { return this.get('splits_' + this._uid()) || []; },
  setSplitRules(v)   { this.set('splits_' + this._uid(), v); },

  /* ── Configuration développeur ─────────────── */
  getDevCfg()  { return this.get('devcfg_' + this._uid()) || defaultDevCfg(); },
  setDevCfg(v) { this.set('devcfg_' + this._uid(), v); },
};

/* ─────────────────────────────────────────────
   CONFIGURATION DÉVELOPPEUR PAR DÉFAUT
   Structure complète de toutes les options
   disponibles pour les marchands/développeurs.
───────────────────────────────────────────── */
function defaultDevCfg() {
  return {
    payment_methods: {
      orange_money: { enabled: true,  merchantId: '', apiKey: '', webhook: '' },
      mtn_money:    { enabled: true,  merchantId: '', apiKey: '', webhook: '' },
      wave:         { enabled: false, merchantId: '', apiKey: '', webhook: '' },
      moov:         { enabled: false, merchantId: '', apiKey: '', webhook: '' },
      mastercard:   { enabled: false, merchantId: '', apiKey: '', secretKey: '', endpoint: '' },
      visa:         { enabled: false, merchantId: '', apiKey: '', secretKey: '', endpoint: '' },
      paypal:       { enabled: false, clientId: '', clientSecret: '', mode: 'sandbox' },
      stripe:       { enabled: false, publishableKey: '', secretKey: '', webhookSecret: '' },
      crypto:       { enabled: false, walletAddress: '', network: 'BTC' },
    },
    fraud_rules: {
      velocity_check: true, location_check: true, card_multi: true,
      temp_email: true, bot_detection: true, chargeback_block: true,
      otp_above: 50000, max_score: 70, action: 'block'
    },
    webhooks: [],
    split_config: { seller: 70, platform: 25, delivery: 5, delivery_enabled: false }
  };
}

/* ─────────────────────────────────────────────
   ÉTAT GLOBAL PARTAGÉ
   Ces variables sont accessibles depuis tous
   les autres fichiers JS de l'application.
───────────────────────────────────────────── */
let currentUser       = null;   // null = mode visiteur (non connecté)
let currentMode       = 'user'; // 'user' | 'merchant' | 'dev'
let pendingEscrow     = null;   // Données du séquestre en attente de confirmation PIN
let pendingTransfer   = null;   // Données du transfert en attente de confirmation
let pendingValidation = null;   // Séquestre en attente de validation livraison
let selectedPm        = '';     // Méthode de paiement sélectionnée pour la recharge
let generatedApiKey   = '';     // Dernière clé API générée (affiché dans la modale)

/* ─────────────────────────────────────────────
   COMPTE DÉMO
   Pré-créé automatiquement au premier chargement.
   Permet de tester toutes les fonctionnalités
   sans avoir à créer un compte.
───────────────────────────────────────────── */
const DEMO = {
  id: 'demo-001',
  firstName: 'Demo',
  lastName:  'Utilisateur',
  email:     'demo@cloudpay.ci',
  phone:     '+225 07 00 00 00 00',
  password:  'demo1234',
  type:      'developer',
  balance:   245000,
  pin:       '123456',
  createdAt: '2026-01-01T00:00:00.000Z'
};

/* ─────────────────────────────────────────────
   UTILITAIRES DE FORMATAGE
───────────────────────────────────────────── */

/** Formate un nombre en montant FCFA lisible.
 *  Exemple : 125000 → "125 000"
 */
function fmtAmt(n) {
  return Math.round(n || 0).toLocaleString('fr-FR');
}

/** Formate une date en format long français.
 *  Exemple : "10 avril 2026"
 */
function fmtDate(d) {
  return d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' });
}

/** Formate une date en format court avec heure.
 *  Exemple : "10/04/2026 14:22"
 */
function fmtDateShort(d) {
  return d.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' })
    + ' ' + d.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
}

/** Échappe les caractères HTML spéciaux pour éviter les injections XSS.
 *  Utilisé sur toutes les données utilisateur affichées dans le DOM.
 *  Exemple : '<script>' → '&lt;script&gt;'
 */
function esc(s) {
  return String(s || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/* ─────────────────────────────────────────────
   GESTION DU SOLDE
───────────────────────────────────────────── */

/** Modifie le solde de l'utilisateur courant et sauvegarde en DB.
 *  @param {number} delta - Montant à ajouter (positif) ou déduire (négatif)
 */
function updateBalance(delta) {
  if (!currentUser) return;
  currentUser.balance = Math.max(0, (currentUser.balance || 0) + delta);
  const users = DB.getUsers().map(u => u.id === currentUser.id ? currentUser : u);
  DB.setUsers(users);
  DB.setSession(currentUser);
}

/* ─────────────────────────────────────────────
   COPIER DANS LE PRESSE-PAPIERS
───────────────────────────────────────────── */

/** Copie un texte dans le presse-papiers et affiche un toast de confirmation.
 *  Retire automatiquement les balises HTML si le texte en contient.
 *  @param {string} text - Texte ou HTML à copier
 */
function copyText(text) {
  const clean = String(text).replace(/<[^>]+>/g, '').trim();
  navigator.clipboard?.writeText(clean)
    .then(() => toast('📋', 'Copié !', '', 'success'))
    .catch(() => toast('📋', 'Copié', '', 'success'));
}

/* ─────────────────────────────────────────────
   EXPORT CSV
───────────────────────────────────────────── */

/** Exporte toutes les transactions de l'utilisateur courant
 *  au format CSV et déclenche le téléchargement.
 */
function exportCSV() {
  const txs = DB.getTx();
  if (!txs.length) { toast('⚠️', 'Aucune transaction', '', 'warn'); return; }
  const header = 'ID,Description,Type,Montant,Statut,Date\n';
  const rows   = txs.map(t =>
    `${t.id},"${t.description}",${t.type},${t.amount},${t.status},${t.ts}`
  ).join('\n');
  const a = document.createElement('a');
  a.href     = URL.createObjectURL(new Blob([header + rows], { type: 'text/csv' }));
  a.download = 'cloudpay_transactions.csv';
  a.click();
  toast('📥', 'Export CSV', 'Fichier téléchargé', 'success');
}