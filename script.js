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
if (!database.stocks) database.stocks = {}; // { "Rhum": 10, "Coca": 20, ... }
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
    // Migration recettes si absent
    if (!database.recettes) {
        database.recettes = JSON.parse(JSON.stringify(RECETTES_DEFAULT));
        saveData();
    }
    renderEmployeeTable();
    updateNBEmployes();
    updateDashboard();
    populateSelects();
    renderCatalogue();
    renderCatalogueFacturation();
    renderPartenariatsFacturation();
    renderFactureItems();
    renderRecettesPage();
    renderEmployePartenariats();
    renderStocksPage();
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
    renderRecettesPage();
    renderStocksPage();
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
    if (pageId === 'recettes') renderRecettesPage();
    if (pageId === 'stocks') renderStocksPage();
    if (pageId === 'facturation') {
        if (!isPatron && !currentEmployee) {
            // Revenir sur la page employes et alerter
            document.querySelectorAll('.page').forEach(p => p.style.display = 'none');
            document.getElementById('page-employes').style.display = 'block';
            document.querySelectorAll('.nav-links button').forEach(b => b.classList.remove('active'));
            document.getElementById('btn-nav-employes').classList.add('active');
            alert("🔒 Connecte-toi à ton compte employé pour accéder à la facturation.");
            return;
        }
        autoSelectEmployeeInFacture();
    }
}

function autoSelectEmployeeInFacture() {
    const select = document.getElementById('billEmployeSelect');
    const montantInput = document.getElementById('billMontant');
    if (!select) return;
    if (currentEmployee && !isPatron) {
        // Forcer son propre nom, verrouiller
        select.value = currentEmployee.nom;
        select.disabled = true;
        select.style.opacity = '0.85';
        select.style.cursor = 'not-allowed';
        select.style.borderColor = 'rgba(127,255,212,0.5)';
        // Prix géré via billPrixDisplay (champ caché pour non-patron)
    } else if (!isPatron && !currentEmployee) {
        select.disabled = true;
        select.style.opacity = '0.4';
        select.style.cursor = 'not-allowed';
    } else {
        // Patron : tout libre
        select.disabled = false;
        select.style.opacity = '';
        select.style.cursor = '';
        select.style.borderColor = '';

    }
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
    // Catalogue employés = toutes les recettes avec leur prix
    const recettes = database.recettes || [];
    if (recettes.length === 0) {
        el.innerHTML = '<p style="color:#888;font-size:0.85rem;text-align:center;">Aucune recette configurée.</p>';
        return;
    }
    el.innerHTML = recettes.map(r => {
        const prod = database.catalogue.find(c => c.nom.toLowerCase() === r.nom.toLowerCase());
        const prix = prod ? prod.prix.toFixed(2) + '$' : '—';
        return `<div class="catalogue-item"><span class="catalogue-nom">${r.nom}</span><span class="catalogue-prix">${prix}</span></div>`;
    }).join('');
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
    // Alimenter depuis les recettes (avec prix du catalogue lié)
    const recettes = database.recettes || [];
    s.innerHTML = '<option value="">— Choisir un produit —</option>' +
        recettes.map(r => {
            const prod = database.catalogue.find(c => c.nom.toLowerCase() === r.nom.toLowerCase());
            const prix = prod ? prod.prix : 0;
            return `<option value="r_${r.id}" data-prix="${prix}">${r.nom} (${prix.toFixed(2)}$)</option>`;
        }).join('');
}

function onProduitChange() {
    const s = document.getElementById('billProduitSelect');
    const sel = s?.options[s.selectedIndex];
    const prix = parseFloat(sel?.dataset?.prix) || 0;
    const montantInput = document.getElementById('billMontant');
    const prixDisplay = document.getElementById('billPrixDisplay');
    if (montantInput) {
        montantInput.value = prix.toFixed(2);
    }
    if (prixDisplay) prixDisplay.innerText = prix.toFixed(2) + '$';
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
    const qte = parseInt(document.getElementById('billQuantite').value) || 1;

    if (!sel || !sel.value) return alert("Sélectionnez un produit !");
    if (qte <= 0) return alert("Quantité invalide !");

    // Prix : toujours depuis le data-prix du select (non modifiable par l'employé)
    const montant = isPatron
        ? (parseFloat(document.getElementById('billMontant').value) || 0)
        : (parseFloat(sel.dataset.prix) || 0);

    if (montant <= 0) return alert("Prix unitaire invalide ! Définis le prix dans la page Recettes.");

    // Résoudre nom depuis recette
    const recetteId = parseInt(sel.value.replace('r_', ''));
    const recette = (database.recettes || []).find(r => r.id === recetteId);
    const produitNom = recette ? recette.nom : sel.text.split(' (')[0];
    const sousTotal = montant * qte;

    factureItems.push({ produitNom, prixUnitaire: montant, qte, sousTotal });
    renderFactureItems();
    calculateFactureTotal();

    produitSelect.value = "";
    document.getElementById('billMontant').value = "0";
    const prixDisplay = document.getElementById('billPrixDisplay');
    if (prixDisplay) prixDisplay.innerText = '—';
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
    const pd = document.getElementById('billPrixDisplay');
    if (pd) pd.innerText = '—';
    document.getElementById('billQuantite').value = "1";
    document.getElementById('billPartenariatSelect').value = "";
    calculateFactureTotal();
}

function processFacture() {
    if (!isPatron && !currentEmployee) return alert("🔒 Tu dois te connecter à ton compte employé pour valider une facture.");
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
        deductStocksForSale(item.produitNom, item.qte);
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
    if (!isPatron && !currentEmployee) return alert("🔒 Tu dois te connecter à ton compte employé pour enregistrer une vente.");
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
    const recettes = database.recettes || [];
    s.innerHTML = '<option value="">— Choisir un produit —</option>' +
        recettes.map(r => {
            const prod = database.catalogue.find(c => c.nom.toLowerCase() === r.nom.toLowerCase());
            const prix = prod ? prod.prix : 0;
            return `<option value="r_${r.id}" data-prix="${prix}">${r.nom} (${prix.toFixed(2)}$)</option>`;
        }).join('');
    const prixInput = document.getElementById('ventePrix');
    prixInput.value = "0";
    if (!isPatron) {
        prixInput.readOnly = true;
        prixInput.style.opacity = '0.7';
        prixInput.style.cursor = 'not-allowed';
    } else {
        prixInput.readOnly = false;
        prixInput.style.opacity = '';
        prixInput.style.cursor = '';
    }
}

function onVenteProduitChange() {
    const s = document.getElementById('venteProduitSelect');
    const sel = s?.options[s.selectedIndex];
    const prixInput = document.getElementById('ventePrix');
    prixInput.value = (parseFloat(sel?.dataset?.prix) || 0).toFixed(2);
    if (!isPatron) {
        prixInput.readOnly = true;
        prixInput.style.opacity = '0.7';
        prixInput.style.cursor = 'not-allowed';
        prixInput.style.borderColor = 'rgba(162,89,230,0.2)';
    }
}

function submitVente() {
    const s = document.getElementById('venteProduitSelect');
    const sel = s?.options[s.selectedIndex];
    if (!sel || !sel.value) return alert("Sélectionnez un produit !");
    // Résoudre depuis recettes (valeur = r_ID)
    const recetteId = parseInt(sel.value.replace('r_', ''));
    const recette = (database.recettes || []).find(r => r.id === recetteId);
    const produitNom = recette ? recette.nom : sel.text.split(' (')[0];
    const prix = parseFloat(document.getElementById('ventePrix').value) || 0;
    const qte = parseInt(document.getElementById('venteQuantite').value) || 1;
    const total = prix * qte;
    const emp = database.employes[currentVenteIndex];
    emp.ventes.push({ produitNom, prix, qte, total, date: new Date().toLocaleDateString('fr-FR') });
    emp.apportClient += total;
    deductStocksForSale(produitNom, qte);
    sendToGoogleSheet(emp.nom, produitNom, qte, total.toFixed(2));
    saveData(); renderEmployeeTable(); updateDashboard(); closeVenteModal();
    alert(`✅ ${qte}x ${produitNom} = ${total.toFixed(2)}$ enregistré !`);
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
                    ${isActive && emp.ventes.length > 0 ? `<button onclick="openVentesDetailModal(${index})" style="background:rgba(162,89,230,0.2);border:1px solid rgba(162,89,230,0.5);color:var(--unicorn-purple);border-radius:4px;cursor:pointer;padding:3px 10px;font-size:0.75rem;white-space:nowrap;font-family:'Rajdhani',sans-serif;font-weight:700;">📊 ${emp.ventes.length} vente${emp.ventes.length > 1 ? 's' : ''}</button>` : isActive ? '<span style="color:#555;font-size:0.8rem;">—</span>' : ''}
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
// MODAL DÉTAIL VENTES EMPLOYÉ
// ==========================================
function openVentesDetailModal(index) {
    const emp = database.employes[index];
    document.getElementById('ventesDetailNom').innerText = emp.nom;

    // Agréger les ventes par produit
    const agregat = {};
    (emp.ventes || []).forEach(v => {
        if (!agregat[v.produitNom]) agregat[v.produitNom] = { qte: 0, total: 0 };
        agregat[v.produitNom].qte += v.qte;
        agregat[v.produitNom].total += v.total;
    });

    const rows = Object.entries(agregat);
    const totalGlobal = rows.reduce((s, [, d]) => s + d.total, 0);

    const el = document.getElementById('ventesDetailContent');
    el.innerHTML = rows.length === 0
        ? '<p style="text-align:center;color:#666;font-style:italic;padding:20px;">Aucune vente.</p>'
        : `
        <div style="display:flex;flex-direction:column;gap:8px;margin-bottom:16px;">
            ${rows.map(([nom, data]) => `
                <div style="display:flex;align-items:center;gap:10px;padding:10px 14px;background:rgba(255,255,255,0.04);border-radius:8px;border-left:3px solid var(--unicorn-purple);">
                    <span style="font-size:1.1rem;">🍹</span>
                    <span style="flex:1;font-weight:600;font-size:0.95rem;">${nom}</span>
                    <span style="background:rgba(162,89,230,0.25);color:var(--unicorn-cyan);font-weight:700;font-family:'Rajdhani',sans-serif;padding:2px 10px;border-radius:20px;font-size:0.9rem;">x${data.qte}</span>
                    <span style="color:var(--unicorn-gold);font-weight:700;font-family:'Rajdhani',sans-serif;min-width:80px;text-align:right;">${data.total.toFixed(2)}$</span>
                </div>
            `).join('')}
        </div>
        <div style="display:flex;justify-content:space-between;align-items:center;padding:12px 14px;background:rgba(255,215,0,0.08);border:1px solid rgba(255,215,0,0.25);border-radius:8px;">
            <span style="font-weight:700;text-transform:uppercase;letter-spacing:1px;font-size:0.8rem;color:#aaa;">Total général</span>
            <span style="color:var(--unicorn-gold);font-weight:700;font-family:'Rajdhani',sans-serif;font-size:1.2rem;">${totalGlobal.toFixed(2)}$</span>
        </div>`;

    document.getElementById('ventesDetailModal').style.display = 'block';
}

function closeVentesDetailModal() {
    document.getElementById('ventesDetailModal').style.display = 'none';
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
        saveData(); renderEmployeeTable(); updateDashboard(); renderStocksPage();
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
    if (currentEmployee) autoSelectEmployeeInFacture();
}

function updateNBEmployes() {
    const count = database.employes.filter(e => e.nom !== "Aucun").length;
    const el = document.getElementById('nbEmployes');
    if (el) el.innerText = count;
}

// ==========================================
// RECETTES — DONNÉES PAR DÉFAUT
// ==========================================
const RECETTES_DEFAULT = [
    {
        id: 1, nom: "Vodka-Jus de fruits",
        ingredients: [
            { nom: "Jus de fruits", qte: 1 },
            { nom: "Vodka", qte: 1 },
            { nom: "Ice", qte: 1 }
        ]
    },
    {
        id: 2, nom: "Shooter",
        ingredients: [
            { nom: "Menthe", qte: 1 },
            { nom: "Vodka", qte: 1 }
        ]
    },
    {
        id: 3, nom: "Sex and the beach",
        ingredients: [
            { nom: "Jus de cranberry", qte: 1 },
            { nom: "Schnapps à la pêche", qte: 1 },
            { nom: "Vodka", qte: 1 },
            { nom: "Ice", qte: 1 },
            { nom: "Jus de fruits", qte: 1 }
        ]
    },
    {
        id: 4, nom: "Rhum-Cola",
        ingredients: [
            { nom: "Rhum", qte: 1 },
            { nom: "Ice", qte: 1 },
            { nom: "eCola", qte: 1 }
        ]
    },
    {
        id: 5, nom: "Mojito",
        ingredients: [
            { nom: "Rhum", qte: 1 },
            { nom: "Sucre", qte: 1 },
            { nom: "Menthe", qte: 1 },
            { nom: "Citron", qte: 1 },
            { nom: "Ice", qte: 1 }
        ]
    },
    {
        id: 6, nom: "Mètre de shooter",
        ingredients: [
            { nom: "Jus de fruits", qte: 5 },
            { nom: "Vodka", qte: 5 },
            { nom: "Ice", qte: 1 },
            { nom: "Liqueur", qte: 5 }
        ]
    },
    {
        id: 7, nom: "Vodka-Energisante",
        ingredients: [
            { nom: "Vodka", qte: 1 },
            { nom: "Boisson énergisante", qte: 1 },
            { nom: "Ice", qte: 1 }
        ]
    },
    {
        id: 8, nom: "Rhum-Jus de fruits",
        ingredients: [
            { nom: "Rhum", qte: 1 },
            { nom: "Ice", qte: 1 },
            { nom: "Jus de fruits", qte: 1 }
        ]
    },
    {
        id: 9, nom: "Tequila",
        ingredients: [
            { nom: "Ice", qte: 1 },
            { nom: "Citron", qte: 1 },
            { nom: "Agave", qte: 1 }
        ]
    },
    {
        id: 10, nom: "Teq'paf",
        ingredients: [
            { nom: "Citron", qte: 1 },
            { nom: "Tequila", qte: 1 },
            { nom: "Sel", qte: 1 }
        ]
    }
];

// Migration recettes dans la base
if (!database.recettes) {
    database.recettes = JSON.parse(JSON.stringify(RECETTES_DEFAULT));
    saveData();
}

// ==========================================
// PAGE STOCKS
// ==========================================

function getStockKey(nom) {
    return nom.trim().toLowerCase();
}

function ensureStocksExist() {
    // Initialise les ingrédients absents à 0
    (database.recettes || []).forEach(r => {
        r.ingredients.forEach(ing => {
            const key = getStockKey(ing.nom);
            if (database.stocks[key] === undefined) database.stocks[key] = 0;
        });
    });
}

function renderStocksPage() {
    ensureStocksExist();
    renderStocksIngredients();
    renderStocksVentes();
}

function renderStocksIngredients() {
    const el = document.getElementById('stocksIngredientsList');
    if (!el) return;

    // Regrouper tous les ingrédients uniques de toutes les recettes
    const ingrMap = {}; // key -> nom affiché
    (database.recettes || []).forEach(r => {
        r.ingredients.forEach(ing => {
            const key = getStockKey(ing.nom);
            if (!ingrMap[key]) ingrMap[key] = ing.nom;
        });
    });

    const keys = Object.keys(ingrMap).sort((a, b) => ingrMap[a].localeCompare(ingrMap[b]));
    if (keys.length === 0) {
        el.innerHTML = '<p style="color:#666;font-style:italic;font-size:0.85rem;padding:10px;">Aucun ingrédient trouvé. Créez des recettes d\'abord.</p>';
        return;
    }

    let alertCount = 0;
    el.innerHTML = keys.map(key => {
        const qte = database.stocks[key] || 0;
        const nomAffiche = ingrMap[key];
        const isLow = qte <= 3;
        const isEmpty = qte === 0;
        if (isLow) alertCount++;

        const statusClass = isEmpty ? 'stock-empty' : isLow ? 'stock-low' : 'stock-ok';
        const statusDot = isEmpty ? '🔴' : isLow ? '🟡' : '🟢';

        return `
        <div class="stock-row ${statusClass}">
            <span class="stock-dot">${statusDot}</span>
            <span class="stock-ingr-nom">${nomAffiche}</span>
            <div class="stock-controls">
                ${isPatron ? `<button onclick="changeStock('${key}', -1)" class="stock-btn stock-btn-minus">−</button>` : ''}
                <span class="stock-qte">${qte}</span>
                ${isPatron ? `<button onclick="changeStock('${key}', 1)" class="stock-btn stock-btn-plus">+</button>` : ''}
                ${isPatron ? `<input type="number" min="0" value="${qte}" class="stock-input" onchange="setStock('${key}', this.value)" title="Modifier manuellement">` : ''}
            </div>
        </div>`;
    }).join('');

    // Badge alertes
    const badge = document.getElementById('stocksAlertBadge');
    if (badge) {
        badge.textContent = alertCount > 0 ? `⚠️ ${alertCount} stock${alertCount > 1 ? 's' : ''} bas` : '';
        badge.style.color = alertCount > 0 ? 'var(--unicorn-gold)' : '';
    }
}

function renderStocksVentes() {
    const el = document.getElementById('stocksVentesList');
    if (!el) return;

    if (!database.recettes || database.recettes.length === 0) {
        el.innerHTML = '<p style="color:#666;font-style:italic;font-size:0.85rem;padding:10px;">Aucune recette.</p>';
        return;
    }

    // Compter les ventes par recette (toutes semaines)
    const ventesParRecette = {};
    (database.employes || []).forEach(emp => {
        (emp.ventes || []).forEach(v => {
            const key = v.produitNom.trim().toLowerCase();
            ventesParRecette[key] = (ventesParRecette[key] || 0) + (v.qte || 1);
        });
    });

    // Trier par nb ventes décroissant
    const recettes = [...(database.recettes || [])].sort((a, b) => {
        const ka = a.nom.trim().toLowerCase();
        const kb = b.nom.trim().toLowerCase();
        return (ventesParRecette[kb] || 0) - (ventesParRecette[ka] || 0);
    });

    el.innerHTML = recettes.map((r, i) => {
        const key = r.nom.trim().toLowerCase();
        const nb = ventesParRecette[key] || 0;
        const EMOJIS_LIST = ["🥃","🍹","🌿","🥤","🌊","📏","⚡","🍊","🌵","🍋","🍸"];
        const emoji = EMOJIS_LIST[i % EMOJIS_LIST.length];
        const barW = nb > 0 ? Math.min(100, Math.round((nb / Math.max(...Object.values(ventesParRecette), 1)) * 100)) : 0;

        return `
        <div class="stock-vente-row">
            <span class="stock-vente-emoji">${emoji}</span>
            <div class="stock-vente-info">
                <div class="stock-vente-nom">${r.nom}</div>
                <div class="stock-vente-bar-wrap">
                    <div class="stock-vente-bar" style="width:${barW}%"></div>
                </div>
            </div>
            <span class="stock-vente-count">${nb} <span style="color:#888;font-size:0.75rem;font-weight:400;">vente${nb !== 1 ? 's' : ''}</span></span>
        </div>`;
    }).join('');
}

function changeStock(key, delta) {
    if (!isPatron) return;
    if (!database.stocks) database.stocks = {};
    database.stocks[key] = Math.max(0, (database.stocks[key] || 0) + delta);
    saveData();
    renderStocksIngredients();
}

function setStock(key, value) {
    if (!isPatron) return;
    if (!database.stocks) database.stocks = {};
    database.stocks[key] = Math.max(0, parseInt(value) || 0);
    saveData();
    renderStocksIngredients();
}

function resetAllStocks() {
    if (!isPatron) return;
    if (!confirm("Réapprovisionner tous les stocks à 50 unités ?")) return;
    ensureStocksExist();
    Object.keys(database.stocks).forEach(k => { database.stocks[k] = 50; });
    saveData();
    renderStocksPage();
}

function deductStocksForSale(produitNom, qte) {
    // Trouve la recette correspondante
    const recette = (database.recettes || []).find(r => r.nom.toLowerCase() === produitNom.toLowerCase());
    if (!recette) return;
    if (!database.stocks) database.stocks = {};
    recette.ingredients.forEach(ing => {
        const key = getStockKey(ing.nom);
        const consume = (ing.qte || 1) * qte;
        database.stocks[key] = Math.max(0, (database.stocks[key] || 0) - consume);
    });
}

// ==========================================
// PAGE RECETTES — AFFICHAGE
// ==========================================
function renderRecettesPage() {
    const el = document.getElementById('recettesGrid');
    if (!el) return;

    const EMOJIS = {
        "Vodka-Jus de fruits": "🍹", "Shooter": "🥃", "Sex and the beach": "🌊",
        "Rhum-Cola": "🥤", "Mojito": "🌿", "Mètre de shooter": "📏",
        "Vodka-Energisante": "⚡", "Rhum-Jus de fruits": "🍊", "Tequila": "🌵", "Teq'paf": "🍋"
    };
    const COLORS = [
        "rgba(255,105,180,0.15)", "rgba(162,89,230,0.15)", "rgba(127,255,212,0.12)",
        "rgba(255,215,0,0.1)", "rgba(46,204,113,0.12)", "rgba(231,76,60,0.12)",
        "rgba(52,152,219,0.15)", "rgba(230,126,34,0.12)", "rgba(155,89,182,0.15)", "rgba(26,188,156,0.12)"
    ];
    const BORDER_COLORS = [
        "rgba(255,105,180,0.4)", "rgba(162,89,230,0.4)", "rgba(127,255,212,0.3)",
        "rgba(255,215,0,0.3)", "rgba(46,204,113,0.3)", "rgba(231,76,60,0.3)",
        "rgba(52,152,219,0.35)", "rgba(230,126,34,0.3)", "rgba(155,89,182,0.4)", "rgba(26,188,156,0.3)"
    ];

    // Trouver le prix du produit catalogue si il existe
    const getPrix = (nom) => {
        const p = database.catalogue.find(c => c.nom.toLowerCase() === nom.toLowerCase());
        return p ? `<span style="color:var(--unicorn-gold);font-weight:700;font-size:0.9rem;">${p.prix.toFixed(2)}$</span>` : '';
    };

    el.innerHTML = database.recettes.map((recette, i) => {
        const emoji = EMOJIS[recette.nom] || "🍸";
        const bg = COLORS[i % COLORS.length];
        const border = BORDER_COLORS[i % BORDER_COLORS.length];
        const prixHtml = getPrix(recette.nom);
        const ingrHtml = recette.ingredients.map(ing =>
            `<div class="recette-ingr">
                <span class="recette-ingr-qte">x${ing.qte}</span>
                <span class="recette-ingr-nom">${ing.nom}</span>
            </div>`
        ).join('');

        const editBtn = isPatron
            ? `<div style="display:flex;gap:6px;">
                <button onclick="openEditRecetteModal(${recette.id})" class="recette-edit-btn">✏️ Modifier</button>
                <button onclick="deleteRecette(${recette.id})" class="recette-delete-btn">🗑️</button>
               </div>`
            : '';

        return `
        <div class="recette-card" style="background:${bg};border-color:${border};">
            <div class="recette-card-header">
                <span class="recette-emoji">${emoji}</span>
                <div>
                    <div class="recette-nom">${recette.nom}</div>
                    ${prixHtml}
                </div>
                ${editBtn}
            </div>
            <div class="recette-ingrs-label">Ingrédients :</div>
            <div class="recette-ingrs">${ingrHtml}</div>
        </div>`;
    }).join('');
}

// ==========================================
// MODAL ÉDITION RECETTE (Patron)
// ==========================================
let editRecetteId = null;

function openEditRecetteModal(id) {
    if (!isPatron) return alert("Action réservée au Patron.");
    editRecetteId = id;
    const recette = database.recettes.find(r => r.id === id);
    if (!recette) return;
    document.getElementById('editRecetteNom').innerText = recette.nom;
    renderEditRecetteIngrs(recette);

    // Prix du produit catalogue lié
    const prod = database.catalogue.find(c => c.nom.toLowerCase() === recette.nom.toLowerCase());
    const prixInput = document.getElementById('editRecettePrix');
    if (prixInput) prixInput.value = prod ? prod.prix : 0;

    document.getElementById('editRecetteModal').style.display = 'block';
}

function closeEditRecetteModal() {
    document.getElementById('editRecetteModal').style.display = 'none';
    editRecetteId = null;
    renderRecettesPage();
}

function deleteRecette(id) {
    if (!isPatron) return;
    const recette = database.recettes.find(r => r.id === id);
    if (!recette) return;
    if (!confirm(`Supprimer la recette "${recette.nom}" ? Cette action est irréversible.`)) return;
    database.recettes = database.recettes.filter(r => r.id !== id);
    // Supprimer aussi du catalogue
    database.catalogue = database.catalogue.filter(c => c.nom.toLowerCase() !== recette.nom.toLowerCase());
    saveData();
    renderRecettesPage();
    renderCatalogue();
    renderCatalogueFacturation();
    populateBillProduitSelect();
    populateVenteProduitSelect();
}

function renderEditRecetteIngrs(recette) {
    const el = document.getElementById('editRecetteIngrs');
    if (!el) return;
    el.innerHTML = recette.ingredients.map((ing, i) => `
        <div class="edit-ingr-row" id="edit-ingr-${i}">
            <input type="number" value="${ing.qte}" min="1" style="width:55px;padding:6px;background:rgba(255,255,255,0.07);color:white;border:1px solid rgba(162,89,230,0.4);border-radius:5px;" onchange="updateIngr(${i}, 'qte', this.value)">
            <input type="text" value="${ing.nom}" style="flex:1;padding:6px;background:rgba(255,255,255,0.07);color:white;border:1px solid rgba(162,89,230,0.4);border-radius:5px;" onchange="updateIngr(${i}, 'nom', this.value)">
            <button onclick="removeIngr(${i})" style="background:var(--rp-red);border:none;color:white;border-radius:4px;cursor:pointer;padding:4px 10px;">✕</button>
        </div>
    `).join('');
}

function updateIngr(index, field, value) {
    const recette = database.recettes.find(r => r.id === editRecetteId);
    if (!recette) return;
    recette.ingredients[index][field] = field === 'qte' ? (parseInt(value) || 1) : value;
}

function removeIngr(index) {
    const recette = database.recettes.find(r => r.id === editRecetteId);
    if (!recette) return;
    recette.ingredients.splice(index, 1);
    renderEditRecetteIngrs(recette);
}

function addIngr() {
    const nom = document.getElementById('newIngrNom').value.trim();
    const qte = parseInt(document.getElementById('newIngrQte').value) || 1;
    if (!nom) return alert("Nom de l'ingrédient requis !");
    const recette = database.recettes.find(r => r.id === editRecetteId);
    if (!recette) return;
    recette.ingredients.push({ nom, qte });
    renderEditRecetteIngrs(recette);
    document.getElementById('newIngrNom').value = '';
    document.getElementById('newIngrQte').value = '1';
}

function saveEditRecette() {
    const prixInput = document.getElementById('editRecettePrix');
    const prix = parseFloat(prixInput?.value) || 0;

    const recette = database.recettes.find(r => r.id === editRecetteId);
    if (recette) {
        let prod = database.catalogue.find(c => c.nom.toLowerCase() === recette.nom.toLowerCase());
        if (prod) {
            prod.prix = prix;
        } else {
            database.catalogue.push({ id: Date.now(), nom: recette.nom, prix });
        }
    }

    saveData();

    // Fermer le modal sans appeler renderRecettesPage (on va tout rafraîchir après)
    document.getElementById('editRecetteModal').style.display = 'none';
    editRecetteId = null;

    // Tout rafraîchir dans le bon ordre
    renderRecettesPage();
    renderCatalogue();
    renderCatalogueFacturation();
    populateBillProduitSelect();
    populateVenteProduitSelect();

    alert("✅ Recette et prix mis à jour !");
}

// ==========================================
// MODAL GESTION PRIX CATALOGUE (Patron)
// ==========================================
function openPrixCatalogueModal() {
    if (!isPatron) return alert("Action réservée au Patron.");
    renderPrixCatalogueModal();
    document.getElementById('prixCatalogueModal').style.display = 'block';
}

function closePrixCatalogueModal() {
    document.getElementById('prixCatalogueModal').style.display = 'none';
    renderCatalogue();
    renderCatalogueFacturation();
    populateBillProduitSelect();
}

function renderPrixCatalogueModal() {
    const el = document.getElementById('prixCatalogueList');
    if (!el) return;
    if (database.catalogue.length === 0) {
        el.innerHTML = '<p style="color:#888;text-align:center;padding:20px;">Aucun produit dans le catalogue.</p>';
        return;
    }
    el.innerHTML = database.catalogue.map(p => `
        <div style="display:flex;align-items:center;gap:10px;padding:8px 0;border-bottom:1px solid rgba(255,255,255,0.06);">
            <span style="flex:1;font-weight:600;">${p.nom}</span>
            <input type="number" value="${p.prix}" step="0.01" min="0"
                style="width:100px;padding:6px 8px;background:rgba(255,255,255,0.07);color:var(--unicorn-gold);border:1px solid rgba(255,215,0,0.3);border-radius:5px;font-family:'Rajdhani',sans-serif;font-size:0.95rem;font-weight:700;text-align:right;"
                onchange="updateCataloguePrix(${p.id}, this.value)">
            <span style="color:#aaa;font-size:0.85rem;">$</span>
        </div>
    `).join('');
}


function updateCataloguePrix(id, value) {
    const prod = database.catalogue.find(p => p.id === id);
    if (prod) prod.prix = parseFloat(value) || 0;
    saveData();
}

// ==========================================
// MODAL NOUVELLE RECETTE (Patron)
// ==========================================
let newRecetteIngrs = [];

function openAddRecetteModal() {
    if (!isPatron) return alert("Action réservée au Patron.");
    newRecetteIngrs = [];
    document.getElementById('newRecetteNom').value = '';
    document.getElementById('newRecettePrix').value = '0';
    document.getElementById('newRecetteIngrNom').value = '';
    document.getElementById('newRecetteIngrQte').value = '1';
    document.getElementById('newRecetteIngrsError').style.display = 'none';
    renderNewRecetteIngrs();
    document.getElementById('addRecetteModal').style.display = 'block';
}

function closeAddRecetteModal() {
    document.getElementById('addRecetteModal').style.display = 'none';
    newRecetteIngrs = [];
}

function renderNewRecetteIngrs() {
    const el = document.getElementById('newRecetteIngrs');
    if (!el) return;
    if (newRecetteIngrs.length === 0) {
        el.innerHTML = '<p style="color:#666;font-size:0.82rem;font-style:italic;padding:4px 0;">Aucun ingrédient ajouté pour l\'instant.</p>';
        return;
    }
    el.innerHTML = newRecetteIngrs.map((ing, i) => `
        <div style="display:flex;gap:8px;align-items:center;background:rgba(255,255,255,0.04);border:1px solid rgba(162,89,230,0.25);border-radius:6px;padding:7px 10px;">
            <input type="number" value="${ing.qte}" min="1"
                style="width:55px;padding:5px;background:rgba(255,255,255,0.07);color:white;border:1px solid rgba(162,89,230,0.4);border-radius:5px;font-family:'Rajdhani',sans-serif;"
                onchange="updateNewRecetteIngr(${i}, 'qte', this.value)">
            <input type="text" value="${ing.nom}"
                style="flex:1;padding:5px;background:rgba(255,255,255,0.07);color:white;border:1px solid rgba(162,89,230,0.4);border-radius:5px;font-family:'Rajdhani',sans-serif;"
                onchange="updateNewRecetteIngr(${i}, 'nom', this.value)">
            <button onclick="removeNewRecetteIngr(${i})"
                style="background:var(--rp-red);border:none;color:white;border-radius:4px;cursor:pointer;padding:4px 10px;font-size:0.85rem;">✕</button>
        </div>
    `).join('');
}

function addNewRecetteIngr() {
    const nom = document.getElementById('newRecetteIngrNom').value.trim();
    const qte = parseInt(document.getElementById('newRecetteIngrQte').value) || 1;
    if (!nom) { document.getElementById('newRecetteIngrNom').focus(); return; }
    newRecetteIngrs.push({ nom, qte });
    renderNewRecetteIngrs();
    document.getElementById('newRecetteIngrNom').value = '';
    document.getElementById('newRecetteIngrQte').value = '1';
    document.getElementById('newRecetteIngrNom').focus();
    document.getElementById('newRecetteIngrsError').style.display = 'none';
}

function updateNewRecetteIngr(index, field, value) {
    if (!newRecetteIngrs[index]) return;
    newRecetteIngrs[index][field] = field === 'qte' ? (parseInt(value) || 1) : value;
}

function removeNewRecetteIngr(index) {
    newRecetteIngrs.splice(index, 1);
    renderNewRecetteIngrs();
}

function submitAddRecette() {
    const nom = document.getElementById('newRecetteNom').value.trim();
    const prix = parseFloat(document.getElementById('newRecettePrix').value) || 0;

    if (!nom) {
        document.getElementById('newRecetteNom').focus();
        return alert("⚠️ Le nom de la recette est requis !");
    }
    if (newRecetteIngrs.length === 0) {
        document.getElementById('newRecetteIngrsError').style.display = 'block';
        return;
    }

    // Vérifier doublon
    const existe = database.recettes.find(r => r.nom.toLowerCase() === nom.toLowerCase());
    if (existe) return alert(`⚠️ Une recette "${nom}" existe déjà !`);

    // Nouvel ID = max existant + 1
    const newId = Math.max(0, ...database.recettes.map(r => r.id)) + 1;
    database.recettes.push({ id: newId, nom, ingredients: [...newRecetteIngrs] });

    // Ajouter ou mettre à jour le prix dans le catalogue
    const prodExistant = database.catalogue.find(c => c.nom.toLowerCase() === nom.toLowerCase());
    if (prodExistant) {
        prodExistant.prix = prix;
    } else {
        database.catalogue.push({ id: Date.now(), nom, prix });
    }

    saveData();
    closeAddRecetteModal();

    // Tout rafraîchir
    renderRecettesPage();
    renderCatalogue();
    renderCatalogueFacturation();
    populateBillProduitSelect();
    populateVenteProduitSelect();

    alert(`✅ Recette "${nom}" créée avec succès !`);
}



// ==========================================
// RACCOURCI STOCKS → NOUVELLE RECETTE
// ==========================================
function openAddRecetteModalFromStocks() {
    if (!isPatron) return alert("Action réservée au Patron.");
    openAddRecetteModal();
}

// ==========================================
// HELPERS COMPO
// ==========================================
function isCompo(produit) {
    // Une compo = article catalogue sans recette associée
    return !(database.recettes || []).some(r => r.nom.toLowerCase() === produit.nom.toLowerCase());
}

function refreshAfterCompoChange() {
    renderCatalogue();
    renderCatalogueFacturation();
    populateBillProduitSelect();
    populateVenteProduitSelect();
}

// ==========================================
// MODAL GESTION COMPOS
// ==========================================
function openAddCompoModal() {
    if (!isPatron) return alert("Action réservée au Patron.");
    document.getElementById('newCompoNom').value = '';
    document.getElementById('newCompoPrix').value = '0';
    renderCompoModalList();
    document.getElementById('addCompoModal').style.display = 'block';
}

function closeAddCompoModal() {
    document.getElementById('addCompoModal').style.display = 'none';
    refreshAfterCompoChange();
}

function renderCompoModalList() {
    const el = document.getElementById('compoModalList');
    if (!el) return;
    const compos = database.catalogue.filter(isCompo);
    if (compos.length === 0) {
        el.innerHTML = '<p style="color:#666;font-style:italic;font-size:0.85rem;padding:12px;text-align:center;">Aucune composition créée pour l\'instant.</p>';
        return;
    }
    el.innerHTML = `<table style="width:100%;border-collapse:collapse;">
        <thead><tr>
            <th style="text-align:left;padding:7px 8px;border-bottom:1px solid #444;color:var(--unicorn-gold);font-size:0.72rem;text-transform:uppercase;">Nom</th>
            <th style="text-align:right;padding:7px 8px;border-bottom:1px solid #444;color:var(--unicorn-gold);font-size:0.72rem;text-transform:uppercase;">Prix</th>
            <th style="padding:6px;border-bottom:1px solid #444;width:90px;"></th>
        </tr></thead>
        <tbody>
            ${compos.map(p => `
                <tr>
                    <td style="padding:8px;border-bottom:1px solid rgba(255,255,255,0.05);font-weight:600;">${p.nom}</td>
                    <td style="padding:8px;border-bottom:1px solid rgba(255,255,255,0.05);text-align:right;color:var(--unicorn-gold);font-weight:700;">${p.prix.toFixed(2)}$</td>
                    <td style="padding:8px;border-bottom:1px solid rgba(255,255,255,0.05);text-align:center;">
                        <div style="display:flex;gap:4px;justify-content:center;">
                            <button onclick="openEditCompoModal(${p.id})" style="background:rgba(127,255,212,0.15);border:1px solid rgba(127,255,212,0.4);color:var(--unicorn-cyan);border-radius:4px;cursor:pointer;padding:3px 9px;font-size:0.8rem;font-family:'Rajdhani',sans-serif;font-weight:700;">✏️</button>
                            <button onclick="deleteCompo(${p.id})" style="background:rgba(231,76,60,0.2);border:1px solid var(--rp-red);color:var(--rp-red);border-radius:4px;cursor:pointer;padding:3px 9px;font-size:0.8rem;">🗑️</button>
                        </div>
                    </td>
                </tr>
            `).join('')}
        </tbody>
    </table>`;
}

function submitAddCompo() {
    const nom = document.getElementById('newCompoNom').value.trim();
    const prix = parseFloat(document.getElementById('newCompoPrix').value) || 0;
    if (!nom) { document.getElementById('newCompoNom').focus(); return alert("⚠️ Le nom est requis !"); }
    const existe = database.catalogue.find(c => c.nom.toLowerCase() === nom.toLowerCase());
    if (existe) return alert(`⚠️ "${nom}" existe déjà dans le catalogue !`);
    database.catalogue.push({ id: Date.now(), nom, prix });
    saveData();
    document.getElementById('newCompoNom').value = '';
    document.getElementById('newCompoPrix').value = '0';
    document.getElementById('newCompoNom').focus();
    renderCompoModalList();
}

function deleteCompo(id) {
    if (!isPatron) return;
    const p = database.catalogue.find(c => c.id === id);
    if (!p) return;
    if (!isCompo(p)) return alert("Ce produit a une recette associée — supprime-le depuis la page Recettes.");
    if (!confirm(`Supprimer la compo "${p.nom}" ?`)) return;
    database.catalogue = database.catalogue.filter(c => c.id !== id);
    saveData();
    renderCompoModalList();
    refreshAfterCompoChange();
}

// ==========================================
// MODAL ÉDITION COMPO
// ==========================================
function openEditCompoModal(id) {
    if (!isPatron) return;
    const p = database.catalogue.find(c => c.id === id);
    if (!p) return;
    document.getElementById('editCompoId').value = id;
    document.getElementById('editCompoNom').value = p.nom;
    document.getElementById('editCompoPrix').value = p.prix;
    document.getElementById('editCompoModal').style.display = 'block';
}

function closeEditCompoModal() {
    document.getElementById('editCompoModal').style.display = 'none';
}

function submitEditCompo() {
    const id = parseInt(document.getElementById('editCompoId').value);
    const nom = document.getElementById('editCompoNom').value.trim();
    const prix = parseFloat(document.getElementById('editCompoPrix').value) || 0;
    if (!nom) { document.getElementById('editCompoNom').focus(); return alert("⚠️ Le nom est requis !"); }

    // Vérifier doublon sur un autre article
    const doublon = database.catalogue.find(c => c.nom.toLowerCase() === nom.toLowerCase() && c.id !== id);
    if (doublon) return alert(`⚠️ "${nom}" existe déjà dans le catalogue !`);

    const p = database.catalogue.find(c => c.id === id);
    if (!p) return;
    p.nom = nom;
    p.prix = prix;
    saveData();

    closeEditCompoModal();
    renderCompoModalList();
    refreshAfterCompoChange();
    alert(`✅ Composition "${nom}" mise à jour !`);
}
