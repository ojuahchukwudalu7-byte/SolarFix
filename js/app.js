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
  if (name === "inventory") requestAnimationFrame(() => requestAnimationFrame(renderInventoryTable));
  if (name === "repairs") requestAnimationFrame(() => requestAnimationFrame(renderRepairsKanban));
  if (name === "reports") requestAnimationFrame(() => requestAnimationFrame(renderReport));
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

// ---------- Theme (light/dark) ----------
function applyTheme(theme) {
  document.documentElement.setAttribute("data-theme", theme);
  localStorage.setItem("solarfix-theme", theme);
}
function toggleTheme() {
  const current = document.documentElement.getAttribute("data-theme") || "light";
  applyTheme(current === "dark" ? "light" : "dark");
}
function initTheme() {
  const saved = localStorage.getItem("solarfix-theme");
  const prefersDark = window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches;
  applyTheme(saved || (prefersDark ? "dark" : "light"));
  document.getElementById("themeToggleAuth")?.addEventListener("click", toggleTheme);
  document.getElementById("themeToggleApp")?.addEventListener("click", toggleTheme);
}

// ---------- Password show/hide toggles ----------
function initPasswordToggles() {
  document.querySelectorAll(".pw-toggle-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      const input = document.getElementById(btn.dataset.target);
      if (!input) return;
      const showing = input.type === "text";
      input.type = showing ? "password" : "text";
      btn.classList.toggle("showing", !showing);
      btn.title = showing ? "Show password" : "Hide password";
    });
  });
}

// ---------- Share / download a chart as an image ----------
async function shareChart(canvasId, filename) {
  const canvas = document.getElementById(canvasId);
  if (!canvas) return;
  canvas.toBlob(async (blob) => {
    if (!blob) { toast("Could not generate image.", "error"); return; }
    const file = new File([blob], `${filename}.png`, { type: "image/png" });
    if (navigator.share && navigator.canShare && navigator.canShare({ files: [file] })) {
      try {
        await navigator.share({ files: [file], title: "SolarFix chart" });
        return;
      } catch (e) {
        // user cancelled share sheet — fall through to download
        if (e?.name === "AbortError") return;
      }
    }
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${filename}.png`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
    toast("Chart image saved.", "success");
  }, "image/png");
}
function initChartShareButtons() {
  document.body.addEventListener("click", (e) => {
    const btn = e.target.closest(".share-chart-btn");
    if (!btn) return;
    shareChart(btn.dataset.canvas, btn.dataset.filename || "chart");
  });
}

initTodayPill();
initTheme();
initPasswordToggles();
initChartShareButtons();
