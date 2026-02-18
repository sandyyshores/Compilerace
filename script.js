// ===============================
// CompileRace — script.js
// ===============================

const editor = document.getElementById("editor");
const highlightContent = document.getElementById("highlight-content");
const bgTimer = document.getElementById("bg-timer");
const runBtn = document.getElementById("runBtn");
const restartBtn = document.getElementById("restartBtn");
const colorPicker = document.getElementById("colorPicker");
const highlightLayer = document.getElementById("highlight-layer");
const windowEl = document.querySelector(".editor-window");
const objectiveText = document.getElementById("objectiveText");
const sampleInputText = document.getElementById("sampleInputText");
const sampleOutputText = document.getElementById("sampleOutputText");
const testStatusCard = document.getElementById("testStatusCard");
const testStatusList = document.getElementById("testStatusList");
const windowStats = document.getElementById("windowStats");

const JUDGE0_BASE = "https://ce.judge0.com";

// Cache key for java language id so we don't keep hitting /languages (rate limit / CORS issues)
const JAVA_LANG_CACHE_KEY = "compileRace::javaLanguageId";

/* =========================
   TEMPLATE BUILDING
========================= */
function buildStarterCode(q) {
  const template =
    window.JAVA_TEMPLATE ||
    `import java.util.Scanner;\nclass Main{\n  public static void main(String[] args){\n    Scanner sc = new Scanner(System.in);\n    {{CODE}}\n  }\n}`;
  const insert = (q.starterInsert || "// write your code here").trim();
  const indented = insert
    .split("\n")
    .map((l) => "    " + l)
    .join("\n");
  return template.replace("{{CODE}}", indented + "\n");
}

// ✅ Allows BOTH styles:
// 1) user types only logic (snippet) -> we wrap it
// 2) user types full program -> we send as-is
function prepareJavaSource(raw) {
  const code = (raw || "").trim();

  const looksLikeFullProgram =
    /\bclass\s+Main\b/.test(code) ||
    /\bpublic\s+class\s+Main\b/.test(code) ||
    /\bpublic\s+static\s+void\s+main\s*\(/.test(code) ||
    /^\s*import\s+.+;/m.test(code);

  if (looksLikeFullProgram) return code;

  // Wrap snippet into template
  return buildStarterCode({ starterInsert: code });
}

function getSelectedQuestionIndex() {
  const params = new URLSearchParams(location.search);
  const idx = parseInt(params.get("q") || "0", 10);
  return Number.isNaN(idx) ? 0 : idx;
}

function getSelectedQuestion() {
  const idx = getSelectedQuestionIndex();
  const fallback = {
    id: "fallback-hello",
    title: "Hello World",
    objective: 'Print "Hello World".',
    sample: { input: "", output: "Hello World" },
    tests: [{ stdin: "", out: "Hello World" }],
    starterInsert: "",
  };
  const qs = window.QUESTIONS;
  if (!qs || !Array.isArray(qs) || !qs.length) return fallback;
  return qs[Math.max(0, Math.min(idx, qs.length - 1))] || fallback;
}

const currentQuestion = getSelectedQuestion();
const bestKey = `compileRaceBestTime::${currentQuestion.id}`;

if (objectiveText) objectiveText.textContent = currentQuestion.objective || "";
if (sampleInputText) sampleInputText.textContent = currentQuestion.sample?.input || "(none)";
if (sampleOutputText) sampleOutputText.textContent = currentQuestion.sample?.output || "";

editor.value = buildStarterCode(currentQuestion);

/* =========================
   VICTORY OVERLAY
========================= */
let victoryOverlay = null;

function createVictoryOverlay() {
  if (victoryOverlay) return;
  victoryOverlay = document.createElement("div");
  victoryOverlay.className = "victory-overlay";
  victoryOverlay.innerHTML = `
    <div class="confetti" id="confetti"></div>
    <div class="victory-card">
      <div class="victory-ring"></div>
      <h2 class="victory-title">🏆 <span>Victory</span>!</h2>
      <p class="victory-sub" id="victorySub">Race complete.</p>
      <div class="victory-stats">
        <div class="victory-pill"><div class="k">Time</div><div class="v" id="vTime">0s</div></div>
        <div class="victory-pill"><div class="k">CPS</div><div class="v" id="vCps">0.00</div></div>
        <div class="victory-pill"><div class="k">Best</div><div class="v" id="vBest">—</div></div>
      </div>
      <button class="victory-next-btn" id="victoryNextBtn">Next Challenge →</button>
    </div>
  `;
  document.body.appendChild(victoryOverlay);

  victoryOverlay.addEventListener("click", (e) => {
    if (e.target === victoryOverlay) victoryOverlay.classList.remove("show");
  });

  document.getElementById("victoryNextBtn").addEventListener("click", () => {
    const nextIdx = getSelectedQuestionIndex() + 1;
    const qs = window.QUESTIONS || [];
    if (nextIdx < qs.length) location.href = `race.html?q=${nextIdx}`;
    else location.href = "index.html";
  });
}

function launchConfetti(count = 120) {
  const conf = document.getElementById("confetti");
  if (!conf) return;
  conf.innerHTML = "";
  const colors = ["var(--accent)", "#60a5fa", "#f472b6", "#fbbf24", "#a78bfa"];
  for (let i = 0; i < count; i++) {
    const p = document.createElement("span");
    p.style.left = Math.random() * 100 + "vw";
    p.style.setProperty("--d", 900 + Math.random() * 1100 + "ms");
    p.style.setProperty("--delay", Math.random() * 400 + "ms");
    p.style.background = colors[Math.floor(Math.random() * colors.length)];
    conf.appendChild(p);
  }
}

function showVictoryAnimation({ time, cps, best }) {
  if (!victoryOverlay) createVictoryOverlay();
  document.getElementById("vTime").textContent = `${time}s`;
  document.getElementById("vCps").textContent = `${cps}`;
  document.getElementById("vBest").textContent = best ? `${best}s` : "—";
  document.getElementById("victorySub").textContent = "All tests passed. GG 🎉";

  const card = victoryOverlay.querySelector(".victory-card");
  const clone = card.cloneNode(true);
  card.parentNode.replaceChild(clone, card);

  clone.querySelector("#victoryNextBtn").addEventListener("click", () => {
    const nextIdx = getSelectedQuestionIndex() + 1;
    const qs = window.QUESTIONS || [];
    if (nextIdx < qs.length) location.href = `race.html?q=${nextIdx}`;
    else location.href = "index.html";
  });

  victoryOverlay.classList.add("show");
  launchConfetti(140);
  setTimeout(() => victoryOverlay.classList.remove("show"), 4000);
}

/* =========================
   BORDER TRACE WHILE TYPING
========================= */
let currentTrace = 0,
  targetTrace = 0,
  traceRAF = null;

function updateTraceProgress() {
  const targetChars = 140;
  targetTrace = Math.min(1, editor.value.length / targetChars);
  if (editor.value.trim().length > 0) windowEl.classList.add("is-typing");
  else {
    windowEl.classList.remove("is-typing");
    targetTrace = 0;
  }
  if (!traceRAF) animateTrace();
}

function animateTrace() {
  traceRAF = requestAnimationFrame(animateTrace);
  currentTrace += (targetTrace - currentTrace) * 0.12;
  windowEl.style.setProperty("--trace", currentTrace.toString());
  if (Math.abs(targetTrace - currentTrace) < 0.001) {
    currentTrace = targetTrace;
    windowEl.style.setProperty("--trace", currentTrace.toString());
    cancelAnimationFrame(traceRAF);
    traceRAF = null;
  }
}

/* =========================
   TIMER + STATS
========================= */
let startTime = null;
let timerInterval = null;
let finished = false;
let totalCharsTyped = 0;
const storedBest = localStorage.getItem(bestKey);
let bestTime = storedBest ? parseInt(storedBest, 10) : null;

function updateWindowStats() {
  if (!windowStats) return;
  const lines = editor.value.split("\n").length;
  const chars = editor.value.length;
  windowStats.textContent = `${lines} lines · ${chars} chars`;
}

/* =========================
   SYNTAX HIGHLIGHTING
========================= */
function escapeHtml(s) {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function updateHighlighting() {
  let code = escapeHtml(editor.value);

  code = code.replace(/("(?:[^"\\]|\\.)*")/g, '<span class="token string">$1</span>');
  code = code.replace(/(\/\/[^\n]*)/g, '<span class="token comment">$1</span>');

  const keywords =
    /\b(public|private|protected|class|static|void|int|long|double|float|boolean|char|String|new|return|if|else|while|for|do|break|continue|import|Scanner|System|out|println|print|in|Math|Arrays|ArrayList|List|Map|HashMap|null|true|false|this|super|extends|implements|interface|try|catch|finally|throw|throws)\b/g;

  const parts = code.split(/(<span[^>]*>[\s\S]*?<\/span>)/g);
  code = parts
    .map((part) => (part.startsWith("<span") ? part : part.replace(keywords, '<span class="token keyword">$1</span>')))
    .join("");

  const numParts = code.split(/(<span[^>]*>[\s\S]*?<\/span>)/g);
  code = numParts
    .map((part) => (part.startsWith("<span") ? part : part.replace(/\b(\d+)\b/g, '<span class="token number">$1</span>')))
    .join("");

  highlightContent.innerHTML = code;
}

/* =========================
   INPUT LISTENER
========================= */
let lastLength = editor.value.length;

editor.addEventListener("input", () => {
  editor.addEventListener("input", updateActiveLine);
editor.addEventListener("click", updateActiveLine);
editor.addEventListener("keyup", updateActiveLine);
editor.addEventListener("scroll", updateActiveLine, { passive: true });

window.addEventListener("resize", updateActiveLine);
window.addEventListener("load", updateActiveLine);

  const newLength = editor.value.length;
  if (newLength > lastLength) totalCharsTyped += newLength - lastLength;
  lastLength = newLength;

  if (!finished) {
    if (!startTime && editor.value.trim().length > 0) {
      startTime = Date.now();
      if (timerInterval) clearInterval(timerInterval);
      timerInterval = setInterval(() => {
        if (finished) return;
        const t = Math.floor((Date.now() - startTime) / 1000);
        if (bgTimer.textContent !== t.toString()) {
          bgTimer.textContent = t;
          bgTimer.classList.remove("pulse-active");
          void bgTimer.offsetWidth;
          bgTimer.classList.add("pulse-active");
        }
      }, 500);
      showToast("Race started! Go! 🚀", "var(--accent)");
    }
    updateTraceProgress();
  }

  updateHighlighting();
  updateWindowStats();
});
let scrollRAF = null;
let pendingTop = 0;
let pendingLeft = 0;

editor.addEventListener(
  "scroll",
  () => {
    pendingTop = editor.scrollTop;
    pendingLeft = editor.scrollLeft;

    if (scrollRAF) return;
    scrollRAF = requestAnimationFrame(() => {
      highlightLayer.scrollTop = pendingTop;
      highlightLayer.scrollLeft = pendingLeft;
      scrollRAF = null;
    });
  },
  { passive: true }
);
function insertTextAtSelection(text, mode = "end") {
  const start = editor.selectionStart;
  const end = editor.selectionEnd;
  editor.setRangeText(text, start, end, mode); // ✅ preserves undo stack
}




/* =========================
   KEYBOARD LOGIC
========================= */
editor.addEventListener("keydown", (e) => {
  if (finished) {
    // ✅ Let browser handle Undo/Redo normally
if ((e.ctrlKey || e.metaKey) && (e.key.toLowerCase() === "z" || e.key.toLowerCase() === "y")) {
  return;
}

    if (e.ctrlKey && e.key === "Enter") e.preventDefault();
    return;
  }

  const start = editor.selectionStart;
  const end = editor.selectionEnd;

  if (e.ctrlKey && e.key === "Enter") {
    e.preventDefault();
    runCode();
    return;
  }

  const closers = ["}", ")", "]", '"', "'"];
  if (closers.includes(e.key) && editor.value[start] === e.key) {
    e.preventDefault();
    editor.selectionStart = editor.selectionEnd = start + 1;
    return;
  }

  const pairs = { "{": "}", "(": ")", "[": "]" };
if (pairs[e.key]) {
  e.preventDefault();
  const start = editor.selectionStart;
  insertTextAtSelection(e.key + pairs[e.key], "end");
  editor.selectionStart = editor.selectionEnd = start + 1; // caret inside
  updateHighlighting();
  updateWindowStats();
  updateActiveLine?.();
  return;
}


if (e.key === "Enter") {
  e.preventDefault();

  const start = editor.selectionStart;
  const before = editor.value.slice(0, start);
  const lineStart = before.lastIndexOf("\n") + 1;
  const currentLine = before.slice(lineStart);
  const indent = (currentLine.match(/^(\s*)/) || ["", ""])[1];

  // Special case: between {}
  if (editor.value[start - 1] === "{" && editor.value[start] === "}") {
    const innerIndent = indent + "    ";
    insertTextAtSelection("\n" + innerIndent + "\n" + indent, "end");
    editor.selectionStart = editor.selectionEnd = start + 1 + innerIndent.length;
  } else {
    insertTextAtSelection("\n" + indent, "end");
  }

  updateHighlighting();
  updateWindowStats();
  updateActiveLine?.();
  return;
}

  if (e.key === "Tab") {
  e.preventDefault();
  insertTextAtSelection("    ", "end");
  updateHighlighting();
  updateWindowStats();
  updateActiveLine?.();
  return;
}

});

// Block paste/drop
editor.addEventListener("paste", (e) => {
  e.preventDefault();
  showToast("🚫 Paste is disabled — type it!", "#ef4444");
});
editor.addEventListener("drop", (e) => e.preventDefault());
editor.addEventListener("contextmenu", (e) => e.preventDefault());

/* =========================
   JUDGE0 INTEGRATION
========================= */
let javaLanguageId = null;

function normalizeOut(s) {
  // Keeps your old behavior but slightly more forgiving about trailing spaces per line
  return (s ?? "")
    .replace(/\r\n/g, "\n")
    .split("\n")
    .map((line) => line.trimEnd())
    .join("\n")
    .trim();
}

// Verbose fetch for language id (gives you real reason if it fails)
async function resolveJavaLanguageIdVerbose() {
  let res;
  try {
    res = await fetch(`${JUDGE0_BASE}/languages`, { cache: "no-store" });
  } catch (err) {
    throw new Error(`Cannot reach ${JUDGE0_BASE}/languages (network/CORS). ${err?.message || err}`);
  }

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`Judge0 /languages failed: HTTP ${res.status} ${res.statusText}. ${text.slice(0, 200)}`);
  }

  const langs = await res.json();
  const javaLangs = langs.filter(
    (l) => typeof l?.name === "string" && l.name.toLowerCase().includes("java")
  );

  if (!javaLangs.length) throw new Error("Java not found in Judge0 /languages response.");

  // Prefer OpenJDK if present
  const preferred = javaLangs.filter((l) => l.name.toLowerCase().includes("openjdk"));
  const pool = preferred.length ? preferred : javaLangs;

  pool.sort((a, b) => (b.id ?? 0) - (a.id ?? 0));
  console.log("Java language chosen:", pool[0]);
  return pool[0].id;
}

async function getJavaLanguageIdCached() {
  // In-memory first
  if (javaLanguageId) return javaLanguageId;

  // localStorage cache
  const cached = localStorage.getItem(JAVA_LANG_CACHE_KEY);
  if (cached && !Number.isNaN(parseInt(cached, 10))) {
    javaLanguageId = parseInt(cached, 10);
    return javaLanguageId;
  }

  // Fetch once
  const id = await resolveJavaLanguageIdVerbose();
  javaLanguageId = id;
  localStorage.setItem(JAVA_LANG_CACHE_KEY, String(id));
  return id;
}

async function runOnJudge0({ source_code, stdin, language_id }) {
  const url = `${JUDGE0_BASE}/submissions?wait=true&base64_encoded=false&fields=*`;

  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      language_id,
      source_code,
      stdin: stdin || "",
    }),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`Judge0 error (${res.status}): ${text.slice(0, 200)}`);
  }

  const data = await res.json();
  // Debug (leave it; helps a lot while building)
  console.log("JUDGE0 RESULT:", data);
  return data;
}

/* =========================
   SUBMIT (MULTI-TEST)
========================= */
let isRunning = false;

async function runCode() {
  if (finished || !startTime || isRunning) return;
  isRunning = true;

  runBtn.disabled = true;
  runBtn.classList.add("loading");

  clearInterval(timerInterval);
  const finalTime = Math.max(1, Math.floor((Date.now() - startTime) / 1000));
  bgTimer.textContent = finalTime;

  testStatusCard.style.display = "none";
  testStatusList.innerHTML = "";

  showToast("🧪 Running tests...", "#f59e0b");

  try {
    showToast("🔍 Connecting to compiler...", "#3b82f6");
    await getJavaLanguageIdCached();
  } catch (e) {
    console.error(e);
    showToast(`❌ Compiler unavailable: ${e.message || e}`, "#ef4444");
    resumeTimer();
    runBtn.disabled = false;
    runBtn.classList.remove("loading");
    isRunning = false;
    return;
  }

  const tests = currentQuestion.tests?.length
    ? currentQuestion.tests
    : [{ stdin: currentQuestion.stdin || "", out: currentQuestion.expectedOutput || "" }];

  const results = [];
  let allPassed = true;

  for (let i = 0; i < tests.length; i++) {
    const t = tests[i];

    const sourceToRun = prepareJavaSource(editor.value);

    let result;
    try {
      result = await runOnJudge0({
        source_code: sourceToRun,
        stdin: t.stdin || "",
        language_id: javaLanguageId,
      });
    } catch (e) {
      console.error(e);
      showToast("❌ Compile/Run request failed.", "#ef4444");
      results.push({ passed: false, label: `Test ${i + 1}`, error: (e.message || "Run error").slice(0, 140) });
      allPassed = false;
      break;
    }

    const stdout = normalizeOut(result.stdout);
    const stderr = normalizeOut(result.stderr);
    const compileOut = normalizeOut(result.compile_output);
    const expected = normalizeOut(t.out);

    // ✅ Show real compiler error
    if (compileOut) {
      showToast("❌ Compilation Error", "#ef4444");
      results.push({
        passed: false,
        label: `Test ${i + 1}`,
        error: compileOut.slice(0, 300) + (compileOut.length > 300 ? "…" : ""),
      });
      allPassed = false;
      break;
    }

    // ✅ Show real runtime error
    if (stderr) {
      showToast("❌ Runtime Error", "#ef4444");
      results.push({
        passed: false,
        label: `Test ${i + 1}`,
        error: stderr.slice(0, 300) + (stderr.length > 300 ? "…" : ""),
      });
      allPassed = false;
      break;
    }

    const passed = stdout === expected;
    results.push({ passed, label: `Test ${i + 1}` });

    if (!passed) {
      showToast(`❌ Wrong Answer on Test ${i + 1}`, "#ef4444");
      allPassed = false;
      break;
    }
  }

  if (!allPassed) {
    showTestResults(results);
    resumeTimer();
    runBtn.disabled = false;
    runBtn.classList.remove("loading");
    isRunning = false;
    return;
  }

  // ✅ All passed
  finished = true;
  isRunning = false;

  const allResults = tests.map((_, i) => ({ passed: true, label: `Test ${i + 1}` }));
  showTestResults(allResults);

  windowEl.classList.add("is-complete");
  windowEl.style.setProperty("--trace", "1");
  editor.disabled = true;
  editor.style.opacity = "0.6";
  runBtn.disabled = true;

  const cps = (totalCharsTyped / finalTime).toFixed(2);

  if (!bestTime || finalTime < bestTime) {
    bestTime = finalTime;
    localStorage.setItem(bestKey, String(finalTime));
  }

  showToast(`✅ Accepted · ${finalTime}s · ${cps} CPS`, "var(--accent)");
  showVictoryAnimation({ time: finalTime, cps, best: bestTime });
}

function showTestResults(results) {
  testStatusCard.style.display = "block";
  testStatusList.innerHTML = results
    .map(
      (r) => `
    <div class="test-result-row ${r.passed ? "pass" : "fail"}">
      <span>${r.passed ? "✅" : "❌"}</span>
      <span>${r.label}</span>
      ${r.error ? `<span class="test-error">${escapeHtml(r.error)}</span>` : ""}
    </div>
  `
    )
    .join("");
}

function resumeTimer() {
  if (finished) return;
  const elapsed = parseInt(bgTimer.textContent || "0", 10) * 1000;
  startTime = Date.now() - elapsed;
  if (timerInterval) clearInterval(timerInterval);
  timerInterval = setInterval(() => {
    if (finished) return;
    bgTimer.textContent = Math.floor((Date.now() - startTime) / 1000).toString();
  }, 500);
}

/* =========================
   CONTROLS
========================= */
if (colorPicker) {
  colorPicker.addEventListener("input", (e) => {
    const c = e.target.value;
    document.documentElement.style.setProperty("--accent", c);
    document.documentElement.style.setProperty("--accent-glow", c + "44");
    localStorage.setItem("compileRaceAccent", c);
  });
}


runBtn.addEventListener("click", runCode);

restartBtn.addEventListener("click", () => {
  if (!confirm("Restart the challenge?")) return;
  clearInterval(timerInterval);
  startTime = null;
  finished = false;
  isRunning = false;
  totalCharsTyped = 0;
  lastLength = 0;

  bgTimer.textContent = "0";
  bgTimer.classList.remove("pulse-active");
  windowEl.classList.remove("is-complete", "is-typing");
  windowEl.style.setProperty("--trace", "0");
  currentTrace = 0;
  targetTrace = 0;

  editor.disabled = false;
  editor.style.opacity = "1";
  runBtn.disabled = false;
  runBtn.classList.remove("loading");

  testStatusCard.style.display = "none";
  testStatusList.innerHTML = "";

  editor.value = buildStarterCode(currentQuestion);
  lastLength = editor.value.length;
  updateHighlighting();
  updateWindowStats();
  editor.focus();
});

function showToast(msg, color = "var(--accent)") {
  const toast = document.getElementById("output-toast");
  if (!toast) return;
  toast.textContent = msg;
  toast.style.borderLeftColor = color;
  toast.classList.add("show");
  clearTimeout(toast._timer);
  toast._timer = setTimeout(() => toast.classList.remove("show"), 2800);
}

window.onload = () => {
  updateHighlighting();
  updateWindowStats();
  lastLength = editor.value.length;
  createVictoryOverlay();
  editor.focus();
};
const homeBtn = document.getElementById("homeBtn");
if (homeBtn) {
  homeBtn.addEventListener("click", () => {
    location.href = "index.html";
  });
}
function updateActiveLine() {
  const activeLine = document.getElementById("active-line");
  if (!activeLine) return;

  const start = editor.selectionStart || 0;
  const before = editor.value.slice(0, start);
  const lineIndex = before.split("\n").length - 1;

  const styles = getComputedStyle(editor);
  const lineHeight = parseFloat(styles.lineHeight) || 22;
  const paddingTop = parseFloat(styles.paddingTop) || 0;

  const y = paddingTop + (lineIndex * lineHeight) - editor.scrollTop;
  activeLine.style.height = lineHeight + "px";
  activeLine.style.transform = `translateY(${y}px)`;
}
// ===============================
// Accent color persistence (Home + Race)
// ===============================
(function initAccentColor() {
  const saved = localStorage.getItem("compileRaceAccent");
  if (saved) {
    document.documentElement.style.setProperty("--accent", saved);
    document.documentElement.style.setProperty("--accent-glow", saved + "44");
  }

  const picker = document.getElementById("colorPicker");
  const btn = document.getElementById("customizeBtn");

  if (picker) {
    picker.value = saved || getComputedStyle(document.documentElement).getPropertyValue("--accent").trim() || "#4ade80";
    picker.addEventListener("input", (e) => {
      const c = e.target.value;
      document.documentElement.style.setProperty("--accent", c);
      document.documentElement.style.setProperty("--accent-glow", c + "44");
      localStorage.setItem("compileRaceAccent", c);
    });
  }

  if (btn && picker) {
    btn.addEventListener("click", () => picker.click());
  }
})();
