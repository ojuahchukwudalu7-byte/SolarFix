// ============================================================
// SolarFix — Dashboard + Daily Report: stats, charts, print
// ============================================================

let movementChart = null;
let categoryChart = null;

function svgIcon(path) {
  return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">${path}</svg>`;
}

// ---------- Dashboard ----------
function renderDashboard() {
  const items = App.state.items;
  const repairs = App.state.repairs;
  const lowStock = items.filter((i) => i.quantity <= i.low_stock_threshold);
  const totalUnits = items.reduce((sum, i) => sum + i.quantity, 0);
  const openRepairs = repairs.filter((r) => !["Collected"].includes(r.status));
  const completedToday = repairs.filter((r) => r.completed_at && isToday(r.completed_at));

  document.getElementById("dashCards").innerHTML = `
    <div class="stat-card accent-info">
      <div class="top-row"><div class="icon">${svgIcon('<path d="M21 8 12 3 3 8v8l9 5 9-5V8z"/>')}</div></div>
      <div class="value">${items.length}</div>
      <div class="label">Item types in stock</div>
    </div>
    <div class="stat-card accent-good">
      <div class="top-row"><div class="icon">${svgIcon('<rect x="3" y="3" width="18" height="18" rx="2"/><path d="M9 9h6v6H9z"/>')}</div></div>
      <div class="value">${totalUnits}</div>
      <div class="label">Total units on hand</div>
    </div>
    <div class="stat-card accent-bad clickable" id="dashLowStockCard">
      <div class="top-row"><div class="icon">${svgIcon('<path d="M12 9v4M12 17h.01"/><circle cx="12" cy="12" r="10"/>')}</div></div>
      <div class="value">${lowStock.length}</div>
      <div class="label">Items low on stock</div>
    </div>
    <div class="stat-card accent-amber">
      <div class="top-row"><div class="icon">${svgIcon('<path d="M14.7 6.3a4 4 0 1 1-5.4 5.4L4 17l3 3 5.3-5.3a4 4 0 0 1 5.4-5.4l-3-3z"/>')}</div></div>
      <div class="value">${openRepairs.length}</div>
      <div class="label">Repairs in progress</div>
    </div>
    <div class="stat-card accent-good">
      <div class="top-row"><div class="icon">${svgIcon('<path d="M20 6 9 17l-5-5"/>')}</div></div>
      <div class="value">${completedToday.length}</div>
      <div class="label">Completed today</div>
    </div>
  `;
  document.getElementById("dashLowStockCard").addEventListener("click", () => {
    goToView("inventory");
    document.getElementById("invStockFilter").value = "low";
    renderInventoryTable();
  });

  document.getElementById("dashActivityBody").innerHTML = App.state.log
    .slice(0, 10)
    .map((l) => `
      <tr>
        <td data-label="When" class="text-muted">${fmtDateTime(l.created_at)}</td>
        <td data-label="Item">${escapeHtml(l.item_name_snapshot)}</td>
        <td data-label="Action">${movementBadge(l.action)}</td>
        <td data-label="Change" class="num">${l.quantity_change > 0 ? "+" : ""}${l.quantity_change}</td>
        <td data-label="By">${escapeHtml(l.actor_name_snapshot)}</td>
      </tr>`)
    .join("") || `<tr><td colspan="5" class="text-muted">No activity yet.</td></tr>`;

  document.getElementById("dashLowStockBody").innerHTML = lowStock
    .map((i) => `<tr><td data-label="Item">${escapeHtml(i.name)}</td><td data-label="Qty" class="num">${i.quantity}</td></tr>`)
    .join("") || `<tr><td colspan="2" class="text-muted">Nothing low right now.</td></tr>`;
}

function movementBadge(action) {
  const map = {
    added: '<span class="badge badge-instock">Added</span>',
    removed: '<span class="badge badge-scrapped">Removed</span>',
    adjusted: '<span class="badge badge-diagnosis">Adjusted</span>',
    used_in_repair: '<span class="badge badge-repair">Used in repair</span>',
  };
  return map[action] || action;
}

function isToday(iso) {
  const d = new Date(iso);
  const now = new Date();
  return d.toDateString() === now.toDateString();
}
function isSameDate(iso, ymd) {
  const d = new Date(iso);
  const target = new Date(ymd + "T00:00:00");
  return d.toDateString() === target.toDateString();
}

// ---------- Daily report ----------
function initReportDate() {
  const input = document.getElementById("reportDate");
  const today = new Date();
  input.value = today.toISOString().slice(0, 10);
  input.addEventListener("change", renderReport);
}

function renderReport() {
  const dateStr = document.getElementById("reportDate").value || new Date().toISOString().slice(0, 10);
  const dayLog = App.state.log.filter((l) => isSameDate(l.created_at, dateStr));
  const added = dayLog.filter((l) => l.quantity_change > 0).reduce((s, l) => s + l.quantity_change, 0);
  const removed = dayLog.filter((l) => l.quantity_change < 0).reduce((s, l) => s + Math.abs(l.quantity_change), 0);
  const repairsToday = App.state.repairs.filter((r) => isSameDate(r.created_at, dateStr));
  const completedToday = App.state.repairs.filter((r) => r.completed_at && isSameDate(r.completed_at, dateStr));
  const reorderList = App.state.items.filter((i) => i.quantity <= i.low_stock_threshold);

  document.getElementById("reportCards").innerHTML = `
    <div class="stat-card accent-good"><div class="value">${added}</div><div class="label">Units added</div></div>
    <div class="stat-card accent-bad"><div class="value">${removed}</div><div class="label">Units removed / used</div></div>
    <div class="stat-card accent-info"><div class="value">${repairsToday.length}</div><div class="label">New repair tickets</div></div>
    <div class="stat-card accent-amber"><div class="value">${completedToday.length}</div><div class="label">Repairs completed</div></div>
    <div class="stat-card accent-bad"><div class="value">${reorderList.length}</div><div class="label">Items to reorder</div></div>
  `;

  // Movement chart
  const ctx1 = document.getElementById("chartMovement").getContext("2d");
  if (movementChart) movementChart.destroy();
  movementChart = new Chart(ctx1, {
    type: "bar",
    data: {
      labels: ["Added", "Removed / Used"],
      datasets: [{ data: [added, removed], backgroundColor: ["#2f9e64", "#d9534f"], borderRadius: 6 }],
    },
    options: {
      responsive: true,
      plugins: { legend: { display: false } },
      scales: { y: { beginAtZero: true, ticks: { precision: 0 } } },
    },
  });

  // Category chart
  const byCat = {};
  App.state.items.forEach((i) => { byCat[i.category] = (byCat[i.category] || 0) + i.quantity; });
  const catLabels = Object.keys(byCat);
  const ctx2 = document.getElementById("chartCategory").getContext("2d");
  if (categoryChart) categoryChart.destroy();
  categoryChart = new Chart(ctx2, {
    type: "pie",
    data: {
      labels: catLabels,
      datasets: [{ data: catLabels.map((c) => byCat[c]), backgroundColor: catLabels.map((c) => CATEGORY_COLORS[c] || "#697386") }],
    },
    options: { responsive: true, plugins: { legend: { position: "bottom", labels: { boxWidth: 10, font: { size: 10.5 } } } } },
  });

  document.getElementById("reportReorderBody").innerHTML = reorderList
    .map((i) => `<tr><td data-label="Category">${escapeHtml(i.category)}</td><td data-label="Item">${escapeHtml(i.name)}</td><td data-label="In stock" class="num">${i.quantity}</td><td data-label="Threshold" class="num">${i.low_stock_threshold}</td></tr>`)
    .join("") || `<tr><td colspan="4" class="text-muted">Nothing needs reordering today.</td></tr>`;

  document.getElementById("reportLogBody").innerHTML = dayLog
    .map((l) => `<tr><td data-label="Time" class="text-muted">${fmtDateTime(l.created_at)}</td><td data-label="Item">${escapeHtml(l.item_name_snapshot)}</td><td data-label="Action">${movementBadge(l.action)}</td><td data-label="Change" class="num">${l.quantity_change > 0 ? "+" : ""}${l.quantity_change}</td><td data-label="By">${escapeHtml(l.actor_name_snapshot)}</td></tr>`)
    .join("") || `<tr><td colspan="5" class="text-muted">No activity logged for this date.</td></tr>`;

  buildPrintReceipt(dateStr, { added, removed, repairsToday, completedToday, reorderList, dayLog });
}

function buildPrintReceipt(dateStr, d) {
  const receipt = document.getElementById("printReceipt");
  receipt.innerHTML = `
    <h2>SolarFix — Daily Report</h2>
    <div class="rmeta">${fmtDate(dateStr + "T00:00:00")} · Prepared by ${escapeHtml(App.state.profile.full_name)}</div>
    <table>
      <tr><th>Units added</th><td>${d.added}</td></tr>
      <tr><th>Units removed / used</th><td>${d.removed}</td></tr>
      <tr><th>New repair tickets</th><td>${d.repairsToday.length}</td></tr>
      <tr><th>Repairs completed</th><td>${d.completedToday.length}</td></tr>
      <tr><th>Items needing reorder</th><td>${d.reorderList.length}</td></tr>
    </table>
    ${d.reorderList.length ? `
      <h3 style="margin-top:16px;">Reorder list</h3>
      <table>
        <tr><th>Category</th><th>Item</th><th>In stock</th><th>Threshold</th></tr>
        ${d.reorderList.map((i) => `<tr><td>${escapeHtml(i.category)}</td><td>${escapeHtml(i.name)}</td><td>${i.quantity}</td><td>${i.low_stock_threshold}</td></tr>`).join("")}
      </table>` : ""}
    <h3 style="margin-top:16px;">Activity log</h3>
    <table>
      <tr><th>Time</th><th>Item</th><th>Action</th><th>Change</th><th>By</th></tr>
      ${d.dayLog.map((l) => `<tr><td>${fmtDateTime(l.created_at)}</td><td>${escapeHtml(l.item_name_snapshot)}</td><td>${l.action}</td><td>${l.quantity_change}</td><td>${escapeHtml(l.actor_name_snapshot)}</td></tr>`).join("") || `<tr><td colspan="5">No activity.</td></tr>`}
    </table>
  `;
}

document.getElementById("printReportBtn").addEventListener("click", () => window.print());

initReportDate();
