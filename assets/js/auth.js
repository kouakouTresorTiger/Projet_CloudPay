"use strict";
/* ═══════════════════════════════════════════════════════════
   CloudPay — auth.js
   Dépend de : utils.js (DB, currentUser, toast, esc)
               ui.js    (updateNotifBadge, openModal, closeModal, nav, setMode)
   Contient :
   • Initialisation de l'application au chargement (DOMContentLoaded)
   • updateAuthUI()   → met à jour la barre supérieure selon l'état connecté
   • doLogin()        → valide et connecte un utilisateur
   • doRegister()     → crée un nouveau compte
   • doLogout()       → déconnecte et remet en mode visiteur
   • confirmLogout()  → modale de confirmation avant déconnexion
   • requireAuth()    → guard pour actions nécessitant un compte
   • togglePw()       → afficher/masquer le mot de passe
   • fillDemo()       → remplir automatiquement le formulaire avec le compte démo
   • saveProfile()    → sauvegarder les modifications du profil
   • changePin()      → modifier le code PIN de transaction
═══════════════════════════════════════════════════════════ */

/* ─────────────────────────────────────────────
   INITIALISATION AU CHARGEMENT DE LA PAGE
   Point d'entrée principal de l'application.
   Exécuté automatiquement quand le DOM est prêt.
───────────────────────────────────────────── */
document.addEventListener('DOMContentLoaded', () => {

  /* 1. Créer le compte démo s'il n'existe pas encore */
  const users = DB.getUsers();
  if (!users.find(u => u.email === DEMO.email)) {
    DB.setUsers([...users, DEMO]);
  }

  /* 2. Restaurer la session si l'utilisateur était déjà connecté */
  const saved = DB.getSession();
  if (saved) {
    const fresh = DB.findUser(saved.email);
    if (fresh) currentUser = fresh;
  }

  /* 3. Définir la date minimum du champ "date limite de livraison"
        (minimum demain pour éviter les délais impossibles) */
  const dl = document.getElementById('escDeadline');
  if (dl) {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    dl.min = tomorrow.toISOString().split('T')[0];
  }

  /* 4. Fermer les modales en cliquant sur l'arrière-plan */
  document.querySelectorAll('.overlay').forEach(overlay => {
    overlay.addEventListener('click', e => {
      if (e.target === overlay) overlay.classList.remove('open');
    });
  });

  /* 5. Synchroniser l'interface avec l'état de connexion */
  updateAuthUI();

  /* 6. Démarrer en mode Client avec le tableau de bord */
  setMode('user', document.getElementById('modeUser'));
});

/* ─────────────────────────────────────────────
   MISE À JOUR DE L'INTERFACE AUTH (TOPBAR)
   Appelée après chaque connexion / déconnexion.
   Met à jour :
   - Les boutons "Se connecter / Créer un compte" (si visiteur)
   - Le nom + bouton "Déconnexion" (si connecté)
   - L'avatar et le nom dans la sidebar
   - La bannière visiteur
───────────────────────────────────────────── */
function updateAuthUI() {
  const loggedIn = !!currentUser;

  /* Topbar : affiche l'une ou l'autre zone */
  document.getElementById('authZone').style.display = loggedIn ? 'none' : 'flex';
  document.getElementById('userZone').style.display = loggedIn ? 'flex' : 'none';

  /* Bannière visiteur */
  document.getElementById('guestBanner').style.display = loggedIn ? 'none' : 'flex';

  if (loggedIn) {
    /* Sidebar : initiales et informations utilisateur */
    const initials = (currentUser.firstName[0] + currentUser.lastName[0]).toUpperCase();
    document.getElementById('sideAvatar').textContent   = initials;
    document.getElementById('sideUserName').textContent = `${currentUser.firstName} ${currentUser.lastName}`;
    document.getElementById('sideUserPlan').textContent = {
      personal:  'Particulier',
      merchant:  'Marchand',
      developer: 'Développeur'
    }[currentUser.type] || 'Compte';

    /* Topbar : prénom de l'utilisateur connecté */
    document.getElementById('topUserName').textContent = currentUser.firstName;
  } else {
    /* Mode visiteur */
    document.getElementById('sideAvatar').textContent   = '👤';
    document.getElementById('sideUserName').textContent = 'Visiteur';
    document.getElementById('sideUserPlan').textContent = 'Compte invité';
  }

  /* Mettre à jour le badge de notifications */
  updateNotifBadge();
}

/* ─────────────────────────────────────────────
   CONNEXION
   Vérifie les identifiants et connecte
   l'utilisateur s'ils sont valides.
───────────────────────────────────────────── */
function doLogin() {
  const email = (document.getElementById('loginEmail').value || '').trim();
  const pass  = (document.getElementById('loginPass').value  || '');

  /* Validation des champs */
  if (!email || !pass) {
    toast('⚠️', 'Champs requis', 'Remplissez votre email et mot de passe', 'warn');
    return;
  }

  /* Recherche de l'utilisateur en base */
  const user = DB.findUser(email);
  if (!user) {
    toast('❌', 'Compte introuvable', 'Aucun compte avec cet email — créez-en un', 'error');
    return;
  }
  if (user.password !== pass) {
    toast('❌', 'Mot de passe incorrect', 'Vérifiez votre mot de passe', 'error');
    return;
  }

  /* Connexion réussie */
  currentUser = user;
  DB.setSession(user);
  closeModal('loginModal');
  updateAuthUI();
  toast('✅', 'Connexion réussie', 'Bienvenue ' + user.firstName + ' !', 'success');

  /* Redirection selon le mode actif */
  nav(currentMode === 'dev' ? 'api-keys' : currentMode === 'merchant' ? 'split' : 'dashboard');
}

/* ─────────────────────────────────────────────
   INSCRIPTION
   Crée un nouveau compte après validation
   de tous les champs du formulaire.
───────────────────────────────────────────── */
function doRegister() {
  const first = (document.getElementById('regFirst').value || '').trim();
  const last  = (document.getElementById('regLast').value  || '').trim();
  const email = (document.getElementById('regEmail').value || '').trim();
  const phone = (document.getElementById('regPhone').value || '').trim();
  const pass  = (document.getElementById('regPass').value  || '');
  const type  = document.getElementById('regType').value;

  /* Validation champ par champ */
  if (!first)               { toast('⚠️', 'Prénom requis', '', 'warn'); return; }
  if (!last)                { toast('⚠️', 'Nom requis', '', 'warn'); return; }
  if (!email)               { toast('⚠️', 'Email requis', '', 'warn'); return; }
  if (!email.includes('@')) { toast('⚠️', 'Email invalide', 'Entrez un email valide (ex: vous@gmail.com)', 'warn'); return; }
  if (pass.length < 6)      { toast('⚠️', 'Mot de passe trop court', 'Minimum 6 caractères', 'warn'); return; }
  if (DB.findUser(email))   { toast('❌', 'Email déjà utilisé', 'Un compte existe déjà avec cet email', 'error'); return; }

  /* Création du compte */
  const newUser = {
    id:        'usr-' + Date.now(),
    firstName: first,
    lastName:  last,
    email,
    phone,
    password:  pass,
    type,
    balance:   0,       // Solde initial à zéro
    pin:       '123456', // PIN par défaut (l'utilisateur peut le changer dans Sécurité)
    createdAt: new Date().toISOString()
  };

  DB.setUsers([...DB.getUsers(), newUser]);
  currentUser = newUser;
  DB.setSession(newUser);
  closeModal('registerModal');
  updateAuthUI();
  toast('✅', 'Compte créé !', 'Bienvenue sur CloudPay, ' + first + ' !', 'success');

  /* Notification de bienvenue */
  DB.addNotif({
    icon:  '🎉',
    title: 'Bienvenue sur CloudPay !',
    body:  'Votre compte a été créé avec succès. Rechargez votre solde pour commencer.',
    type:  'info'
  });

  nav('dashboard');
}

/* ─────────────────────────────────────────────
   DÉCONNEXION
   Supprime la session, remet currentUser à null
   et retourne en mode visiteur.
───────────────────────────────────────────── */
function doLogout() {
  currentUser = null;
  DB.clearSession();
  updateAuthUI();
  toast('👋', 'Déconnecté', 'À bientôt sur CloudPay !', 'info');
  nav('dashboard');
}

/* ─────────────────────────────────────────────
   CONFIRMATION DÉCONNEXION
   Affiche une modale de confirmation avant
   de procéder à la déconnexion.
───────────────────────────────────────────── */
function confirmLogout() {
  showDetailModal('🚪 Déconnexion', `
    <p style="font-size:14px;color:var(--t2);margin-bottom:20px;line-height:1.75;">
      Voulez-vous vous déconnecter ?<br>
      Vos données sont sauvegardées — reconnectez-vous à tout moment.
    </p>
    <div class="g2 gap-8">
      <button class="btn btn-ghost btn-full" onclick="closeModal('detailModal')">Annuler</button>
      <button class="btn btn-red   btn-full" onclick="closeModal('detailModal');doLogout()">🚪 Déconnecter</button>
    </div>`
  );
}

/* ─────────────────────────────────────────────
   GUARD D'AUTHENTIFICATION
   Vérifie qu'un utilisateur est connecté avant
   d'exécuter une action sensible.
   Si non connecté, ouvre la modale de connexion.
   @param {Function} action - Action à exécuter si connecté
───────────────────────────────────────────── */
function requireAuth(action) {
  if (currentUser) {
    action();
    return;
  }
  toast('🔒', 'Connexion requise', 'Créez un compte ou connectez-vous pour effectuer cette action', 'warn');
  openModal('loginModal');
}

/* ─────────────────────────────────────────────
   AFFICHER / MASQUER LE MOT DE PASSE
   Bascule le type d'un champ password entre
   "password" (masqué) et "text" (visible).
   @param {string} id - ID de l'élément input
───────────────────────────────────────────── */
function togglePw(id) {
  const el = document.getElementById(id);
  el.type  = el.type === 'password' ? 'text' : 'password';
}

/* ─────────────────────────────────────────────
   CONNEXION DÉMO RAPIDE
   Remplit automatiquement le formulaire de
   connexion avec les identifiants du compte démo
   et lance la connexion immédiatement.
───────────────────────────────────────────── */
function fillDemo() {
  document.getElementById('loginEmail').value = 'demo@cloudpay.ci';
  document.getElementById('loginPass').value  = 'demo1234';
  doLogin();
}

/* ─────────────────────────────────────────────
   SAUVEGARDER LE PROFIL
   Met à jour les informations personnelles
   de l'utilisateur connecté.
───────────────────────────────────────────── */
function saveProfile() {
  const first = document.getElementById('pfFirst')?.value?.trim();
  const last  = document.getElementById('pfLast')?.value?.trim();
  const email = document.getElementById('pfEmail')?.value?.trim();
  const phone = document.getElementById('pfPhone')?.value?.trim();

  if (!first || !last || !email) { toast('⚠️', 'Champs requis', '', 'warn'); return; }

  currentUser = { ...currentUser, firstName: first, lastName: last, email, phone };
  const users = DB.getUsers().map(u => u.id === currentUser.id ? currentUser : u);
  DB.setUsers(users);
  DB.setSession(currentUser);
  updateAuthUI();
  toast('✅', 'Profil mis à jour', '', 'success');
}

/* ─────────────────────────────────────────────
   CHANGER LE CODE PIN
   Valide l'ancien PIN puis enregistre le nouveau.
   Le PIN est utilisé pour confirmer les paiements.
───────────────────────────────────────────── */
function changePin() {
  if (!currentUser) return;
  const old = document.getElementById('oldPin')?.value;
  const np  = document.getElementById('newPin')?.value;
  const cf  = document.getElementById('cPin2')?.value;

  if (old !== currentUser.pin) { toast('❌', 'PIN actuel incorrect', '', 'error'); return; }
  if (np.length !== 6 || !/^\d+$/.test(np)) { toast('⚠️', 'PIN invalide', '6 chiffres numériques requis', 'warn'); return; }
  if (np !== cf) { toast('⚠️', 'Confirmation incorrecte', 'Les deux PIN ne correspondent pas', 'warn'); return; }

  currentUser.pin = np;
  const users = DB.getUsers().map(u => u.id === currentUser.id ? currentUser : u);
  DB.setUsers(users);
  DB.setSession(currentUser);
  toast('✅', 'PIN modifié', 'Votre nouveau PIN est actif', 'success');
}