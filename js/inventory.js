// ============================================================
// SolarFix — Inventory: CRUD + low-stock tracking + movement log
// ============================================================

async function loadInventory() {
  const { data, error } = await sb.from("inventory_items").select("*").order("category").order("name");
  if (error) { toast("Could not load inventory: " + error.message, "error"); return; }
  App.state.items = data || [];
  updateLowStockBadge();
}

async function loadRecentLog() {
  const { data, error } = await sb
    .from("inventory_log")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(100);
  if (error) { console.error(error); return; }
  App.state.log = data || [];
}

function updateLowStockBadge() {
  const lowCount = App.state.items.filter((i) => i.quantity <= i.low_stock_threshold).length;
  const badge = document.getElementById("lowStockCount");
  badge.textContent = lowCount;
  badge.style.display = lowCount > 0 ? "inline-flex" : "none";
}

function applyInventoryPermissionGates() {
  const canAdd = hasRole("worker"); // everyone active can add
  const canEdit = hasRole("secretary");
  document.getElementById("addItemBtn").style.display = canAdd ? "" : "none";
}

// ---------- Rendering ----------
function renderInventoryTable() {
  const tbody = document.getElementById("inventoryBody");
  const search = document.getElementById("invSearch").value.trim().toLowerCase();
  const catFilter = document.getElementById("invCategoryFilter").value;
  const stockFilter = document.getElementById("invStockFilter").value;

  let rows = App.state.items.filter((i) => {
    if (catFilter && i.category !== catFilter) return false;
    if (stockFilter === "low" && i.quantity > i.low_stock_threshold) return false;
    if (search) {
      const hay = `${i.name} ${i.spec_1 || ""} ${i.spec_2 || ""} ${i.spec_3 || ""}`.toLowerCase();
      if (!hay.includes(search)) return false;
    }
    return true;
  });

  document.getElementById("inventoryEmpty").style.display = rows.length ? "none" : "block";

  tbody.innerHTML = rows
    .map((i) => {
      const low = i.quantity <= i.low_stock_threshold;
      const color = CATEGORY_COLORS[i.category] || "#697386";
      return `
        <tr class="${low ? "low-stock-row" : ""}" data-id="${i.id}">
          <td><span class="cat-chip"><i style="background:${color}"></i>${escapeHtml(i.category)}</span></td>
          <td>${escapeHtml(i.name)}</td>
          <td class="mono">${escapeHtml(i.spec_1 || "—")}</td>
          <td class="mono">${escapeHtml(i.spec_2 || "—")}${i.spec_3 ? " · " + escapeHtml(i.spec_3) : ""}</td>
          <td class="num">${i.quantity}</td>
          <td>${low ? '<span class="badge badge-low">Low</span>' : '<span class="badge badge-ok">OK</span>'}</td>
          <td class="text-muted">${fmtDateTime(i.updated_at)}</td>
          <td class="row-actions">
            <button class="btn btn-sm btn-icon edit-item-btn" title="Edit">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.1 2.1 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
            </button>
          </td>
        </tr>`;
    })
    .join("");

  tbody.querySelectorAll(".edit-item-btn").forEach((btn) => {
    btn.addEventListener("click", (e) => {
      const id = e.target.closest("tr").dataset.id;
      openItemModal(App.state.items.find((i) => i.id === id));
    });
  });
}

["invSearch", "invCategoryFilter", "invStockFilter"].forEach((id) => {
  document.getElementById(id).addEventListener("input", renderInventoryTable);
  document.getElementById(id).addEventListener("change", renderInventoryTable);
});

// ---------- Add/Edit modal ----------
function openItemModal(item) {
  const form = document.getElementById("itemForm");
  form.reset();
  document.getElementById("itemId").value = item?.id || "";
  document.getElementById("itemModalTitle").textContent = item ? "Edit stock item" : "Add stock item";
  document.getElementById("itemCategory").value = item?.category || "";
  document.getElementById("itemName").value = item?.name || "";
  document.getElementById("itemSpec1").value = item?.spec_1 || "";
  document.getElementById("itemSpec2").value = item?.spec_2 || "";
  document.getElementById("itemSpec3").value = item?.spec_3 || "";
  document.getElementById("itemQty").value = item?.quantity ?? 0;
  document.getElementById("itemThreshold").value = item?.low_stock_threshold ?? 2;
  document.getElementById("itemNotes").value = item?.notes || "";

  const canEdit = hasRole("secretary");
  const canDelete = hasRole("admin");
  const isNew = !item;

  // Workers can create but not edit existing items.
  const fieldsDisabled = !isNew && !canEdit;
  form.querySelectorAll("input, select, textarea").forEach((el) => { el.disabled = fieldsDisabled; });

  document.getElementById("deleteItemBtn").style.display = item && canDelete ? "" : "none";
  document.getElementById("saveItemBtn").style.display = isNew || canEdit ? "" : "none";

  document.getElementById("deleteItemBtn").onclick = () => {
    askConfirm("Delete this item?", `"${item.name}" will be permanently removed from inventory.`, async () => {
      const { error } = await sb.from("inventory_items").delete().eq("id", item.id);
      if (error) { toast("Delete failed: " + error.message, "error"); return; }
      await logMovement(item, "removed", -item.quantity, 0, "Item deleted");
      await loadInventory();
      renderInventoryTable();
      closeModal("itemModal");
      toast("Item deleted.", "success");
    });
  };

  openModal("itemModal");
}

document.getElementById("addItemBtn").addEventListener("click", () => openItemModal(null));

document.getElementById("saveItemBtn").addEventListener("click", async () => {
  const form = document.getElementById("itemForm");
  if (!form.reportValidity()) return;

  const id = document.getElementById("itemId").value;
  const payload = {
    category: document.getElementById("itemCategory").value,
    name: document.getElementById("itemName").value.trim(),
    spec_1: document.getElementById("itemSpec1").value.trim() || null,
    spec_2: document.getElementById("itemSpec2").value.trim() || null,
    spec_3: document.getElementById("itemSpec3").value.trim() || null,
    quantity: parseInt(document.getElementById("itemQty").value, 10),
    low_stock_threshold: parseInt(document.getElementById("itemThreshold").value, 10) || 0,
    notes: document.getElementById("itemNotes").value.trim() || null,
  };

  const btn = document.getElementById("saveItemBtn");
  setBtnLoading(btn, true);

  if (id) {
    const prev = App.state.items.find((i) => i.id === id);
    payload.last_updated_by = App.state.profile.id;
    const { error } = await sb.from("inventory_items").update(payload).eq("id", id);
    setBtnLoading(btn, false, "Save");
    if (error) { toast("Save failed: " + error.message, "error"); return; }
    if (prev && prev.quantity !== payload.quantity) {
      await logMovement({ id, name: payload.name, category: payload.category }, "adjusted", payload.quantity - prev.quantity, payload.quantity, "Manual edit");
    }
    toast("Item updated.", "success");
  } else {
    payload.created_by = App.state.profile.id;
    payload.last_updated_by = App.state.profile.id;
    const { data, error } = await sb.from("inventory_items").insert(payload).select().single();
    setBtnLoading(btn, false, "Save");
    if (error) { toast("Save failed: " + error.message, "error"); return; }
    await logMovement(data, "added", payload.quantity, payload.quantity, "New item added");
    toast("Item added.", "success");
  }

  closeModal("itemModal");
  await loadInventory();
  renderInventoryTable();
  renderDashboard();
}, false);

// ---------- Movement logging ----------
async function logMovement(item, action, quantityChange, resultingQuantity, note) {
  const entry = {
    item_id: item.id || null,
    item_name_snapshot: item.name,
    category: item.category,
    action,
    quantity_change: quantityChange,
    resulting_quantity: resultingQuantity,
    actor_id: App.state.profile.id,
    actor_name_snapshot: App.state.profile.full_name,
    note: note || null,
  };
  const { error } = await sb.from("inventory_log").insert(entry);
  if (error) console.error("log error", error);
  await loadRecentLog();
}

// ---------- Deduct stock (used by repairs.js) ----------
async function deductStock(itemId, qtyUsed, repairTicketNo) {
  const item = App.state.items.find((i) => i.id === itemId);
  if (!item) return { error: "Item not found" };
  const newQty = Math.max(0, item.quantity - qtyUsed);
  const { error } = await sb.from("inventory_items").update({ quantity: newQty, last_updated_by: App.state.profile.id }).eq("id", itemId);
  if (error) return { error: error.message };
  await logMovement(item, "used_in_repair", -qtyUsed, newQty, `Used in repair ${repairTicketNo}`);
  await loadInventory();
  return { error: null };
}
