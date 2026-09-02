// ============================================================
// SolarFix — App shell: navigation, modals, toasts, shared state
// ============================================================

const App = {
  state: {
    session: null,
    profile: null,        // { id, full_name, role, active }
    profiles: [],          // all staff, for dropdowns
    items: [],              // inventory cache
    repairs: [],
    repairParts: [],
    log: [],                 // inventory_log cache
  },
};

// ---------- Toasts ----------
function toast(message, type = "info") {
  const stack = document.getElementById("toastStack");
  const el = document.createElement("div");
  el.className = `toast ${type}`;
  const icons = {
    success: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20 6 9 17l-5-5"/></svg>',
    error: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><path d="M15 9l-6 6M9 9l6 6"/></svg>',
    info: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><path d="M12 16v-4M12 8h.01"/></svg>',
    warn: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 9v4M12 17h.01"/></svg>',
  };
  el.innerHTML = `${icons[type] || icons.info}<div class="tx">${message}</div><button class="tclose">&times;</button>`;
  el.querySelector(".tclose").onclick = () => el.remove();
  stack.appendChild(el);
  setTimeout(() => el.remove(), 5000);
}

// ---------- Modals ----------
function openModal(id) {
  document.getElementById(id).classList.add("open");
}
function closeModal(id) {
  document.getElementById(id).classList.remove("open");
}
document.querySelectorAll("[data-close]").forEach((btn) => {
  btn.addEventListener("click", () => closeModal(btn.dataset.close));
});
document.querySelectorAll(".modal-overlay").forEach((ov) => {
  ov.addEventListener("click", (e) => { if (e.target === ov) ov.classList.remove("open"); });
});

let confirmCallback = null;
function askConfirm(title, body, onConfirm) {
  document.getElementById("confirmTitle").textContent = title;
  document.getElementById("confirmBody").textContent = body;
  confirmCallback = onConfirm;
  openModal("confirmModal");
}
document.getElementById("confirmActionBtn").addEventListener("click", () => {
  if (confirmCallback) confirmCallback();
  closeModal("confirmModal");
});

// ---------- Button loading state ----------
function setBtnLoading(btn, loading, labelWhenDone) {
  if (loading) {
    btn.disabled = true;
    btn.dataset.origLabel = btn.querySelector(".btn-label")?.textContent || btn.textContent;
    const label = btn.querySelector(".btn-label");
    if (label) label.innerHTML = '<span class="spinner"></span>';
  } else {
    btn.disabled = false;
    const label = btn.querySelector(".btn-label");
    if (label) label.textContent = labelWhenDone || btn.dataset.origLabel || "Save";
  }
}

// ---------- Navigation ----------
const VIEW_TITLES = {
  dashboard: "Dashboard",
  inventory: "Inventory",
  repairs: "Repairs",
  reports: "Daily Report",
  staff: "Staff",
};

function goToView(name) {
  document.querySelectorAll(".view").forEach((v) => v.classList.remove("active"));
  document.getElementById(`view-${name}`)?.classList.add("active");
  document.querySelectorAll(".nav-item").forEach((n) => n.classList.toggle("active", n.dataset.view === name));
  document.getElementById("topTitle").textContent = VIEW_TITLES[name] || name;
  closeSidebarMobile();

  if (name === "dashboard") renderDashboard();
  if (name === "inventory") renderInventoryTable();
  if (name === "repairs") renderRepairsKanban();
  if (name === "reports") renderReport();
  if (name === "staff") renderStaffTable();
}

document.querySelectorAll(".nav-item[data-view]").forEach((item) => {
  item.addEventListener("click", () => goToView(item.dataset.view));
});

// ---------- Mobile sidebar ----------
function closeSidebarMobile() {
  document.getElementById("sidebar").classList.remove("open");
  document.getElementById("sidebarScrim").classList.remove("open");
}
document.getElementById("hamburgerBtn").addEventListener("click", () => {
  document.getElementById("sidebar").classList.add("open");
  document.getElementById("sidebarScrim").classList.add("open");
});
document.getElementById("sidebarScrim").addEventListener("click", closeSidebarMobile);

// ---------- Role gating ----------
function roleRank(role) {
  return { worker: 1, secretary: 2, admin: 3 }[role] || 0;
}
function hasRole(minRole) {
  const role = App.state.profile?.role;
  return roleRank(role) >= roleRank(minRole);
}
function applyRoleGates() {
  document.querySelectorAll("[data-role-min]").forEach((el) => {
    el.style.display = hasRole(el.dataset.roleMin) ? "" : "none";
  });
}

// ---------- Date pill ----------
function initTodayPill() {
  const el = document.getElementById("todayPill");
  el.textContent = new Date().toLocaleDateString(undefined, { weekday: "short", year: "numeric", month: "short", day: "numeric" });
}

// ---------- Connection status ----------
function setConnStatus(ok) {
  document.getElementById("connDot").classList.toggle("offline", !ok);
  document.getElementById("connLabel").textContent = ok ? "Connected" : "Offline";
}
window.addEventListener("online", () => setConnStatus(true));
window.addEventListener("offline", () => setConnStatus(false));

// ---------- Small helpers used across modules ----------
function escapeHtml(str) {
  if (str === null || str === undefined) return "";
  return String(str).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}
function fmtDateTime(iso) {
  if (!iso) return "—";
  return new Date(iso).toLocaleString(undefined, { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
}
function fmtDate(iso) {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
}
function initials(name) {
  if (!name) return "?";
  return name.split(" ").map((p) => p[0]).slice(0, 2).join("").toUpperCase();
}
const CATEGORY_COLORS = {
  "Lithium Battery": "#e8a23d",
  "Tubular Battery": "#d68c26",
  "Breaker": "#3b82c4",
  "Panel": "#2f9e64",
  "Inverter": "#1f8a8c",
  "Transformer Base": "#3b6ea5",
  "Surge Protective Device": "#7440bb",
  "Fire Extinguisher": "#d9534f",
  "Other": "#697386",
};

initTodayPill();
