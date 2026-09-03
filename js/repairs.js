// ============================================================
// SolarFix — Repairs: kanban board + ticket detail + parts used
// ============================================================

const REPAIR_STATUSES = [
  "Received", "Diagnosis", "Awaiting Approval", "Repair In Progress",
  "Waiting Parts", "Testing", "Completed", "Ready for Collection", "Collected",
];
const STATUS_BADGE_CLASS = {
  "Received": "badge-received",
  "Diagnosis": "badge-diagnosis",
  "Awaiting Approval": "badge-approval",
  "Repair In Progress": "badge-repair",
  "Waiting Parts": "badge-waitparts",
  "Testing": "badge-testing",
  "Completed": "badge-completed",
  "Ready for Collection": "badge-ready",
  "Collected": "badge-collected",
};

async function loadRepairs() {
  const { data: repairs, error } = await sb.from("repairs").select("*").order("created_at", { ascending: false });
  if (error) { toast("Could not load repairs: " + error.message, "error"); return; }
  App.state.repairs = repairs || [];

  const { data: parts } = await sb.from("repair_parts").select("*");
  App.state.repairParts = parts || [];
}

async function loadAllProfiles() {
  const { data, error } = await sb.from("profiles").select("*").order("full_name");
  if (error) { console.error(error); return; }
  App.state.profiles = data || [];

  const sel = document.getElementById("repAssigned");
  sel.innerHTML = '<option value="">Unassigned</option>' + App.state.profiles.map((p) => `<option value="${p.id}">${escapeHtml(p.full_name)}</option>`).join("");
}

// ---------- Kanban rendering ----------
function renderRepairsKanban() {
  const board = document.getElementById("repairsKanban");
  board.innerHTML = REPAIR_STATUSES.map((status) => {
    const items = App.state.repairs.filter((r) => r.status === status);
    return `
      <div class="kanban-col">
        <h4><span>${escapeHtml(status)}</span><span class="pill">${items.length}</span></h4>
        ${items.map((r) => `
          <div class="kanban-card" data-id="${r.id}">
            <div class="kc-id">${escapeHtml(r.ticket_no)}</div>
            <div class="kc-title">${escapeHtml(r.customer_name)}</div>
            <div class="kc-meta">${escapeHtml(r.device_description || "")}</div>
          </div>
        `).join("")}
      </div>`;
  }).join("");

  board.querySelectorAll(".kanban-card").forEach((card) => {
    card.addEventListener("click", () => {
      const repair = App.state.repairs.find((r) => r.id === card.dataset.id);
      openRepairModal(repair);
    });
  });

  renderRepairsCharts();
}

let repStatusChart = null;
let repTechChart = null;

function renderRepairsCharts() {
  const canvas1 = document.getElementById("repChartStatus");
  const canvas2 = document.getElementById("repChartTech");
  if (!canvas1 || !canvas2) return;

  const statusCounts = REPAIR_STATUSES.map((s) => App.state.repairs.filter((r) => r.status === s).length);
  const statusColors = ["#3b82c4", "#3b82c4", "#e8a23d", "#e8a23d", "#b45f12", "#146a72", "#2f9e64", "#3355c4", "#2f9e64"];

  if (repStatusChart) repStatusChart.destroy();
  repStatusChart = new Chart(canvas1.getContext("2d"), {
    type: "bar",
    data: {
      labels: REPAIR_STATUSES,
      datasets: [{ data: statusCounts, backgroundColor: statusColors, borderRadius: 6 }],
    },
    options: {
      responsive: true,
      indexAxis: "y",
      plugins: { legend: { display: false } },
      scales: { x: { beginAtZero: true, ticks: { precision: 0 } }, y: { ticks: { font: { size: 10 } } } },
    },
  });

  const byTech = {};
  App.state.repairs.forEach((r) => {
    const tech = App.state.profiles.find((p) => p.id === r.assigned_to);
    const label = tech ? tech.full_name : "Unassigned";
    byTech[label] = (byTech[label] || 0) + 1;
  });
  const techLabels = Object.keys(byTech);
  const palette = ["#e8a23d", "#3b82c4", "#2f9e64", "#1f8a8c", "#7440bb", "#d9534f", "#3b6ea5", "#d68c26"];

  if (repTechChart) repTechChart.destroy();
  repTechChart = new Chart(canvas2.getContext("2d"), {
    type: "pie",
    data: {
      labels: techLabels,
      datasets: [{ data: techLabels.map((t) => byTech[t]), backgroundColor: techLabels.map((_, idx) => palette[idx % palette.length]) }],
    },
    options: { responsive: true, plugins: { legend: { position: "bottom", labels: { boxWidth: 10, font: { size: 10.5 } } } } },
  });
}

// ---------- Modal: add/edit repair ----------
let currentPartLines = []; // { item_id, quantity_used }

function openRepairModal(repair) {
  const form = document.getElementById("repairForm");
  form.reset();
  document.getElementById("repairId").value = repair?.id || "";
  document.getElementById("repairModalTitle").textContent = repair ? `Ticket ${repair.ticket_no}` : "New repair ticket";
  document.getElementById("repCustomerName").value = repair?.customer_name || "";
  document.getElementById("repCustomerPhone").value = repair?.customer_phone || "";
  document.getElementById("repDevice").value = repair?.device_description || "";
  document.getElementById("repIssue").value = repair?.issue_description || "";
  document.getElementById("repStatus").value = repair?.status || "Received";
  document.getElementById("repAssigned").value = repair?.assigned_to || "";
  document.getElementById("repLabor").value = repair?.labor_cost || "";

  currentPartLines = repair
    ? App.state.repairParts.filter((p) => p.repair_id === repair.id).map((p) => ({ item_id: p.item_id, quantity_used: p.quantity_used, _existing: true }))
    : [];
  renderPartLines();

  openModal("repairModal");
}

document.getElementById("addRepairBtn").addEventListener("click", () => openRepairModal(null));

function renderPartLines() {
  const wrap = document.getElementById("partsUsedList");
  if (!currentPartLines.length) {
    wrap.innerHTML = '<p class="locked-note">No parts added yet.</p>';
    return;
  }
  wrap.innerHTML = currentPartLines
    .map((line, idx) => {
      const options = App.state.items
        .map((i) => `<option value="${i.id}" ${line.item_id === i.id ? "selected" : ""}>${escapeHtml(i.name)} (${i.quantity} in stock)</option>`)
        .join("");
      return `
        <div class="parts-used-row" data-idx="${idx}">
          <select class="part-item-select"><option value="">Select item…</option>${options}</select>
          <input type="number" class="part-qty-input" min="1" value="${line.quantity_used || 1}">
          <span class="line-total text-muted">in stock: ${App.state.items.find((i) => i.id === line.item_id)?.quantity ?? "—"}</span>
          <span></span>
          <button type="button" class="remove-line">&times;</button>
        </div>`;
    })
    .join("");

  wrap.querySelectorAll(".remove-line").forEach((btn) => {
    btn.addEventListener("click", (e) => {
      const idx = parseInt(e.target.closest(".parts-used-row").dataset.idx, 10);
      currentPartLines.splice(idx, 1);
      renderPartLines();
    });
  });
  wrap.querySelectorAll(".part-item-select").forEach((sel) => {
    sel.addEventListener("change", (e) => {
      const idx = parseInt(e.target.closest(".parts-used-row").dataset.idx, 10);
      currentPartLines[idx].item_id = e.target.value;
      renderPartLines();
    });
  });
  wrap.querySelectorAll(".part-qty-input").forEach((inp) => {
    inp.addEventListener("input", (e) => {
      const idx = parseInt(e.target.closest(".parts-used-row").dataset.idx, 10);
      currentPartLines[idx].quantity_used = parseInt(e.target.value, 10) || 1;
    });
  });
}

document.getElementById("addPartLineBtn").addEventListener("click", () => {
  currentPartLines.push({ item_id: "", quantity_used: 1 });
  renderPartLines();
});

function generateTicketNo() {
  const n = App.state.repairs.length + 1;
  return "R-" + String(n).padStart(4, "0") + "-" + Math.random().toString(36).slice(2, 4).toUpperCase();
}

document.getElementById("saveRepairBtn").addEventListener("click", async () => {
  const form = document.getElementById("repairForm");
  if (!form.reportValidity()) return;

  const id = document.getElementById("repairId").value;
  const status = document.getElementById("repStatus").value;
  const payload = {
    customer_name: document.getElementById("repCustomerName").value.trim(),
    customer_phone: document.getElementById("repCustomerPhone").value.trim() || null,
    device_description: document.getElementById("repDevice").value.trim(),
    issue_description: document.getElementById("repIssue").value.trim(),
    status,
    assigned_to: document.getElementById("repAssigned").value || null,
    labor_cost: parseFloat(document.getElementById("repLabor").value) || 0,
  };
  if (status === "Completed" || status === "Ready for Collection" || status === "Collected") {
    payload.completed_at = payload.completed_at || new Date().toISOString();
  }

  const btn = document.getElementById("saveRepairBtn");
  setBtnLoading(btn, true);

  let repairId = id;
  if (id) {
    const { error } = await sb.from("repairs").update(payload).eq("id", id);
    if (error) { setBtnLoading(btn, false, "Save ticket"); toast("Save failed: " + error.message, "error"); return; }
  } else {
    payload.ticket_no = generateTicketNo();
    payload.created_by = App.state.profile.id;
    const { data, error } = await sb.from("repairs").insert(payload).select().single();
    if (error) { setBtnLoading(btn, false, "Save ticket"); toast("Save failed: " + error.message, "error"); return; }
    repairId = data.id;
  }

  // Handle new part lines (only ones not already saved) — deduct stock for each.
  const newLines = currentPartLines.filter((l) => l.item_id && l.quantity_used > 0 && !l._existing);
  for (const line of newLines) {
    const item = App.state.items.find((i) => i.id === line.item_id);
    if (!item) continue;
    await sb.from("repair_parts").insert({
      repair_id: repairId,
      item_id: line.item_id,
      item_name_snapshot: item.name,
      quantity_used: line.quantity_used,
    });
    await deductStock(line.item_id, line.quantity_used, payload.ticket_no || id);
  }

  setBtnLoading(btn, false, "Save ticket");
  closeModal("repairModal");
  await loadRepairs();
  renderRepairsKanban();
  renderInventoryTable();
  renderDashboard();
  toast(id ? "Ticket updated." : "Ticket created.", "success");
});
