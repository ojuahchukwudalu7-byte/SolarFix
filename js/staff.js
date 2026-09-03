// ============================================================
// SolarFix — Staff: admin-only account management
// ============================================================

function applyStaffPermissionGates() {
  document.getElementById("addStaffBtn").style.display = hasRole("admin") ? "" : "none";
}

function renderStaffTable() {
  const tbody = document.getElementById("staffBody");
  tbody.innerHTML = App.state.profiles
    .map((p) => `
      <tr data-id="${p.id}">
        <td data-label="Name">${escapeHtml(p.full_name)}${p.id === App.state.profile.id ? ' <span class="text-muted">(you)</span>' : ""}</td>
        <td data-label="Role"><span class="badge badge-role-${p.role}">${escapeHtml(p.role)}</span></td>
        <td data-label="Status">${p.active ? '<span class="badge badge-active">Active</span>' : '<span class="badge badge-onleave">Deactivated</span>'}</td>
        <td class="row-actions">
          <button class="btn btn-sm edit-staff-btn" ${!hasRole("admin") ? "disabled" : ""}>Edit</button>
        </td>
      </tr>`)
    .join("");

  tbody.querySelectorAll(".edit-staff-btn").forEach((btn) => {
    btn.addEventListener("click", (e) => {
      const id = e.target.closest("tr").dataset.id;
      openStaffModal(App.state.profiles.find((p) => p.id === id), true);
    });
  });
}

function openStaffModal(profile, isEdit) {
  const form = document.getElementById("staffForm");
  form.reset();
  document.getElementById("staffModalError").classList.remove("show");
  document.getElementById("staffId").value = profile?.id || "";
  document.getElementById("staffModalTitle").textContent = isEdit ? "Edit staff member" : "Add staff member";
  document.getElementById("staffName").value = profile?.full_name || "";
  document.getElementById("staffRole").value = profile?.role || "worker";
  document.getElementById("staffActive").value = String(profile?.active ?? true);

  // Email/password are only set at creation time (Supabase Auth manages
  // password changes separately) — hide those fields when editing.
  document.getElementById("staffEmailField").style.display = isEdit ? "none" : "";
  document.getElementById("staffPasswordField").style.display = isEdit ? "none" : "";
  document.getElementById("staffEmail").required = !isEdit;
  document.getElementById("staffPassword").required = !isEdit;

  openModal("staffModal");
}

document.getElementById("addStaffBtn").addEventListener("click", () => openStaffModal(null, false));

document.getElementById("saveStaffBtn").addEventListener("click", async () => {
  const form = document.getElementById("staffForm");
  if (!form.reportValidity()) return;

  const errEl = document.getElementById("staffModalError");
  errEl.classList.remove("show");
  const btn = document.getElementById("saveStaffBtn");
  setBtnLoading(btn, true);

  const id = document.getElementById("staffId").value;
  const full_name = document.getElementById("staffName").value.trim();
  const role = document.getElementById("staffRole").value;
  const active = document.getElementById("staffActive").value === "true";

  if (id) {
    // Editing an existing staff member's name/role/status.
    const { error } = await sb.from("profiles").update({ full_name, role, active }).eq("id", id);
    setBtnLoading(btn, false, "Save");
    if (error) { errEl.textContent = error.message; errEl.classList.add("show"); return; }
    toast("Staff member updated.", "success");
  } else {
    // Creating a brand-new staff login — goes through the edge function
    // so the service role key never has to live in the browser.
    const email = document.getElementById("staffEmail").value.trim();
    const password = document.getElementById("staffPassword").value;

    let result;
    try {
      result = await sb.functions.invoke("create-staff", {
        body: { full_name, email, password, role },
      });
    } catch (networkErr) {
      setBtnLoading(btn, false, "Save");
      errEl.innerHTML =
        `Could not reach the staff-creation service. This usually means the <b>create-staff</b> function ` +
        `hasn't been deployed yet in Supabase (Edge Functions → Deploy a new function → name it exactly ` +
        `<b>create-staff</b> → paste in the code from <b>supabase/functions/create-staff/index.ts</b>). ` +
        `Technical detail: ${escapeHtml(networkErr.message || String(networkErr))}`;
      errEl.classList.add("show");
      return;
    }

    const { data, error } = result;
    setBtnLoading(btn, false, "Save");

    if (error || data?.error) {
      const msg = data?.error || error.message || "Could not create staff account.";
      if (/fetch|network|failed to send/i.test(msg)) {
        errEl.innerHTML =
          `Could not reach the staff-creation service. Check that the <b>create-staff</b> Edge Function is ` +
          `deployed in your Supabase project (Edge Functions section) and that its name matches exactly.`;
      } else {
        errEl.textContent = msg;
      }
      errEl.classList.add("show");
      return;
    }
    toast(`${full_name} can now sign in with the email and password you set.`, "success");
  }

  closeModal("staffModal");
  await loadAllProfiles();
  renderStaffTable();
});
