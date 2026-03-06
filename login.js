/* CompileRace — local-only login (GitHub Pages friendly) */

/* ── Accent color ── */
(function initAccentColor() {
  const saved = localStorage.getItem("compileRaceAccent");
  if (saved) {
    document.documentElement.style.setProperty("--accent",      saved);
    document.documentElement.style.setProperty("--accent-glow", saved + "44");
  }
  const picker = document.getElementById("colorPicker");
  const btn    = document.getElementById("customizeBtn");
  if (picker) {
    picker.value = saved || "#4ade80";
    picker.addEventListener("input", (e) => {
      const c = e.target.value;
      document.documentElement.style.setProperty("--accent",      c);
      document.documentElement.style.setProperty("--accent-glow", c + "44");
      localStorage.setItem("compileRaceAccent", c);
    });
  }
  if (btn && picker) btn.addEventListener("click", () => picker.click());
})();

/* ── Constants ── */
const AUTH_KEY = "compileRace::authUser"; // stores JSON {email, name, ts}

/* ── Helpers ── */
function setMsg(text, type = "") {
  const el = document.getElementById("msg");
  if (!el) return;
  el.className = "msg" + (type ? " " + type : "");
  el.textContent = text;
}

function setLoading(on) {
  const btn     = document.querySelector(".primary-btn");
  const spinner = document.getElementById("btnSpinner");
  // FIX: simplified — already return-guarded above
  if (!btn) return;
  const btnText = btn.querySelector(".btn-text");
  btn.disabled = on;
  btn.classList.toggle("loading", on);
  if (spinner) spinner.style.display = on ? "inline-block" : "none";
  if (btnText) btnText.textContent   = on ? "Signing in…" : "Login →";
}

/* FIX: validate that the redirect target is same-origin to prevent open redirect attacks */
function isSafeRedirect(url) {
  try {
    const parsed = new URL(decodeURIComponent(url), location.origin);
    return parsed.origin === location.origin;
  } catch {
    return false;
  }
}

function redirectAfterLogin() {
  const params = new URLSearchParams(location.search);
  const next   = params.get("next");
  if (next && isSafeRedirect(next)) {
    location.href = decodeURIComponent(next);
  } else {
    location.href = "index.html";
  }
}

/* ── Auto-redirect if already logged in ── */
(function autoRedirectIfLoggedIn() {
  const raw = localStorage.getItem(AUTH_KEY);
  if (raw) redirectAfterLogin();
})();

/* ── Toggle password visibility ── */
document.getElementById("togglePw")?.addEventListener("click", () => {
  const pw  = document.getElementById("password");
  const btn = document.getElementById("togglePw");
  if (!pw) return;
  const isHidden = pw.type === "password";
  pw.type        = isHidden ? "text" : "password";
  if (btn) btn.textContent = isHidden ? "🙈" : "👁";
});

/* ── Demo account ── */
document.getElementById("demoBtn")?.addEventListener("click", () => {
  const demo = { email: "demo@compilerace.dev", name: "Demo", ts: Date.now() };
  localStorage.setItem(AUTH_KEY, JSON.stringify(demo));
  setMsg("Logged in as Demo ✅", "ok");
  setTimeout(redirectAfterLogin, 400);
});

/* ── Login form submit ── */
document.getElementById("loginForm")?.addEventListener("submit", (e) => {
  e.preventDefault();

  const email = document.getElementById("email")?.value.trim().toLowerCase() || "";
  const pass  = document.getElementById("password")?.value || "";

  setMsg("");

  if (!email.includes("@")) return setMsg("Enter a valid email address.", "err");
  if (pass.length < 4)       return setMsg("Password must be at least 4 characters.", "err");

  setLoading(true);
  setTimeout(() => {
    const user = {
      email,
      name: email.split("@")[0].slice(0, 16),
      ts:   Date.now()
    };
    localStorage.setItem(AUTH_KEY, JSON.stringify(user));
    setMsg("Login successful ✅", "ok");
    setTimeout(redirectAfterLogin, 400);
  }, 350);
});

/* ── Clear error on input ── */
["email", "password"].forEach((id) => {
  document.getElementById(id)?.addEventListener("input", () => {
    const msg = document.getElementById("msg");
    if (msg?.classList.contains("err")) setMsg("");
  });
});