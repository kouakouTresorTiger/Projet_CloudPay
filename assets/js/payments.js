"use strict";
/* ═══════════════════════════════════════════════════════════
   CloudPay — payments.js
   Dépend de : utils.js (DB, currentUser, fmtAmt, esc, updateBalance, toast, copyText)
               auth.js  (requireAuth)
               ui.js    (openModal, closeModal, nav, renderApiKeys, renderWebhookList)
   Contient :
   ── Paiement sécurisé (Escrow) ──────────────────────────
   • syncEscrowAmount()    → synchronise prix et montant à bloquer
   • updateEscrowSummary() → aperçu live du récapitulatif
   • submitEscrow()        → valide et soumet le formulaire séquestre
   • openValidate()        → ouvre la modale de validation livraison
   • confirmDelivery()     → libère les fonds au vendeur
   • cancelEscrow()        → annule un séquestre non verrouillé
   ── PIN ────────────────────────────────────────────────
   • pinNext()             → navigation entre les 6 cases PIN
   • confirmPin()          → vérifie le PIN et exécute l'action en attente
   ── Recharge ───────────────────────────────────────────
   • selPm()               → sélectionne une méthode de paiement
   • setQ()                → pré-remplit un montant rapide
   • doRecharge()          → exécute la recharge du compte
   ── Transfert ──────────────────────────────────────────
   • initTransfer()        → prépare et confirme un transfert
   • executeTransfer()     → exécute le transfert confirmé
   ── Partage revenus (Split) ────────────────────────────
   • toggleDelivery()      → active/désactive la part livreur
   • recalcSplitConfig()   → recalcule le total et le simulateur
   • saveSplitConfig()     → sauvegarde la règle de partage
   ── Clés API ───────────────────────────────────────────
   • genKey()              → génère une nouvelle paire pk/sk
   • copyApiKey()          → copie la clé secrète générée
   • revealSk()            → révèle/masque une clé secrète
   • deleteApiKey()        → supprime une clé API
   ── Configuration paiements (Dev) ──────────────────────
   • togglePmMethod()      → active/désactive un moyen de paiement
   • testPmConfig()        → teste la connexion à un fournisseur
   • saveDevConfig()       → sauvegarde tous les paramètres paiement
   ── Anti-fraude ────────────────────────────────────────
   • saveFraudConfig()     → sauvegarde les règles anti-fraude IA
   ── Webhooks ───────────────────────────────────────────
   • renderWebhookList()   → affiche la liste des endpoints enregistrés
   • saveWebhook()         → enregistre un nouvel endpoint webhook
═══════════════════════════════════════════════════════════ */

/* ─────────────────────────────────────────────
   PAIEMENT SÉCURISÉ — SÉQUESTRE (ESCROW)
───────────────────────────────────────────── */

/**
 * Synchronise automatiquement le champ "Montant à bloquer"
 * avec le champ "Prix affiché" si l'utilisateur n'a pas encore
 * saisi de montant manuellement.
 */
function syncEscrowAmount() {
  const price  = document.getElementById('escPrice')?.value;
  const amtEl  = document.getElementById('escAmount');
  if (amtEl && !amtEl.value && price) amtEl.value = price;
  updateEscrowSummary();
}

/**
 * Met à jour en temps réel le récapitulatif du paiement sécurisé
 * au fur et à mesure que l'utilisateur remplit le formulaire.
 * S'affiche automatiquement dès que les champs clés sont renseignés.
 */
function updateEscrowSummary() {
  const name     = document.getElementById('escName')?.value;
  const amount   = parseInt(document.getElementById('escAmount')?.value || 0);
  const seller   = document.getElementById('escSeller')?.value;
  const deadline = document.getElementById('escDeadline')?.value;
  const sumEl    = document.getElementById('escrowSummary');
  if (!sumEl) return;

  if (name && amount && seller && deadline) {
    const fee   = Math.round(amount * 0.01); // 1% de frais CloudPay
    const total = amount + fee;
    sumEl.style.display = 'block';
    sumEl.innerHTML = `
      <div class="section-title">Récapitulatif</div>
      <div class="kv-row"><span class="kv-key">Produit</span><span class="kv-val">${esc(name)}</span></div>
      <div class="kv-row"><span class="kv-key">Vendeur</span><span class="kv-val">${esc(seller)}</span></div>
      <div class="kv-row"><span class="kv-key">Montant bloqué</span><span class="kv-val" style="color:var(--amber);">${fmtAmt(amount)} FCFA</span></div>
      <div class="kv-row"><span class="kv-key">Date limite</span><span class="kv-val" style="color:var(--red);">${fmtDate(new Date(deadline))}</span></div>
      <div class="kv-row"><span class="kv-key">Frais CloudPay (1%)</span><span class="kv-val">${fmtAmt(fee)} FCFA</span></div>
      <div class="kv-row" style="border-bottom:none;">
        <span class="kv-key" style="font-weight:700;">Total débité de votre solde</span>
        <span class="kv-val" style="color:var(--accent);font-size:15px;">${fmtAmt(total)} FCFA</span>
      </div>`;
  } else {
    sumEl.style.display = 'none';
  }
}

/**
 * Valide le formulaire de séquestre et demande la confirmation PIN.
 * Vérifie que tous les champs requis sont remplis et que le solde
 * est suffisant avant d'ouvrir la modale PIN.
 */
function submitEscrow() {
  if (!currentUser) { requireAuth(() => {}); return; }

  const name     = document.getElementById('escName')?.value?.trim();
  const amount   = parseInt(document.getElementById('escAmount')?.value || 0);
  const seller   = document.getElementById('escSeller')?.value?.trim();
  const deadline = document.getElementById('escDeadline')?.value;
  const notes    = document.getElementById('escNotes')?.value;
  const url      = document.getElementById('escUrl')?.value;

  /* Validation */
  if (!name)     { toast('⚠️', 'Nom du produit requis', '', 'warn');        return; }
  if (!amount)   { toast('⚠️', 'Montant requis', '',  'warn');              return; }
  if (!seller)   { toast('⚠️', 'Compte vendeur requis', '', 'warn');        return; }
  if (!deadline) { toast('⚠️', 'Date limite requise', '', 'warn');          return; }

  const fee = Math.round(amount * 0.01);
  if (amount + fee > currentUser.balance) {
    toast('❌', 'Solde insuffisant',
      `Solde: ${fmtAmt(currentUser.balance)} FCFA · Requis: ${fmtAmt(amount + fee)} FCFA`, 'error');
    return;
  }

  /* Stocker en attente de confirmation PIN */
  pendingEscrow = { name, amount, seller, deadline, notes, url, productName: name, sellerAccount: seller };
  closeModal('escrowModal');
  openModal('pinModal');
}

/**
 * Ouvre la modale de validation de livraison pour un séquestre donné.
 * Affiche les informations de la commande pour que l'utilisateur
 * puisse les vérifier avant de confirmer.
 * @param {string} id - ID du séquestre à valider
 */
function openValidate(id) {
  const e = DB.getEscrows().find(x => x.id === id);
  if (!e) return;
  pendingValidation = e;
  document.getElementById('validateInfo').innerHTML = `
    <div class="kv-row"><span class="kv-key">Produit</span><span class="kv-val">${esc(e.productName)}</span></div>
    <div class="kv-row"><span class="kv-key">Montant libéré</span><span class="kv-val" style="color:var(--green);">${fmtAmt(e.amount)} FCFA</span></div>
    <div class="kv-row" style="border-bottom:none;"><span class="kv-key">Vendeur</span><span class="kv-val">${esc(e.sellerAccount)}</span></div>`;
  openModal('validateModal');
}

/**
 * Confirme la livraison : marque le séquestre comme livré,
 * libère les fonds au vendeur et enregistre la transaction.
 * Déclenché par le bouton "✅ Confirmer" de la modale.
 */
function confirmDelivery() {
  if (!pendingValidation) return;
  closeModal('validateModal');

  DB.patchEscrow(pendingValidation.id, { status: 'delivered' });
  DB.addTx({
    type:        'debit',
    amount:      -pendingValidation.amount,
    description: `Libéré · ${pendingValidation.productName}`,
    status:      'done',
    statusLabel: 'Livré ✅'
  });
  DB.addNotif({
    icon:  '✅',
    title: 'Livraison validée !',
    body:  `${fmtAmt(pendingValidation.amount)} FCFA libérés à ${pendingValidation.sellerAccount}`,
    type:  'info'
  });
  toast('✅', 'Livraison confirmée !', `${fmtAmt(pendingValidation.amount)} FCFA transférés au vendeur`, 'success');
  setTimeout(() => toast('⚖️', 'Split exécuté', 'Fonds distribués automatiquement selon votre règle', 'info'), 1200);

  pendingValidation = null;
  nav('escrow');
}

/**
 * Annule un séquestre en attente (non verrouillé).
 * Restitue le montant + frais sur le solde de l'utilisateur.
 * Si le vendeur a verrouillé le paiement, l'annulation est impossible.
 * @param {string} id - ID du séquestre à annuler
 */
function cancelEscrow(id) {
  const e = DB.getEscrows().find(x => x.id === id);
  if (!e) return;

  if (e.status === 'locked') {
    toast('🔒', 'Annulation impossible', 'Le vendeur a verrouillé ce paiement jusqu\'à la date limite', 'error');
    return;
  }

  DB.patchEscrow(id, { status: 'cancelled' });
  updateBalance(e.amount + Math.round(e.amount * 0.01)); // Remboursement montant + frais
  DB.addTx({
    type:        'refund',
    amount:      e.amount,
    description: `Annulé · ${e.productName}`,
    status:      'refunded',
    statusLabel: 'Annulé ↩️'
  });
  DB.addNotif({
    icon:  '↩️',
    title: 'Paiement annulé',
    body:  `${fmtAmt(e.amount)} FCFA restitués sur votre compte`,
    type:  'warn'
  });
  toast('↩️', 'Annulation effectuée', `${fmtAmt(e.amount)} FCFA restitués sur votre solde`, 'info');
  nav('escrow');
}

/* ─────────────────────────────────────────────
   CODE PIN DE CONFIRMATION
───────────────────────────────────────────── */

/**
 * Passe le focus à la prochaine case PIN quand l'utilisateur
 * saisit un chiffre. Facilite la saisie rapide.
 * @param {HTMLInputElement} input - Case PIN actuelle
 * @param {number} idx - Index de la case (0 à 5)
 */
function pinNext(input, idx) {
  if (input.value && idx < 5) {
    document.querySelectorAll('.pin-input')[idx + 1]?.focus();
  }
}

/**
 * Vérifie le code PIN saisi et exécute l'action en attente
 * (création de séquestre). Si le PIN est incorrect, affiche
 * un message d'erreur.
 */
function confirmPin() {
  const pins = [...document.querySelectorAll('.pin-input')].map(i => i.value).join('');

  if (pins.length < 6) {
    toast('⚠️', 'PIN incomplet', 'Entrez les 6 chiffres', 'warn');
    return;
  }

  const expectedPin = currentUser?.pin || '123456';
  if (pins !== expectedPin) {
    toast('❌', 'PIN incorrect', 'Vérifiez votre code PIN (par défaut: 123456)', 'error');
    return;
  }

  /* PIN correct : réinitialiser les cases */
  closeModal('pinModal');
  document.querySelectorAll('.pin-input').forEach(i => i.value = '');

  /* Exécuter l'action en attente */
  if (pendingEscrow) {
    const fee = Math.round(pendingEscrow.amount * 0.01);
    updateBalance(-(pendingEscrow.amount + fee));

    const created = DB.addEscrow({ ...pendingEscrow, status: 'pending' });
    DB.addTx({
      type:        'escrow',
      amount:      -pendingEscrow.amount,
      description: `Séquestre · ${pendingEscrow.name}`,
      status:      'pending',
      statusLabel: 'En attente ⏳',
      escrowId:    created.id
    });
    DB.addNotif({
      icon:  '🔒',
      title: 'Paiement sécurisé lancé',
      body:  `${fmtAmt(pendingEscrow.amount)} FCFA bloqués pour "${pendingEscrow.name}"`,
      type:  'info'
    });
    toast('🔒', 'Paiement sécurisé lancé !', `${fmtAmt(pendingEscrow.amount)} FCFA en séquestre`, 'success');
    setTimeout(() => toast('📨', 'Vendeur notifié', `${pendingEscrow.seller} a été informé du paiement en attente`, 'info'), 1200);

    pendingEscrow = null;
    nav('dashboard');
  }
}

/* ─────────────────────────────────────────────
   RECHARGE DU COMPTE
───────────────────────────────────────────── */

/**
 * Sélectionne une méthode de paiement et affiche
 * les champs correspondants (téléphone, carte, PayPal...).
 * @param {HTMLElement} el   - Carte méthode cliquée
 * @param {string} name      - Nom de la méthode (ex: 'Orange Money')
 * @param {string} type      - Type de champs : 'phone'|'card'|'paypal'|'crypto'
 */
function selPm(el, name, type) {
  document.querySelectorAll('.pm-card').forEach(e => e.classList.remove('sel'));
  el.classList.add('sel');
  selectedPm = name;

  const fields = document.getElementById('pmFields');
  if (!fields) return;

  /* Templates HTML pour chaque type de méthode */
  const templates = {
    phone: `
      <div class="form-group">
        <label class="form-label">📱 Numéro de téléphone</label>
        <input type="tel" class="form-input" placeholder="+225 07 00 00 00 00" />
      </div>`,

    card: `
      <div class="form-row">
        <div class="form-group">
          <label class="form-label">Numéro de carte</label>
          <input type="text" class="form-input" placeholder="0000 0000 0000 0000" maxlength="19" />
        </div>
        <div class="form-group">
          <label class="form-label">Nom sur la carte</label>
          <input type="text" class="form-input" placeholder="NOM PRÉNOM" />
        </div>
      </div>
      <div class="form-row">
        <div class="form-group">
          <label class="form-label">Expiration</label>
          <input type="text" class="form-input" placeholder="MM/AA" maxlength="5" />
        </div>
        <div class="form-group">
          <label class="form-label">CVV</label>
          <input type="password" class="form-input" placeholder="•••" maxlength="4" />
        </div>
      </div>`,

    paypal: `
      <div class="form-group">
        <label class="form-label">📧 Email PayPal</label>
        <input type="email" class="form-input" placeholder="vous@email.com" />
      </div>`,

    crypto: `
      <div class="form-group">
        <label class="form-label">₿ Adresse wallet source</label>
        <input type="text" class="form-input" placeholder="1BvBMSEYstWetqTFn5Au4m4GFg7xJaNVN2" />
      </div>`,
  };

  fields.innerHTML = templates[type] || '';
}

/**
 * Pré-remplit le champ montant avec une valeur rapide.
 * @param {number} v - Montant en FCFA
 */
function setQ(v) {
  const el = document.getElementById('rchAmount');
  if (el) el.value = v;
}

/**
 * Exécute la recharge après validation des champs.
 * Crédite le solde, enregistre la transaction et
 * ajoute une notification.
 */
function doRecharge() {
  if (!currentUser) { requireAuth(() => {}); return; }
  if (!selectedPm)  { toast('⚠️', 'Choisissez un mode de paiement', '', 'warn'); return; }

  const amount = parseInt(document.getElementById('rchAmount')?.value || 0);
  if (!amount || amount < 500) {
    toast('⚠️', 'Montant invalide', 'Minimum 500 FCFA', 'warn');
    return;
  }

  closeModal('rechargeModal');
  updateBalance(amount);
  DB.addTx({
    type:        'credit',
    amount:      amount,
    description: `Recharge ${selectedPm}`,
    status:      'done',
    statusLabel: 'Réussi ✅'
  });
  DB.addNotif({
    icon:  '💰',
    title: 'Recharge réussie',
    body:  `+${fmtAmt(amount)} FCFA crédités via ${selectedPm}`,
    type:  'info'
  });
  toast('💰', 'Recharge réussie !', `+${fmtAmt(amount)} FCFA ajoutés à votre solde`, 'success');
  selectedPm = '';
  nav('dashboard');
}

/* ─────────────────────────────────────────────
   TRANSFERT D'ARGENT
───────────────────────────────────────────── */

/**
 * Prépare un transfert et affiche la modale de confirmation.
 * Lit les champs selon le type (CloudPay / Mobile Money / Banque).
 * @param {string} type - 'coud' | 'mobile' | 'bank'
 */
function initTransfer(type) {
  if (!currentUser) { requireAuth(() => {}); return; }

  let dest, amount;

  if (type === 'coud') {
    dest   = document.getElementById('trDest')?.value?.trim();
    amount = parseInt(document.getElementById('trAmt')?.value || 0);
  } else if (type === 'mobile') {
    dest   = (document.getElementById('trOp')?.value || '') + ':' +
             (document.getElementById('trPhone')?.value?.trim() || '');
    amount = parseInt(document.getElementById('trAmtM')?.value || 0);
  } else if (type === 'bank') {
    dest   = document.getElementById('trIban')?.value?.trim();
    amount = parseInt(document.getElementById('trAmtB')?.value || 0);
  }

  if (!dest || !dest.trim())  { toast('⚠️', 'Destinataire requis', '', 'warn'); return; }
  if (!amount)                { toast('⚠️', 'Montant requis', '', 'warn'); return; }
  if (amount > currentUser.balance) {
    toast('❌', 'Solde insuffisant', `Solde disponible : ${fmtAmt(currentUser.balance)} FCFA`, 'error');
    return;
  }

  /* Stocker et afficher la confirmation */
  pendingTransfer = { dest, amount, type };
  document.getElementById('transferInfo').innerHTML = `
    <div class="kv-row"><span class="kv-key">Destinataire</span><span class="kv-val">${esc(dest)}</span></div>
    <div class="kv-row" style="border-bottom:none;">
      <span class="kv-key">Montant à envoyer</span>
      <span class="kv-val" style="color:var(--red);">-${fmtAmt(amount)} FCFA</span>
    </div>`;
  openModal('transferModal');
}

/**
 * Exécute le transfert après confirmation dans la modale.
 * Débite le solde, enregistre la transaction et notifie.
 */
function executeTransfer() {
  if (!pendingTransfer) return;
  closeModal('transferModal');

  updateBalance(-pendingTransfer.amount);
  DB.addTx({
    type:        'debit',
    amount:      -pendingTransfer.amount,
    description: `Transfert → ${pendingTransfer.dest}`,
    status:      'done',
    statusLabel: 'Envoyé ✅'
  });
  DB.addNotif({
    icon:  '↗️',
    title: 'Transfert effectué',
    body:  `${fmtAmt(pendingTransfer.amount)} FCFA envoyés à ${pendingTransfer.dest}`,
    type:  'info'
  });
  toast('↗️', 'Transfert effectué !', `${fmtAmt(pendingTransfer.amount)} FCFA envoyés`, 'success');
  pendingTransfer = null;
  nav('dashboard');
}

/* ─────────────────────────────────────────────
   PARTAGE DE REVENUS (SPLIT CONFIG)
───────────────────────────────────────────── */

/**
 * Active ou désactive la part livreur dans la configuration.
 * Met à jour les styles visuels de la carte livreur.
 * @param {HTMLElement} btn - Bouton toggle livreur
 */
function toggleDelivery(btn) {
  btn.classList.toggle('on');
  const on     = btn.classList.contains('on');
  const fields = document.getElementById('deliveryFields');
  const card   = document.getElementById('deliveryCard');
  const icon   = document.getElementById('deliveryIcon');

  if (fields) fields.style.display = on ? 'block' : 'none';
  if (card) {
    card.style.borderLeftColor = on ? 'var(--amber)' : 'var(--border)';
    card.style.background      = on ? 'var(--am-light)' : 'var(--s2)';
  }
  if (icon) icon.style.background = on ? 'var(--amber)' : 'var(--muted)';
  recalcSplitConfig();
}

/**
 * Recalcule le total des pourcentages et met à jour
 * le simulateur de distribution en temps réel.
 * Appelée à chaque modification des valeurs.
 */
function recalcSplitConfig() {
  const seller   = parseInt(document.getElementById('sp-seller')?.value   || 0);
  const platform = parseInt(document.getElementById('sp-platform')?.value || 0);
  const delivOn  = document.getElementById('deliveryToggle')?.classList.contains('on');
  const delivery = delivOn ? parseInt(document.getElementById('sp-delivery')?.value || 0) : 0;
  const total    = seller + platform + delivery;

  /* Affichage du total avec code couleur */
  const pctEl  = document.getElementById('splitConfigPct');
  const cardEl = document.getElementById('splitConfigTotal');
  if (pctEl) {
    pctEl.textContent = total + '%';
    pctEl.style.color = total === 100 ? 'var(--green)' : total > 100 ? 'var(--red)' : 'var(--amber)';
  }
  if (cardEl) {
    cardEl.style.background = total === 100 ? 'var(--g-light)' : total > 100 ? 'var(--r-light)' : 'var(--a-light)';
  }

  /* Simulateur : calcul des montants */
  const amt   = parseInt(document.getElementById('simAmt')?.value || 100000);
  const simEl = document.getElementById('simResults');
  if (!simEl) return;

  simEl.innerHTML = `
    <div class="kv-row">
      <span class="kv-key" style="display:flex;align-items:center;gap:6px;">
        <span style="width:8px;height:8px;border-radius:50%;background:var(--green);display:inline-block;"></span>
        Vendeur (${seller}%)
      </span>
      <span class="kv-val" style="color:var(--green);">${fmtAmt(Math.round(amt * seller / 100))} FCFA</span>
    </div>
    <div class="kv-row">
      <span class="kv-key" style="display:flex;align-items:center;gap:6px;">
        <span style="width:8px;height:8px;border-radius:50%;background:var(--accent);display:inline-block;"></span>
        Plateforme (${platform}%)
      </span>
      <span class="kv-val" style="color:var(--accent);">${fmtAmt(Math.round(amt * platform / 100))} FCFA</span>
    </div>
    ${delivOn ? `
    <div class="kv-row">
      <span class="kv-key" style="display:flex;align-items:center;gap:6px;">
        <span style="width:8px;height:8px;border-radius:50%;background:var(--amber);display:inline-block;"></span>
        Livreur (${delivery}%)
      </span>
      <span class="kv-val" style="color:var(--amber);">${fmtAmt(Math.round(amt * delivery / 100))} FCFA</span>
    </div>` : ''}
    <div class="kv-row" style="border-bottom:none;border-top:1px solid var(--border);padding-top:10px;">
      <span class="kv-key" style="font-weight:700;">Total</span>
      <span class="kv-val" style="color:${total === 100 ? 'var(--green)' : total > 100 ? 'var(--red)' : 'var(--amber)'};">
        ${total}%${total === 100 ? ' ✅' : total > 100 ? ' ⚠️ Dépasse 100%' : ' ⚠️ Doit être 100%'}
      </span>
    </div>`;
}

/**
 * Sauvegarde la configuration de partage dans la base de données.
 * Vérifie que le total est exactement 100% avant de sauvegarder.
 */
function saveSplitConfig() {
  const seller   = parseInt(document.getElementById('sp-seller')?.value   || 0);
  const platform = parseInt(document.getElementById('sp-platform')?.value || 0);
  const delivOn  = document.getElementById('deliveryToggle')?.classList.contains('on');
  const delivery = delivOn ? parseInt(document.getElementById('sp-delivery')?.value || 0) : 0;
  const total    = seller + platform + delivery;

  if (total !== 100) {
    toast('⚠️', 'Total ≠ 100%', `Total actuel : ${total}%. Ajustez les pourcentages pour atteindre 100%.`, 'warn');
    return;
  }

  const cfg = DB.getDevCfg();
  cfg.split_config = { seller, platform, delivery, delivery_enabled: delivOn };
  DB.setDevCfg(cfg);

  /* Ajouter à l'historique des règles */
  const rules = DB.getSplitRules();
  rules.unshift({
    id:            'split-' + Date.now(),
    name:          `Config ${fmtDateShort(new Date())}`,
    beneficiaries: [{ name: 'Vendeur', pct: seller }, { name: 'Plateforme', pct: platform }]
                     .concat(delivOn ? [{ name: 'Livreur', pct: delivery }] : []),
    createdAt:     new Date().toISOString()
  });
  DB.setSplitRules(rules.slice(0, 10)); // Garder les 10 dernières configs

  toast('💾', 'Configuration sauvegardée',
    `Vendeur ${seller}% · Plateforme ${platform}%${delivOn ? ' · Livreur ' + delivery + '%' : ''}`, 'success');
}

/* ─────────────────────────────────────────────
   CLÉS API
───────────────────────────────────────────── */

/**
 * Génère une nouvelle paire de clés API (pk_ + sk_)
 * et affiche la clé secrète dans une modale pour copie.
 * @param {string} env - 'test' ou 'live'
 */
function genKey(env) {
  if (!currentUser) { requireAuth(() => {}); return; }

  const name = prompt('Nom de la clé (ex: "Site principal", "App mobile") :');
  if (name === null) return; // L'utilisateur a annulé

  const rand = () => Math.random().toString(36).slice(2, 10);
  const pk   = `pk_${env === 'test' ? 'test' : 'live'}_${rand()}${rand()}`;
  const sk   = `sk_${env === 'test' ? 'test' : 'live'}_${rand()}${rand()}${rand()}`;

  DB.addApiKey({ env, pk, sk, name: name || 'Sans nom' });
  generatedApiKey = sk;

  /* Afficher la clé dans la modale avant qu'elle soit masquée */
  document.getElementById('apiKeyReveal').textContent = sk;
  openModal('apiKeyModal');
  renderApiKeys(); // Rafraîchir la liste
}

/** Copie la clé secrète générée dans le presse-papiers. */
function copyApiKey() {
  copyText(generatedApiKey);
  closeModal('apiKeyModal');
}

/**
 * Révèle ou re-masque une clé secrète dans la liste.
 * @param {string} id - ID de la clé
 * @param {string} sk - Valeur réelle de la clé secrète
 */
function revealSk(id, sk) {
  const el = document.getElementById('sk-' + id);
  if (el) el.textContent = el.textContent.includes('•')
    ? sk                                   // Révéler
    : sk.slice(0, 12) + '••••••••••••••••••••'; // Re-masquer
}

/**
 * Supprime une clé API après confirmation.
 * @param {string} id - ID de la clé à supprimer
 */
function deleteApiKey(id) {
  if (!confirm('Supprimer cette clé API ? Cette action est irréversible.')) return;
  DB.setApiKeys(DB.getApiKeys().filter(k => k.id !== id));
  toast('🗑', 'Clé supprimée', '', 'info');
  renderApiKeys();
}

/* ─────────────────────────────────────────────
   CONFIGURATION DES MOYENS DE PAIEMENT (DEV)
───────────────────────────────────────────── */

/**
 * Active ou désactive un moyen de paiement via le toggle.
 * Affiche/masque les champs de configuration correspondants.
 * @param {string} id  - Identifiant du moyen de paiement (ex: 'orange_money')
 * @param {HTMLElement} btn - Bouton toggle cliqué
 */
function togglePmMethod(id, btn) {
  btn.classList.toggle('on');
  const on   = btn.classList.contains('on');
  const card = document.getElementById('pmcard-' + id);
  const flds = document.getElementById('fields-' + id);
  if (card) card.classList.toggle('enabled', on);
  if (flds) flds.style.display = on ? 'block' : 'none';
}

/**
 * Simule un test de connexion pour un moyen de paiement.
 * En production, cela enverrait une requête réelle à l'API du fournisseur.
 * @param {string} id - Identifiant du moyen de paiement
 */
function testPmConfig(id) {
  toast('🧪', 'Test en cours...', `Vérification de la connexion ${id.replace(/_/g, ' ')}`, 'info');
  setTimeout(() => {
    toast('✅', 'Connexion établie', `${id.replace(/_/g, ' ')} est correctement configuré`, 'success');
  }, 2000);
}

/**
 * Sauvegarde toute la configuration des moyens de paiement.
 * Lit l'état de chaque toggle et les valeurs de chaque champ.
 */
function saveDevConfig() {
  const cfg = DB.getDevCfg();
  const ids = ['orange_money', 'mtn_money', 'wave', 'moov', 'mastercard', 'visa', 'paypal', 'stripe', 'crypto'];

  ids.forEach(id => {
    const toggle = document.getElementById('toggle-' + id);
    if (!toggle) return;

    cfg.payment_methods[id] = cfg.payment_methods[id] || {};
    cfg.payment_methods[id].enabled = toggle.classList.contains('on');

    /* Lire tous les champs du formulaire de cette méthode */
    document.querySelectorAll(`[id^="pm-${id}-"]`).forEach(field => {
      const fieldName = field.id.replace('pm-' + id + '-', '');
      cfg.payment_methods[id][fieldName] = field.value;
    });
  });

  DB.setDevCfg(cfg);
  toast('💾', 'Configuration sauvegardée', 'Tous les moyens de paiement ont été mis à jour', 'success');
}

/* ─────────────────────────────────────────────
   CONFIGURATION ANTI-FRAUDE IA
───────────────────────────────────────────── */

/**
 * Sauvegarde les règles de détection de fraude.
 * Lit l'état de chaque toggle et les seuils configurés.
 */
function saveFraudConfig() {
  const cfg = DB.getDevCfg();
  cfg.fraud_rules = {
    location_check:   document.getElementById('fr-location_check')?.classList.contains('on'),
    velocity_check:   document.getElementById('fr-velocity_check')?.classList.contains('on'),
    card_multi:       document.getElementById('fr-card_multi')?.classList.contains('on'),
    temp_email:       document.getElementById('fr-temp_email')?.classList.contains('on'),
    bot_detection:    document.getElementById('fr-bot_detection')?.classList.contains('on'),
    chargeback_block: document.getElementById('fr-chargeback_block')?.classList.contains('on'),
    otp_above:  parseInt(document.getElementById('fr-otp')?.value   || 50000),
    max_score:  parseInt(document.getElementById('fr-score')?.value || 70),
    action:     document.getElementById('fr-action')?.value || 'block',
  };
  DB.setDevCfg(cfg);
  toast('🛡️', 'Anti-fraude sauvegardé', 'Règles IA mises à jour', 'success');
}

/* ─────────────────────────────────────────────
   WEBHOOKS
───────────────────────────────────────────── */

/**
 * Affiche la liste des endpoints webhook enregistrés.
 * Appelée automatiquement après le rendu de la page Webhooks.
 */
function renderWebhookList() {
  const cfg = DB.getDevCfg();
  const el  = document.getElementById('webhookList');
  if (!el) return;

  if (!cfg.webhooks?.length) {
    el.innerHTML = '<p style="font-size:13px;color:var(--muted);padding:10px 0;">Aucun endpoint configuré</p>';
    return;
  }

  el.innerHTML = cfg.webhooks.map(w => `
    <div style="display:flex;align-items:center;gap:10px;padding:10px;background:var(--s2);border-radius:var(--rs);margin-bottom:8px;">
      <div style="width:8px;height:8px;border-radius:50%;background:${w.active ? 'var(--green)' : 'var(--muted)'};flex-shrink:0;"></div>
      <code style="font-size:11px;flex:1;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${w.url}</code>
      <span class="chip chip-blue" style="font-size:10px;">${w.events?.length || 0} event(s)</span>
      <button class="btn btn-ghost btn-sm" onclick="toast('📨','Test envoyé','Payload test envoyé à ${esc(w.url)}','info')">
        Tester
      </button>
    </div>`).join('');
}

/**
 * Enregistre un nouvel endpoint webhook avec les événements sélectionnés.
 */
function saveWebhook() {
  const url = document.getElementById('whUrl')?.value?.trim();
  if (!url) { toast('⚠️', 'URL requise', '', 'warn'); return; }

  /* Collecter les événements cochés */
  const events = [...document.querySelectorAll('.form-group input[type="checkbox"]:checked')]
    .map(i => i.value)
    .filter(Boolean);

  const cfg = DB.getDevCfg();
  cfg.webhooks = cfg.webhooks || [];
  cfg.webhooks.push({
    url,
    events: events.length ? events : ['escrow.created', 'escrow.validated', 'escrow.refunded'],
    active:    true,
    createdAt: new Date().toISOString()
  });
  DB.setDevCfg(cfg);

  document.getElementById('whUrl').value = '';
  renderWebhookList();
  toast('✅', 'Webhook enregistré', url, 'success');
}