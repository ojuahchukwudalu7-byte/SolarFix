// ============================================================
// SolarFix — Auth: login, first-admin setup, session, logout
// ============================================================

function showAuthScreen() {
  document.getElementById("authView").style.display = "flex";
  document.getElementById("appShell").style.display = "none";
}

async function showAppScreen() {
  document.getElementById("authView").style.display = "none";
  document.getElementById("appShell").style.display = "flex";
  await loadProfileAndData();
}

// ---------- Login / Setup pane toggle ----------
document.getElementById("showSetup").addEventListener("click", () => {
  document.getElementById("loginPane").style.display = "none";
  document.getElementById("setupPane").style.display = "block";
});
document.getElementById("showLogin").addEventListener("click", () => {
  document.getElementById("setupPane").style.display = "none";
  document.getElementById("loginPane").style.display = "block";
});

// ---------- Sign in ----------
document.getElementById("loginForm").addEventListener("submit", async (e) => {
  e.preventDefault();
  const errEl = document.getElementById("loginError");
  errEl.classList.remove("show");
  const btn = document.getElementById("loginBtn");
  setBtnLoading(btn, true);

  const email = document.getElementById("loginEmail").value.trim();
  const password = document.getElementById("loginPassword").value;

  const { data, error } = await sb.auth.signInWithPassword({ email, password });

  setBtnLoading(btn, false, "Sign in");

  if (error) {
    errEl.textContent = error.message || "Could not sign in. Check your email and password.";
    errEl.classList.add("show");
    return;
  }

  App.state.session = data.session;
  await showAppScreen();
});

// ---------- Create first admin ----------
document.getElementById("setupForm").addEventListener("submit", async (e) => {
  e.preventDefault();
  const errEl = document.getElementById("setupError");
  errEl.classList.remove("show");
  const btn = document.getElementById("setupBtn");
  setBtnLoading(btn, true);

  const full_name = document.getElementById("setupName").value.trim();
  const email = document.getElementById("setupEmail").value.trim();
  const password = document.getElementById("setupPassword").value;

  const { data: signUpData, error: signUpError } = await sb.auth.signUp({ email, password });

  if (signUpError) {
    setBtnLoading(btn, false, "Create admin account");
    errEl.textContent = signUpError.message;
    errEl.classList.add("show");
    return;
  }

  // If email confirmation is required by your Supabase project settings,
  // there won't be an active session yet — tell the user to confirm first.
  if (!signUpData.session) {
    setBtnLoading(btn, false, "Create admin account");
    toast("Account created. Check your email to confirm it, then sign in.", "info");
    document.getElementById("setupPane").style.display = "none";
    document.getElementById("loginPane").style.display = "block";
    return;
  }

  const userId = signUpData.user.id;
  const { error: profileError } = await sb.from("profiles").insert({
    id: userId,
    full_name,
    role: "admin",
    active: true,
  });

  setBtnLoading(btn, false, "Create admin account");

  if (profileError) {
    errEl.textContent =
      "Account created, but the admin profile could not be set (an admin may already exist). " +
      profileError.message;
    errEl.classList.add("show");
    return;
  }

  App.state.session = signUpData.session;
  toast("Admin account created. Welcome to SolarFix.", "success");
  await showAppScreen();
});

// ---------- Logout ----------
document.getElementById("logoutBtn").addEventListener("click", () => {
  askConfirm("Sign out?", "You'll need your email and password to sign back in.", async () => {
    await sb.auth.signOut();
    App.state = { session: null, profile: null, profiles: [], items: [], repairs: [], repairParts: [], log: [] };
    showAuthScreen();
  });
});

// ---------- Load profile + seed data after login ----------
async function loadProfileAndData() {
  const { data: userData } = await sb.auth.getUser();
  if (!userData?.user) { showAuthScreen(); return; }

  const { data: profile, error } = await sb
    .from("profiles")
    .select("*")
    .eq("id", userData.user.id)
    .single();

  if (error || !profile) {
    toast("Your account has no profile yet. Ask an admin to add you as staff.", "error");
    await sb.auth.signOut();
    showAuthScreen();
    return;
  }

  if (!profile.active) {
    toast("Your account has been deactivated. Contact your admin.", "error");
    await sb.auth.signOut();
    showAuthScreen();
    return;
  }

  App.state.profile = profile;

  document.getElementById("userAvatar").textContent = initials(profile.full_name);
  document.getElementById("userName").textContent = profile.full_name;
  document.getElementById("userRole").textContent = profile.role;

  applyRoleGates();
  applyInventoryPermissionGates();
  applyStaffPermissionGates();

  await Promise.all([loadAllProfiles(), loadInventory(), loadRepairs(), loadRecentLog()]);
  goToView("dashboard");
}

// ---------- Session restore on page load ----------
(async function initAuth() {
  const { data } = await sb.auth.getSession();
  if (data.session) {
    App.state.session = data.session;
    await showAppScreen();
  } else {
    showAuthScreen();
  }

  sb.auth.onAuthStateChange((event, session) => {
    App.state.session = session;
    if (event === "SIGNED_OUT") showAuthScreen();
  });
})();
