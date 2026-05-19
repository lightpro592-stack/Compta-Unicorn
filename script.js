// ==========================================
// CONFIGURATION RP GLOBALE (Unicorn GTA V)
// ==========================================
const QUOTA_SEUIL = 100000;
const ADMIN_PASSWORD = "lox59200";

const GRADE_PAY_SCALE = {
    "Patron": 0.70, "Co-Patron": 0.70, "DRH": 0.60, "Gérant": 0.55,
    "Danceur/se": 0.45, "Sécurité": 0.40, "Stagiaire": 0.35, "Aucun Grade": 0.00
};

// ==========================================
// BASE DE DONNÉES
// ==========================================
let database = JSON.parse(localStorage.getItem('unicornData')) || {
    employes: [],
    finances: { ajustementCA: 0 },
    catalogue: [],
    partenariats: []
};

let isPatron = false;
let currentVenteIndex = null;
let factureItems = [];

// Session employé connecté
let currentEmployee = null; // objet employé connecté (ou null)

// Migration
if (!database.partenariats) database.partenariats = [];
if (!database.finances) database.finances = { ajustementCA: 0 };
if (database.employes.length === 0) {
    for (let i = 0; i < 25; i++) {
        database.employes.push({ id: i + 1, nom: "Aucun", grade: "Aucun Grade", primes: 0, apportClient: 0, ventes: [], password: "" });
    }
}
database.employes.forEach(emp => {
    if (!emp.ventes) emp.ventes = [];
    if (emp.password === undefined) emp.password = "";
});

function saveData() { localStorage.setItem('unicornData', JSON.stringify(database)); }

// ==========================================
// INITIALISATION
// ==========================================
window.onload = function () {
    isPatron = false;
    currentEmployee = null;
    renderEmployeeTable();
    updateNBEmployes();
    updateDashboard();
    populateSelects();
    renderCatalogue();
    renderCatalogueFacturation();
    renderPartenariatsFacturation();
    renderFactureItems();
    setSecurityMode(false);
    updateNavbarState();
};

// ==========================================
// NAVBAR STATE
// ==========================================
function updateNavbarState() {
    const btnEmp = document.getElementById('btn-nav-employe-compte');
    if (!btnEmp) return;
    if (currentEmployee) {
        btnEmp.innerText = `👤 ${currentEmployee.nom}`;
        btnEmp.style.borderColor = "#7fffd4";
        btnEmp.style.color = "#7fffd4";
    } else {
        btnEmp.innerText = "👤 Espace Employé";
        btnEmp.style.borderColor = "rgba(127,255,212,0.5)";
        btnEmp.style.color = "rgba(127,255,212,0.8)";
    }
}

// ==========================================
// SYSTÈME DE SÉCURITÉ PATRON
// ==========================================
function loginPatron() {
    if (isPatron) {
        isPatron = false;
        setSecurityMode(false);
        return;
    }
    const mdp = prompt("Mot de passe Patron :");
    if (mdp === ADMIN_PASSWORD) {
        isPatron = true;
        currentEmployee = null;
        updateNavbarState();
        setSecurityMode(true);
        alert("✅ Connexion Patron réussie !");
    } else if (mdp !== null) {
        alert("❌ Mot de passe incorrect.");
    }
}

function setSecurityMode(adminMode) {
    const body = document.body;
    const btnNavLogin = document.getElementById('btn-nav-login');
    adminMode ? body.classList.remove('is-employee') : body.classList.add('is-employee');

    if (btnNavLogin) {
        btnNavLogin.innerText = adminMode ? "🔓 Déconnexion Patron" : "🔒 Connexion Patron";
        btnNavLogin.style.borderColor = adminMode ? "#e74c3c" : "#2ecc71";
        btnNavLogin.style.color = adminMode ? "#e74c3c" : "#2ecc71";
    }

    renderEmployeeTable();
    renderCatalogue();
    renderCatalogueFacturation();
    renderPartenariatsFacturation();
    populateBillProduitSelect();
    populateBillPartenariatSelect();
    renderFactureItems();
}

// ==========================================
// SYSTÈME COMPTE EMPLOYÉ
// ==========================================
function openEmployeeLoginModal() {
    if (currentEmployee) {
        // Déjà connecté → ouvrir la fiche perso
        openMyProfileModal();
        return;
    }
    document.getElementById('empLoginError').style.display = 'none';
    document.getElementById('empLoginName').value = '';
    document.getElementById('empLoginPassword').value = '';
    document.getElementById('employeeLoginModal').style.display = 'block';
}

function closeEmployeeLoginModal() {
    document.getElementById('employeeLoginModal').style.display = 'none';
}

function submitEmployeeLogin() {
    const nom = document.getElementById('empLoginName').value.trim();
    const mdp = document.getElementById('empLoginPassword').value;
    const errEl = document.getElementById('empLoginError');

    if (!nom || !mdp) {
        errEl.innerText = "Remplis tous les champs.";
        errEl.style.display = 'block';
        return;
    }

    const emp = database.employes.find(e =>
        e.nom !== "Aucun" &&
        e.nom.toLowerCase() === nom.toLowerCase() &&
        e.password === mdp
    );

    if (!emp) {
        errEl.innerText = "❌ Identifiant ou mot de passe incorrect.";
        errEl.style.display = 'block';
        return;
    }

    currentEmployee = emp;
    closeEmployeeLoginModal();
    updateNavbarState();
    openMyProfileModal();
}

function logoutEmployee() {
    currentEmployee = null;
    updateNavbarState();
    closeMyProfileModal();
}

// ==========================================
// MODAL FICHE PERSONNELLE EMPLOYÉ
// ==========================================
function openMyProfileModal() {
    if (!currentEmployee) return openEmployeeLoginModal();
    renderMyProfile();
    document.getElementById('myProfileModal').style.display = 'block';
}

function closeMyProfileModal() {
    document.getElementById('myProfileModal').style.display = 'none';
}

function renderMyProfile() {
    const emp = database.employes.find(e => e.nom === currentEmployee.nom);
    if (!emp) return;

    const payPercent = GRADE_PAY_SCALE[emp.grade] || 0;
    const salaire = (emp.apportClient * payPercent).toFixed(2);
    const hasQuota = emp.apportClient >= QUOTA_SEUIL;
    const quotaPct = Math.min(100, (emp.apportClient / QUOTA_SEUIL) * 100).toFixed(1);

    const ventesHtml = emp.ventes.length > 0
        ? emp.ventes.slice().reverse().map(v => `
            <tr>
                <td style="padding:6px 10px;border-bottom:1px solid rgba(255,255,255,0.05);">${v.date}</td>
                <td style="padding:6px 10px;border-bottom:1px solid rgba(255,255,255,0.05);">${v.produitNom}</td>
                <td style="padding:6px 10px;border-bottom:1px solid rgba(255,255,255,0.05);text-align:center;">${v.qte}</td>
                <td style="padding:6px 10px;border-bottom:1px solid rgba(255,255,255,0.05);text-align:right;color:var(--unicorn-gold);font-weight:700;">${v.total.toFixed(2)}$</td>
            </tr>
        `).join('')
        : `<tr><td colspan="4" style="padding:12px;text-align:center;color:#666;font-style:italic;">Aucune vente enregistrée.</td></tr>`;

    document.getElementById('myProfileContent').innerHTML = `
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:20px;">
            <div class="profile-stat-card" style="background:rgba(162,89,230,0.15);border:1px solid rgba(162,89,230,0.4);border-radius:10px;padding:14px;text-align:center;">
                <div style="color:#aaa;font-size:0.7rem;text-transform:uppercase;letter-spacing:1px;margin-bottom:4px;">Grade</div>
                <div style="font-size:1.1rem;font-weight:700;color:var(--unicorn-pink);">${emp.grade}</div>
            </div>
            <div class="profile-stat-card" style="background:rgba(255,215,0,0.1);border:1px solid rgba(255,215,0,0.3);border-radius:10px;padding:14px;text-align:center;">
                <div style="color:#aaa;font-size:0.7rem;text-transform:uppercase;letter-spacing:1px;margin-bottom:4px;">% de Paye</div>
                <div style="font-size:1.1rem;font-weight:700;color:var(--unicorn-gold);">${(payPercent * 100).toFixed(0)}%</div>
            </div>
            <div class="profile-stat-card" style="background:rgba(46,204,113,0.1);border:1px solid rgba(46,204,113,0.3);border-radius:10px;padding:14px;text-align:center;">
                <div style="color:#aaa;font-size:0.7rem;text-transform:uppercase;letter-spacing:1px;margin-bottom:4px;">Apport Total</div>
                <div style="font-size:1.1rem;font-weight:700;color:#2ecc71;">${emp.apportClient.toFixed(2)}$</div>
            </div>
            <div class="profile-stat-card" style="background:rgba(127,255,212,0.1);border:1px solid rgba(127,255,212,0.3);border-radius:10px;padding:14px;text-align:center;">
                <div style="color:#aaa;font-size:0.7rem;text-transform:uppercase;letter-spacing:1px;margin-bottom:4px;">Salaire Estimé</div>
                <div style="font-size:1.1rem;font-weight:700;color:var(--unicorn-cyan);">${salaire}$</div>
            </div>
        </div>

        <div style="margin-bottom:20px;">
            <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px;">
                <span style="font-size:0.8rem;color:#aaa;text-transform:uppercase;letter-spacing:1px;">Quota Hebdo</span>
                <span style="font-size:0.85rem;font-weight:700;">${hasQuota ? '✅ Atteint !' : `${emp.apportClient.toFixed(0)}$ / ${QUOTA_SEUIL.toLocaleString()}$`}</span>
            </div>
            <div style="background:rgba(255,255,255,0.08);border-radius:20px;height:10px;overflow:hidden;">
                <div style="height:100%;border-radius:20px;background:linear-gradient(90deg,var(--unicorn-purple),var(--unicorn-pink));width:${quotaPct}%;transition:width 0.5s ease;"></div>
            </div>
            <div style="text-align:right;font-size:0.75rem;color:#888;margin-top:4px;">${quotaPct}%</div>
        </div>

        ${emp.primes > 0 ? `<div style="background:rgba(255,215,0,0.08);border:1px solid rgba(255,215,0,0.2);border-radius:8px;padding:10px 14px;margin-bottom:16px;display:flex;justify-content:space-between;align-items:center;">
            <span style="color:#aaa;font-size:0.85rem;">🎁 Primes</span>
            <span style="color:var(--unicorn-gold);font-weight:700;">${emp.primes.toFixed(2)}$</span>
        </div>` : ''}

        <div>
            <h4 style="color:var(--unicorn-pink);font-family:'Rajdhani',sans-serif;font-size:0.85rem;text-transform:uppercase;letter-spacing:1px;margin:0 0 10px;">📋 Historique des Ventes</h4>
            <div style="background:rgba(0,0,0,0.2);border-radius:8px;overflow:hidden;max-height:200px;overflow-y:auto;">
                <table style="width:100%;border-collapse:collapse;font-size:0.82rem;">
                    <thead>
                        <tr style="background:rgba(0,0,0,0.3);">
                            <th style="padding:7px 10px;text-align:left;color:var(--unicorn-gold);font-size:0.7rem;text-transform:uppercase;">Date</th>
                            <th style="padding:7px 10px;text-align:left;color:var(--unicorn-gold);font-size:0.7rem;text-transform:uppercase;">Produit</th>
                            <th style="padding:7px 10px;text-align:center;color:var(--unicorn-gold);font-size:0.7rem;text-transform:uppercase;">Qté</th>
                            <th style="padding:7px 10px;text-align:right;color:var(--unicorn-gold);font-size:0.7rem;text-transform:uppercase;">Total</th>
                        </tr>
                    </thead>
                    <tbody>${ventesHtml}</tbody>
                </table>
            </div>
        </div>

        <div style="margin-top:18px;padding-top:16px;border-top:1px solid rgba(255,255,255,0.08);text-align:center;">
            <button onclick="logoutEmployee()" style="background:rgba(231,76,60,0.2);border:1px solid var(--rp-red);color:var(--rp-red);padding:8px 24px;border-radius:6px;cursor:pointer;font-family:'Rajdhani',sans-serif;font-weight:700;font-size:0.9rem;transition:0.2s;" onmouseover="this.style.background='rgba(231,76,60,0.4)'" onmouseout="this.style.background='rgba(231,76,60,0.2)'">🚪 Se déconnecter</button>
        </div>
    `;
}

// ==========================================
// GESTION MOT DE PASSE EMPLOYÉ (Patron)
// ==========================================
function openSetPasswordModal(index) {
    if (!isPatron) return alert("Action réservée au Patron.");
    const emp = database.employes[index];
    if (emp.nom === "Aucun") return alert("Aucun employé sur ce poste.");
    document.getElementById('setPasswordEmpNom').innerText = emp.nom;
    document.getElementById('setPasswordEmpIndex').value = index;
    document.getElementById('setPasswordInput').value = emp.password || '';
    document.getElementById('setPasswordModal').style.display = 'block';
}

function closeSetPasswordModal() {
    document.getElementById('setPasswordModal').style.display = 'none';
}

function submitSetPassword() {
    const index = parseInt(document.getElementById('setPasswordEmpIndex').value);
    const mdp = document.getElementById('setPasswordInput').value.trim();
    if (!mdp) return alert("Mot de passe vide !");
    database.employes[index].password = mdp;
    saveData();
    closeSetPasswordModal();
    renderEmployeeTable();
    alert(`✅ Mot de passe défini pour ${database.employes[index].nom}`);
}

// ==========================================
// NAVIGATION
// ==========================================
function showPage(pageId) {
    document.querySelectorAll('.page').forEach(p => p.style.display = 'none');
    document.querySelectorAll('.nav-links button').forEach(b => b.classList.remove('active'));
    const page = document.getElementById('page-' + pageId);
    if (page) page.style.display = 'block';
    const btn = document.getElementById('btn-nav-' + pageId);
    if (btn) btn.classList.add('active');
}

// ==========================================
// CATALOGUE PRODUITS
// ==========================================
function openProductModal() {
    if (!isPatron) return alert("Action réservée au Patron.");
    renderProductModalList();
    document.getElementById('productModal').style.display = "block";
}

function closeProductModal() {
    document.getElementById('productModal').style.display = "none";
    renderCatalogue();
    renderCatalogueFacturation();
    populateBillProduitSelect();
    populateVenteProduitSelect();
}

function addProduct() {
    if (!isPatron) return;
    const nom = document.getElementById('newProductName').value.trim();
    const prix = parseFloat(document.getElementById('newProductPrice').value) || 0;
    if (!nom) return alert("Nom du produit requis !");
    database.catalogue.push({ id: Date.now(), nom, prix });
    saveData();
    renderProductModalList();
    document.getElementById('newProductName').value = "";
    document.getElementById('newProductPrice').value = "0";
}

function deleteProduct(id) {
    if (!isPatron) return;
    if (confirm("Supprimer ce produit ?")) {
        database.catalogue = database.catalogue.filter(p => p.id !== id);
        saveData();
        renderProductModalList();
    }
}

function renderProductModalList() {
    const el = document.getElementById('productModalList');
    if (!el) return;
    if (database.catalogue.length === 0) {
        el.innerHTML = '<p style="color:#888;text-align:center;padding:10px;">Aucun produit configuré.</p>';
        return;
    }
    el.innerHTML = `<table style="width:100%;border-collapse:collapse;">
        <thead><tr>
            <th style="text-align:left;padding:6px 8px;border-bottom:1px solid #444;color:var(--unicorn-gold);font-size:0.75rem;text-transform:uppercase;">Produit</th>
            <th style="text-align:right;padding:6px 8px;border-bottom:1px solid #444;color:var(--unicorn-gold);font-size:0.75rem;text-transform:uppercase;">Prix</th>
            <th style="padding:6px;border-bottom:1px solid #444;width:40px;"></th>
        </tr></thead>
        <tbody>
            ${database.catalogue.map(p => `
                <tr>
                    <td style="padding:7px 8px;border-bottom:1px solid rgba(255,255,255,0.05);">${p.nom}</td>
                    <td style="padding:7px 8px;border-bottom:1px solid rgba(255,255,255,0.05);text-align:right;color:var(--unicorn-gold);font-weight:700;">${p.prix.toFixed(2)}$</td>
                    <td style="padding:7px 8px;border-bottom:1px solid rgba(255,255,255,0.05);text-align:center;">
                        <button onclick="deleteProduct(${p.id})" style="background:var(--rp-red);border:none;color:white;border-radius:3px;cursor:pointer;padding:2px 8px;">✕</button>
                    </td>
                </tr>
            `).join('')}
        </tbody>
    </table>`;
}

function renderCatalogue() {
    const el = document.getElementById('catalogueList');
    if (!el) return;
    if (database.catalogue.length === 0) {
        el.innerHTML = '<p style="color:#888;font-size:0.85rem;text-align:center;">Aucun produit configuré.</p>';
        return;
    }
    el.innerHTML = database.catalogue.map(p =>
        `<div class="catalogue-item"><span class="catalogue-nom">${p.nom}</span><span class="catalogue-prix">${p.prix.toFixed(2)}$</span></div>`
    ).join('');
}

function renderCatalogueFacturation() {
    const el = document.getElementById('facturationCatalogueList');
    if (!el) return;
    if (database.catalogue.length === 0) {
        el.innerHTML = '<p style="color:#888;font-size:0.85rem;">Aucun produit.</p>';
        return;
    }
    el.innerHTML = database.catalogue.map(p =>
        `<div class="catalogue-item"><span class="catalogue-nom">${p.nom}</span><span class="catalogue-prix">${p.prix.toFixed(2)}$</span></div>`
    ).join('');
}

// ==========================================
// PARTENARIATS
// ==========================================
function openPartenariatModal() {
    if (!isPatron) return alert("Action réservée au Patron.");
    renderPartenariatModalList();
    document.getElementById('partenariatModal').style.display = "block";
}

function closePartenariatModal() {
    document.getElementById('partenariatModal').style.display = "none";
    renderPartenariatsFacturation();
    populateBillPartenariatSelect();
}

function addPartenariat() {
    if (!isPatron) return;
    const nom = document.getElementById('newPartNom').value.trim();
    const pct = parseFloat(document.getElementById('newPartPct').value) || 0;
    if (!nom) return alert("Nom du partenariat requis !");
    if (pct < 0 || pct > 100) return alert("Le % doit être entre 0 et 100 !");
    database.partenariats.push({ id: Date.now(), nom, reduction: pct / 100 });
    saveData();
    renderPartenariatModalList();
    document.getElementById('newPartNom').value = "";
    document.getElementById('newPartPct').value = "0";
}

function deletePartenariat(id) {
    if (!isPatron) return;
    if (confirm("Supprimer ce partenariat ?")) {
        database.partenariats = database.partenariats.filter(p => p.id !== id);
        saveData();
        renderPartenariatModalList();
    }
}

function renderPartenariatModalList() {
    const el = document.getElementById('partenariatModalList');
    if (!el) return;
    if (database.partenariats.length === 0) {
        el.innerHTML = '<p style="color:#888;text-align:center;padding:10px;">Aucun partenariat configuré.</p>';
        return;
    }
    el.innerHTML = `<table style="width:100%;border-collapse:collapse;">
        <thead><tr>
            <th style="text-align:left;padding:6px 8px;border-bottom:1px solid #444;color:var(--unicorn-gold);font-size:0.75rem;text-transform:uppercase;">Partenariat</th>
            <th style="text-align:center;padding:6px 8px;border-bottom:1px solid #444;color:var(--unicorn-gold);font-size:0.75rem;text-transform:uppercase;">Réduction</th>
            <th style="padding:6px;border-bottom:1px solid #444;width:40px;"></th>
        </tr></thead>
        <tbody>
            ${database.partenariats.map(p => `
                <tr>
                    <td style="padding:7px 8px;border-bottom:1px solid rgba(255,255,255,0.05);">${p.nom}</td>
                    <td style="padding:7px 8px;border-bottom:1px solid rgba(255,255,255,0.05);text-align:center;color:var(--unicorn-cyan);font-weight:700;">${(p.reduction * 100).toFixed(0)}%</td>
                    <td style="padding:7px 8px;border-bottom:1px solid rgba(255,255,255,0.05);text-align:center;">
                        <button onclick="deletePartenariat(${p.id})" style="background:var(--rp-red);border:none;color:white;border-radius:3px;cursor:pointer;padding:2px 8px;">✕</button>
                    </td>
                </tr>
            `).join('')}
        </tbody>
    </table>`;
}

function renderPartenariatsFacturation() {
    const el = document.getElementById('facturationPartenariatList');
    if (!el) return;
    if (database.partenariats.length === 0) {
        el.innerHTML = '<p style="color:#888;font-size:0.85rem;">Aucun partenariat.</p>';
        return;
    }
    el.innerHTML = database.partenariats.map(p =>
        `<div class="catalogue-item">
            <span class="catalogue-nom">${p.nom}</span>
            <span class="catalogue-prix" style="color:var(--unicorn-cyan);">-${(p.reduction * 100).toFixed(0)}%</span>
        </div>`
    ).join('');
}

function populateBillPartenariatSelect() {
    const s = document.getElementById('billPartenariatSelect');
    if (!s) return;
    s.innerHTML = '<option value="">— Aucun partenariat —</option>' +
        database.partenariats.map(p =>
            `<option value="${p.id}">${p.nom} (-${(p.reduction * 100).toFixed(0)}%)</option>`
        ).join('');
    calculateFactureTotal();
}

// ==========================================
// FACTURATION — PANIER MULTI-PRODUITS
// ==========================================
function populateBillProduitSelect() {
    const s = document.getElementById('billProduitSelect');
    if (!s) return;
    s.innerHTML = '<option value="">— Choisir un produit —</option>' +
        database.catalogue.map(p =>
            `<option value="${p.id}" data-prix="${p.prix}">${p.nom} (${p.prix.toFixed(2)}$)</option>`
        ).join('');
}

function onProduitChange() {
    const s = document.getElementById('billProduitSelect');
    const sel = s?.options[s.selectedIndex];
    const prix = parseFloat(sel?.dataset?.prix) || 0;
    const montantInput = document.getElementById('billMontant');
    if (montantInput) montantInput.value = prix.toFixed(2);
    calculateFactureTotal();
}

function calculateFactureTotal() {
    const sousTotalPanier = factureItems.reduce((sum, item) => sum + item.sousTotal, 0);
    const partSelect = document.getElementById('billPartenariatSelect');
    const partId = partSelect ? parseInt(partSelect.value) : null;
    const partenariat = database.partenariats.find(p => p.id === partId);
    const reduction = partenariat ? partenariat.reduction : 0;
    const totalFinal = sousTotalPanier * (1 - reduction);

    const totalEl = document.getElementById('billTotalAffiche');
    if (totalEl) totalEl.innerText = totalFinal.toFixed(2);

    const reductLabel = document.getElementById('billReductionLabel');
    if (reductLabel) {
        reductLabel.style.display = reduction > 0 ? 'block' : 'none';
        reductLabel.innerText = reduction > 0
            ? `🏷️ Réduction ${partenariat.nom} : -${(reduction * 100).toFixed(0)}% (sous-total: ${sousTotalPanier.toFixed(2)}$)`
            : '';
    }
}

function addItemToFacture() {
    const produitSelect = document.getElementById('billProduitSelect');
    const sel = produitSelect?.options[produitSelect.selectedIndex];
    const montant = parseFloat(document.getElementById('billMontant').value) || 0;
    const qte = parseInt(document.getElementById('billQuantite').value) || 1;

    if (!sel || !sel.value) return alert("Sélectionnez un produit !");
    if (montant <= 0) return alert("Prix unitaire invalide !");
    if (qte <= 0) return alert("Quantité invalide !");

    const produitNom = sel.text.split(' (')[0];
    const sousTotal = montant * qte;

    factureItems.push({ produitNom, prixUnitaire: montant, qte, sousTotal });
    renderFactureItems();
    calculateFactureTotal();

    produitSelect.value = "";
    document.getElementById('billMontant').value = "0";
    document.getElementById('billQuantite').value = "1";
}

function removeFactureItem(index) {
    factureItems.splice(index, 1);
    renderFactureItems();
    calculateFactureTotal();
}

function renderFactureItems() {
    const el = document.getElementById('factureItemsTable');
    if (!el) return;

    if (factureItems.length === 0) {
        el.innerHTML = `<tr><td colspan="5" class="panier-empty">Aucun produit ajouté — utilisez le formulaire ci-dessus.</td></tr>`;
        return;
    }

    el.innerHTML = factureItems.map((item, i) => `
        <tr>
            <td style="padding:8px 10px;">${item.produitNom}</td>
            <td style="padding:8px 10px;text-align:center;">${item.prixUnitaire.toFixed(2)}$</td>
            <td style="padding:8px 10px;text-align:center;">${item.qte}</td>
            <td style="padding:8px 10px;text-align:right;color:var(--unicorn-gold);font-weight:700;">${item.sousTotal.toFixed(2)}$</td>
            <td style="padding:8px 10px;text-align:center;">
                <button onclick="removeFactureItem(${i})" style="background:var(--rp-red);border:none;color:white;border-radius:4px;cursor:pointer;padding:3px 10px;font-size:0.85rem;">✕</button>
            </td>
        </tr>
    `).join('');
}

function clearFacture() {
    factureItems = [];
    renderFactureItems();
    document.getElementById('billEmployeSelect').value = "";
    document.getElementById('billProduitSelect').value = "";
    document.getElementById('billMontant').value = "0";
    document.getElementById('billQuantite').value = "1";
    document.getElementById('billPartenariatSelect').value = "";
    calculateFactureTotal();
}

function processFacture() {
    const chauffeurNom = document.getElementById('billEmployeSelect').value;
    if (!chauffeurNom) return alert("Sélectionnez un chauffeur !");
    if (factureItems.length === 0) return alert("Ajoutez au moins un produit à la facture !");

    const partSelect = document.getElementById('billPartenariatSelect');
    const partId = partSelect ? parseInt(partSelect.value) : null;
    const partenariat = database.partenariats.find(p => p.id === partId);
    const reduction = partenariat ? partenariat.reduction : 0;
    const sousTotalPanier = factureItems.reduce((sum, item) => sum + item.sousTotal, 0);
    const totalFinal = sousTotalPanier * (1 - reduction);

    const recap = factureItems.map(i => `• ${i.qte}x ${i.produitNom} = ${i.sousTotal.toFixed(2)}$`).join('\n');
    const reductStr = reduction > 0 ? `\n🏷️ Réduction ${partenariat.nom}: -${(reduction * 100).toFixed(0)}%` : '';
    if (!confirm(`Facture pour ${chauffeurNom} :\n\n${recap}${reductStr}\n\n💰 TOTAL : ${totalFinal.toFixed(2)}$\n\nConfirmer ?`)) return;

    const emp = database.employes.find(e => e.nom === chauffeurNom);
    if (!emp) return;

    factureItems.forEach(item => {
        const totalItem = item.sousTotal * (1 - reduction);
        emp.ventes.push({ produitNom: item.produitNom, prix: item.prixUnitaire, qte: item.qte, total: totalItem, date: new Date().toLocaleDateString('fr-FR') });
        sendToGoogleSheet(chauffeurNom, item.produitNom, item.qte, totalItem.toFixed(2));
    });

    emp.apportClient += totalFinal;
    saveData();
    renderEmployeeTable();
    updateDashboard();
    clearFacture();
    alert(`✅ Facture enregistrée ! Total : ${totalFinal.toFixed(2)}$`);
}

// ==========================================
// MODAL VENTE (depuis tableau employés)
// ==========================================
function openVenteModal(index) {
    currentVenteIndex = index;
    const emp = database.employes[index];
    document.getElementById('venteEmpNom').innerText = `👤 ${emp.nom}`;
    populateVenteProduitSelect();
    document.getElementById('venteModal').style.display = "block";
}

function closeVenteModal() {
    document.getElementById('venteModal').style.display = "none";
    currentVenteIndex = null;
}

function populateVenteProduitSelect() {
    const s = document.getElementById('venteProduitSelect');
    if (!s) return;
    s.innerHTML = '<option value="">— Choisir un produit —</option>' +
        database.catalogue.map(p => `<option value="${p.id}" data-prix="${p.prix}">${p.nom} (${p.prix.toFixed(2)}$)</option>`).join('');
    document.getElementById('ventePrix').value = "0";
}

function onVenteProduitChange() {
    const s = document.getElementById('venteProduitSelect');
    const sel = s?.options[s.selectedIndex];
    document.getElementById('ventePrix').value = (parseFloat(sel?.dataset?.prix) || 0).toFixed(2);
}

function submitVente() {
    const s = document.getElementById('venteProduitSelect');
    const sel = s?.options[s.selectedIndex];
    if (!sel || !sel.value) return alert("Sélectionnez un produit !");
    const produit = database.catalogue.find(p => p.id === parseInt(sel.value));
    if (!produit) return;
    const prix = parseFloat(document.getElementById('ventePrix').value) || 0;
    const qte = parseInt(document.getElementById('venteQuantite').value) || 1;
    const total = prix * qte;
    const emp = database.employes[currentVenteIndex];
    emp.ventes.push({ produitNom: produit.nom, prix, qte, total, date: new Date().toLocaleDateString('fr-FR') });
    emp.apportClient += total;
    sendToGoogleSheet(emp.nom, produit.nom, qte, total.toFixed(2));
    saveData(); renderEmployeeTable(); updateDashboard(); closeVenteModal();
    alert(`✅ ${qte}x ${produit.nom} = ${total.toFixed(2)}$ enregistré !`);
}

// ==========================================
// GESTION EMPLOYÉS
// ==========================================
function openRecruitModal() {
    if (!isPatron) return alert("Action réservée au Patron.");
    document.getElementById('recruitModal').style.display = "block";
}
function closeRecruitModal() { document.getElementById('recruitModal').style.display = "none"; }

function submitRecruitment() {
    const name = document.getElementById('newEmpName').value.trim();
    const grade = document.getElementById('newEmpGrade').value;
    const password = document.getElementById('newEmpPassword').value.trim();
    if (!name || name === "Aucun") return alert("Nom invalide !");
    if (!password) return alert("Mot de passe requis pour le compte employé !");
    const idx = database.employes.findIndex(e => e.nom === "Aucun");
    if (idx !== -1) {
        database.employes[idx] = { id: database.employes[idx].id, nom: name, grade, primes: 0, apportClient: 0, ventes: [], password };
        saveData(); renderEmployeeTable(); updateNBEmployes(); populateSelects(); closeRecruitModal();
        document.getElementById('newEmpName').value = "";
        document.getElementById('newEmpPassword').value = "";
    } else alert("L'entreprise est complète (25/25).");
}

function fireEmployee(index) {
    if (!isPatron) return alert("Action réservée au Patron.");
    if (confirm(`Licencier ${database.employes[index].nom} ?`)) {
        database.employes[index] = { id: index + 1, nom: "Aucun", grade: "Aucun Grade", primes: 0, apportClient: 0, ventes: [], password: "" };
        saveData(); renderEmployeeTable(); updateNBEmployes(); updateDashboard(); populateSelects();
    }
}

function renderEmployeeTable() {
    const tbody = document.getElementById('employeeTableBody');
    if (!tbody) return;
    tbody.innerHTML = '';
    database.employes.forEach((emp, index) => {
        const isActive = emp.nom !== "Aucun";
        const payPercent = GRADE_PAY_SCALE[emp.grade] || 0;
        const salaireAmt = emp.apportClient * payPercent;
        const hasReachedQuota = emp.apportClient >= QUOTA_SEUIL;
        const disabledAttr = isPatron ? "" : "disabled";
        const ventesSummary = (emp.ventes || []).length > 0
            ? emp.ventes.map(v => `${v.qte}x ${v.produitNom}`).join(', ')
            : '—';
        const hasPassword = emp.password && emp.password.length > 0;

        const tr = document.createElement('tr');
        tr.className = isActive ? 'row-active' : 'row-inactive';
        tr.innerHTML = `
            <td>
                <select ${disabledAttr} onchange="handleUIUpdate(${index}, 'grade', this.value)">
                    ${Object.keys(GRADE_PAY_SCALE).map(g => `<option value="${g}" ${g === emp.grade ? 'selected' : ''}>${g}</option>`).join('')}
                </select>
            </td>
            <td>
                <div style="display:flex;align-items:center;gap:6px;">
                    <input type="text" ${disabledAttr} value="${emp.nom}" onchange="handleUIUpdate(${index}, 'nom', this.value)">
                    ${(isActive && isPatron) ? `<button onclick="fireEmployee(${index})" style="background:none;border:none;cursor:pointer;font-size:1rem;" title="Licencier">❌</button>` : ''}
                </div>
            </td>
            <td>${(payPercent * 100).toFixed(0)}%</td>
            <td>${salaireAmt.toFixed(2)}$</td>
            <td>
                <div style="display:flex;align-items:center;gap:6px;">
                    <span style="font-size:0.8rem;color:#ccc;flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;" title="${ventesSummary}">${ventesSummary}</span>
                    ${isActive ? `<button class="btn-vente-emp" onclick="openVenteModal(${index})" style="background:var(--unicorn-purple);border:none;color:white;border-radius:4px;cursor:pointer;padding:3px 8px;font-size:0.75rem;white-space:nowrap;">+ Vente</button>` : ''}
                </div>
            </td>
            <td class="quota-cell">${isActive ? (hasReachedQuota ? '✅ Fait' : '⏳ En cours') : '—'}</td>
            <td><input type="number" ${disabledAttr} value="${emp.primes}" onchange="handleUIUpdate(${index}, 'primes', this.value)"></td>
            <td><strong>${emp.apportClient.toFixed(2)}$</strong></td>
            <td style="text-align:center;">
                ${isActive && isPatron ? `<button onclick="openSetPasswordModal(${index})" style="background:${hasPassword ? 'rgba(127,255,212,0.15)' : 'rgba(255,100,100,0.15)'};border:1px solid ${hasPassword ? 'var(--unicorn-cyan)' : '#e74c3c'};color:${hasPassword ? 'var(--unicorn-cyan)' : '#e74c3c'};border-radius:4px;cursor:pointer;padding:3px 8px;font-size:0.75rem;white-space:nowrap;" title="${hasPassword ? 'Modifier le mot de passe' : 'Définir un mot de passe'}">${hasPassword ? '🔑 MDP' : '⚠️ MDP'}</button>` : isActive ? `<span style="font-size:0.75rem;color:${hasPassword ? 'var(--unicorn-cyan)' : '#666'};">${hasPassword ? '🔑' : '—'}</span>` : '—'}
            </td>
        `;
        tbody.appendChild(tr);
    });
}

function handleUIUpdate(index, field, value) {
    if (!isPatron) return;
    const emp = database.employes[index];
    emp[field] = (field === 'primes') ? (parseFloat(value) || 0) : value;
    saveData(); renderEmployeeTable(); updateDashboard();
}

// ==========================================
// GESTION PNJ
// ==========================================
function addPNJToChauffeur() { if (!isPatron) return; modifyPNJ(1); }
function removePNJFromChauffeur() { if (!isPatron) return; modifyPNJ(-1); }

function modifyPNJ(sign) {
    const chauffeurNom = document.getElementById('pnjChauffeurSelect').value;
    const montant = (parseFloat(document.getElementById('pnjCount').value) || 0) * sign;
    const emp = database.employes.find(e => e.nom === chauffeurNom);
    if (emp) { emp.apportClient += montant; saveData(); renderEmployeeTable(); updateDashboard(); }
}

// ==========================================
// DASHBOARD (sans impôts)
// ==========================================
function updateDashboard() {
    const caReel = database.employes.reduce((sum, emp) => sum + emp.apportClient, 0);
    const caTotal = caReel + (database.finances.ajustementCA || 0);
    const masseSalariale = database.employes.reduce((sum, emp) =>
        sum + (emp.apportClient * (GRADE_PAY_SCALE[emp.grade] || 0)), 0);
    const totalPrimes = database.employes.reduce((sum, emp) => sum + (parseFloat(emp.primes) || 0), 0);
    const beneficeNet = caTotal - masseSalariale - totalPrimes;

    const els = { 'totalCA': caTotal, 'totalMasseSalariale': masseSalariale, 'totalPrimes': totalPrimes, 'beneficeNet': beneficeNet };
    for (const [id, value] of Object.entries(els)) {
        const el = document.getElementById(id);
        if (el) el.innerText = value.toFixed(2);
    }
}

function updateCAManuellement() {
    if (!isPatron) return;
    const val = prompt("Montant total du CA souhaité :");
    if (val !== null) {
        const caReel = database.employes.reduce((sum, emp) => sum + emp.apportClient, 0);
        database.finances.ajustementCA = parseFloat(val) - caReel;
        saveData(); updateDashboard();
    }
}

function resetAjustementCA() {
    if (!isPatron) return;
    database.finances.ajustementCA = 0;
    saveData(); updateDashboard();
}

// ==========================================
// GOOGLE SHEET
// ==========================================
async function sendToGoogleSheet(chauffeur, produit, qte, somme) {
    const url = "https://script.google.com/macros/s/AKfycbw1C6gVrTGnmf4osfGBgpF-6KhoRIpfdnlLpAE5zgwu4aM7QatM6k0GGw4kR681sh1W1A/exec";
    try {
        await fetch(url, { method: "POST", mode: "no-cors", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ chauffeur, produit, qte, somme }) });
    } catch (e) { console.error("Erreur Google Sheet", e); }
}

// ==========================================
// UTILITAIRES
// ==========================================
function resetGlobalData() {
    if (!isPatron) return alert("Action réservée au Patron.");
    if (confirm("🚨 RESET SEMAINE ? Toutes les ventes et apports seront remis à zéro.")) {
        database.employes.forEach(emp => { emp.primes = 0; emp.apportClient = 0; emp.ventes = []; });
        database.finances.ajustementCA = 0;
        saveData(); renderEmployeeTable(); updateDashboard();
    }
}

function populateSelects() {
    const actifs = database.employes.filter(e => e.nom !== "Aucun");
    ['billEmployeSelect', 'pnjChauffeurSelect'].forEach(id => {
        const s = document.getElementById(id);
        if (!s) return;
        s.innerHTML = '<option value="">Sélectionner...</option>' +
            actifs.map(e => `<option value="${e.nom}">${e.nom}</option>`).join('');
    });
    populateBillProduitSelect();
    populateBillPartenariatSelect();
}

function updateNBEmployes() {
    const count = database.employes.filter(e => e.nom !== "Aucun").length;
    const el = document.getElementById('nbEmployes');
    if (el) el.innerText = count;
}
