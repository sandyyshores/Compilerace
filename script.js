// ===============================
// CompileRace — script.js (FIXED)
// ===============================

/* =========================
   DOM
========================= */
const editor           = document.getElementById("editor");
const highlightContent = document.getElementById("highlight-content");
const highlightLayer   = document.getElementById("highlight-layer");
const bgTimer          = document.getElementById("bg-timer");

const runBtn           = document.getElementById("runBtn");
const restartBtn       = document.getElementById("restartBtn");

const windowEl         = document.querySelector(".editor-window");
const objectiveText    = document.getElementById("objectiveText");
const sampleInputText  = document.getElementById("sampleInputText");
const sampleOutputText = document.getElementById("sampleOutputText");

const testStatusCard   = document.getElementById("testStatusCard");
const testStatusList   = document.getElementById("testStatusList");
const windowStats      = document.getElementById("windowStats");

const homeBtn          = document.getElementById("homeBtn");
const prevBtn          = document.getElementById("prevBtn");
const nextBtn          = document.getElementById("nextBtn");

/* =========================
   CONFIG
========================= */
const JUDGE0_BASE         = "https://ce.judge0.com";
const JAVA_LANG_CACHE_KEY = "compileRace::javaLanguageId";
const JAVA_FALLBACK_IDS   = [91, 62];

/* =========================
   HELPERS
========================= */
function showToast(msg, color = "var(--accent)") {
  const toast = document.getElementById("output-toast");
  if (!toast) return;
  toast.textContent = msg;
  toast.style.borderLeftColor = color;
  toast.classList.add("show");
  clearTimeout(toast._timer);
  toast._timer = setTimeout(() => toast.classList.remove("show"), 2800);
}

function escapeHtml(s) {
  return (s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function normalizeOut(s) {
  return (s ?? "")
    .replace(/\r\n/g, "\n")
    .split("\n")
    .map((line) => line.trimEnd())
    .join("\n")
    .trim();
}

function insertTextAtSelection(text, mode = "end") {
  const start = editor.selectionStart;
  const end   = editor.selectionEnd;
  editor.setRangeText(text, start, end, mode);
}

/* =========================
   QUESTION HELPERS
========================= */
function getSelectedQuestionIndex() {
  const params = new URLSearchParams(location.search);
  const idx    = parseInt(params.get("q") || "0", 10);
  return Number.isNaN(idx) ? 0 : idx;
}

function getSelectedQuestion() {
  const idx      = getSelectedQuestionIndex();
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

function buildStarterCode(q) {
  const template =
    window.JAVA_TEMPLATE ||
    `import java.util.Scanner;\nclass Main{\n  public static void main(String[] args){\n    Scanner sc = new Scanner(System.in);\n    {{CODE}}\n  }\n}\n`;

  const insert   = (q.starterInsert || "// write your code here").trim();
  const indented = insert.split("\n").map((l) => "    " + l).join("\n");
  return template.replace("{{CODE}}", indented + "\n");
}

function prepareJavaSource(raw) {
  const code = (raw || "").trim();
  const looksLikeFullProgram =
    /\bclass\s+Main\b/.test(code) ||
    /\bpublic\s+class\s+Main\b/.test(code) ||
    /\bpublic\s+static\s+void\s+main\s*\(/.test(code) ||
    /^\s*import\s+.+;/m.test(code);
  if (looksLikeFullProgram) return code;
  return buildStarterCode({ starterInsert: code });
}

/* =========================
   LOAD QUESTION
========================= */
const currentQuestion = getSelectedQuestion();
const currentIdx      = getSelectedQuestionIndex();
const bestKey         = `compileRaceBestTime::${currentQuestion.id}`;

if (objectiveText)    objectiveText.textContent   = currentQuestion.objective       || "";
if (sampleInputText)  sampleInputText.textContent  = currentQuestion.sample?.input  || "(none)";
if (sampleOutputText) sampleOutputText.textContent = currentQuestion.sample?.output || "";

document.title = `${currentQuestion.title} — CompileRace`;

editor.value = buildStarterCode(currentQuestion);

/* ── Prev/Next navigation ── */
(function setupNavigation() {
  const qs    = window.QUESTIONS || [];
  const total = qs.length;

  if (prevBtn) {
    prevBtn.disabled = currentIdx <= 0;
    prevBtn.addEventListener("click", () => {
      if (currentIdx > 0) location.href = `race.html?q=${currentIdx - 1}`;
    });
  }

  if (nextBtn) {
    nextBtn.disabled = currentIdx >= total - 1;
    nextBtn.addEventListener("click", () => {
      if (currentIdx < total - 1) location.href = `race.html?q=${currentIdx + 1}`;
    });
  }

  const titleEl = document.getElementById("raceTitle");
  if (titleEl) {
    titleEl.textContent = `${currentQuestion.title} (${currentIdx + 1}/${total})`;
  }
})();

/* =========================
   ACTIVE LINE
========================= */
function updateActiveLine() {
  const activeLine = document.getElementById("active-line");
  if (!activeLine) return;
  const start     = editor.selectionStart || 0;
  const before    = editor.value.slice(0, start);
  const lineIndex = before.split("\n").length - 1;
  const styles    = getComputedStyle(editor);
  const lineH     = parseFloat(styles.lineHeight) || 22;
  const padTop    = parseFloat(styles.paddingTop)  || 0;
  const y         = padTop + lineIndex * lineH - editor.scrollTop;
  activeLine.style.height    = lineH + "px";
  activeLine.style.transform = `translateY(${y}px)`;
}

/* =========================
   LINE NUMBERS
========================= */
const lineNumbersEl = document.getElementById("line-numbers");

function updateLineNumbers() {
  if (!lineNumbersEl) return;
  const lines      = editor.value.split("\n");
  const totalLines = lines.length;
  const caretLine  = editor.value.slice(0, editor.selectionStart).split("\n").length;

  if (lineNumbersEl.children.length !== totalLines) {
    lineNumbersEl.innerHTML = "";
    for (let i = 1; i <= totalLines; i++) {
      const span = document.createElement("span");
      span.className   = "ln";
      span.textContent = i;
      lineNumbersEl.appendChild(span);
    }
  }

  Array.from(lineNumbersEl.children).forEach((el, i) => {
    el.classList.toggle("active", i + 1 === caretLine);
  });

  lineNumbersEl.scrollTop = editor.scrollTop;
}

/* =========================
   SYNTAX HIGHLIGHTING
========================= */
let highlightPending = false;

function scheduleHighlighting() {
  if (highlightPending) return;
  highlightPending = true;
  requestAnimationFrame(() => {
    highlightPending = false;
    _doHighlighting();
  });
}

function _doHighlighting() {
  let code = escapeHtml(editor.value);

  code = code.replace(/("(?:[^"\\]|\\.)*")/g, '<span class="token string">$1</span>');
  code = code.replace(/(\/\/[^\n]*)/g,         '<span class="token comment">$1</span>');

  const keywords =
    /\b(public|private|protected|class|static|void|int|long|double|float|boolean|char|String|new|return|if|else|while|for|do|break|continue|import|Scanner|System|out|println|print|in|Math|Arrays|ArrayList|List|Map|HashMap|null|true|false|this|super|extends|implements|interface|try|catch|finally|throw|throws)\b/g;

  const split1 = code.split(/(<span[^>]*>[\s\S]*?<\/span>)/g);
  code = split1
    .map((p) => (p.startsWith("<span") ? p : p.replace(keywords, '<span class="token keyword">$1</span>')))
    .join("");

  const split2 = code.split(/(<span[^>]*>[\s\S]*?<\/span>)/g);
  code = split2
    .map((p) => (p.startsWith("<span") ? p : p.replace(/\b(\d+)\b/g, '<span class="token number">$1</span>')))
    .join("");

  highlightContent.innerHTML = code;
}

function updateHighlighting() { scheduleHighlighting(); }

/* =========================
   WINDOW STATS
========================= */
function updateWindowStats() {
  if (!windowStats) return;
  const lines = editor.value.split("\n").length;
  const chars = editor.value.length;
  windowStats.textContent = `${lines} lines · ${chars} chars`;
}

/* =========================
   TIMER
========================= */
let startTime     = null;
let timerInterval = null;
let finished      = false;

let totalCharsTyped = 0;
let lastLength      = editor.value.length;

let currentTrace = 0;
let targetTrace  = 0;
let traceRAF     = null;

const storedBest = localStorage.getItem(bestKey);
// FIX: use parseFloat so decimal best times are preserved
let bestTime = storedBest ? parseFloat(storedBest) : null;

function getElapsedSeconds() {
  if (!startTime) return 0;
  return Math.max(1, Math.floor((Date.now() - startTime) / 1000));
}

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

function startTimerIfNeeded() {
  if (startTime || finished) return;
  if (editor.value.trim().length === 0) return;
  startTime = Date.now();
  if (timerInterval) clearInterval(timerInterval);
  timerInterval = setInterval(() => {
    if (finished) return;
    const t = getElapsedSeconds();
    if (bgTimer.textContent !== t.toString()) {
      bgTimer.textContent = t;
      bgTimer.classList.remove("pulse-active");
      void bgTimer.offsetWidth;
      bgTimer.classList.add("pulse-active");
    }
  }, 500);
  showToast("Race started! Go! 🚀", "var(--accent)");
}

/* =========================
   SCROLL MIRROR
========================= */
let scrollRAF   = null;
let pendingTop  = 0;
let pendingLeft = 0;

editor.addEventListener("scroll", () => {
  pendingTop  = editor.scrollTop;
  pendingLeft = editor.scrollLeft;
  updateActiveLine();
  if (lineNumbersEl) lineNumbersEl.scrollTop = pendingTop;
  if (scrollRAF) return;
  scrollRAF = requestAnimationFrame(() => {
    highlightLayer.scrollTop  = pendingTop;
    highlightLayer.scrollLeft = pendingLeft;
    scrollRAF = null;
  });
}, { passive: true });

/* =========================
   INPUT LISTENER
========================= */
editor.addEventListener("input", () => {
  // FIX: consistent opacity — always restore to the default visible value
  bgTimer.style.opacity = "0.5";
  const newLength = editor.value.length;
  if (newLength > lastLength) totalCharsTyped += newLength - lastLength;
  lastLength = newLength;

  if (!finished) {
    startTimerIfNeeded();
    updateTraceProgress();
  }

  updateHighlighting();
  updateWindowStats();
  updateActiveLine();
  updateLineNumbers();
});

editor.addEventListener("blur",  () => { bgTimer.style.opacity = "0.25"; });
editor.addEventListener("focus", () => { bgTimer.style.opacity = "0.5"; });
editor.addEventListener("click", () => { updateActiveLine(); updateLineNumbers(); });
editor.addEventListener("keyup", () => { updateActiveLine(); updateLineNumbers(); });
window.addEventListener("resize", updateActiveLine);

/* =========================
   KEYBOARD LOGIC
========================= */
editor.addEventListener("keydown", (e) => {
  if ((e.ctrlKey || e.metaKey) && (e.key.toLowerCase() === "z" || e.key.toLowerCase() === "y")) return;

  if (e.ctrlKey && e.key === "Enter") {
    e.preventDefault();
    if (!startTime && !finished) {
      showToast("✏️ Start typing your code first!", "#f59e0b");
      return;
    }
    if (!finished) runCode();
    return;
  }

  if (finished) return;

  const start   = editor.selectionStart;
  const closers = ["}", ")", "]", '"', "'"];
  if (closers.includes(e.key) && editor.value[start] === e.key) {
    e.preventDefault();
    editor.selectionStart = editor.selectionEnd = start + 1;
    updateActiveLine();
    return;
  }

  const pairs = { "{": "}", "(": ")", "[": "]" };
  if (pairs[e.key]) {
    e.preventDefault();
    const caret = editor.selectionStart;
    insertTextAtSelection(e.key + pairs[e.key], "end");
    editor.selectionStart = editor.selectionEnd = caret + 1;
    updateHighlighting();
    updateWindowStats();
    updateActiveLine();
    return;
  }

  if (e.key === "Enter") {
    e.preventDefault();
    const caret     = editor.selectionStart;
    const before    = editor.value.slice(0, caret);
    const lineStart = before.lastIndexOf("\n") + 1;
    const currLine  = before.slice(lineStart);
    const indent    = (currLine.match(/^(\s*)/) || ["", ""])[1];
    if (editor.value[caret - 1] === "{" && editor.value[caret] === "}") {
      const inner = indent + "    ";
      insertTextAtSelection("\n" + inner + "\n" + indent, "end");
      editor.selectionStart = editor.selectionEnd = caret + 1 + inner.length;
    } else {
      insertTextAtSelection("\n" + indent, "end");
    }
    updateHighlighting();
    updateWindowStats();
    updateActiveLine();
    return;
  }

  if (e.key === "Tab") {
    e.preventDefault();
    insertTextAtSelection("    ", "end");
    updateHighlighting();
    updateWindowStats();
    updateActiveLine();
    return;
  }
});

editor.addEventListener("paste",       (e) => { e.preventDefault(); showToast("🚫 Paste is disabled — type it!", "#ef4444"); });
editor.addEventListener("dragover",    (e) => e.preventDefault());
editor.addEventListener("drop",        (e) => { e.preventDefault(); showToast("🚫 Drop is disabled — type it!", "#ef4444"); });
editor.addEventListener("contextmenu", (e) => e.preventDefault());

/* =========================
   JUDGE0 INTEGRATION
========================= */
let javaLanguageId = null;

async function resolveJavaLanguageId() {
  const cached = localStorage.getItem(JAVA_LANG_CACHE_KEY);
  if (cached && !Number.isNaN(parseInt(cached, 10))) {
    return parseInt(cached, 10);
  }

  try {
    const res = await fetch(`${JUDGE0_BASE}/languages`, { cache: "no-store" });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const langs     = await res.json();
    const javaLangs = langs.filter((l) => typeof l?.name === "string" && l.name.toLowerCase().includes("java"));
    if (javaLangs.length) {
      const preferred = javaLangs.filter((l) => l.name.toLowerCase().includes("openjdk"));
      const pool      = preferred.length ? preferred : javaLangs;
      pool.sort((a, b) => (b.id ?? 0) - (a.id ?? 0));
      const id = pool[0].id;
      localStorage.setItem(JAVA_LANG_CACHE_KEY, String(id));
      return id;
    }
  } catch (err) {
    console.warn("Could not fetch Judge0 languages, using fallback ID.", err);
  }

  for (const fallbackId of JAVA_FALLBACK_IDS) {
    try {
      const testRes = await runOnJudge0({
        source_code: `class Main{public static void main(String[]a){System.out.println("ok");}}`,
        stdin: "",
        language_id: fallbackId,
      });
      if (testRes?.stdout?.trim() === "ok") {
        localStorage.setItem(JAVA_LANG_CACHE_KEY, String(fallbackId));
        return fallbackId;
      }
    } catch (_) { /* try next */ }
  }

  throw new Error("Java compiler not available. Check Judge0 endpoint.");
}

async function getJavaLanguageId() {
  if (javaLanguageId) return javaLanguageId;
  javaLanguageId = await resolveJavaLanguageId();
  return javaLanguageId;
}

async function runOnJudge0({ source_code, stdin, language_id }) {
  const createRes = await fetch(`${JUDGE0_BASE}/submissions?base64_encoded=false&wait=false`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ language_id, source_code, stdin: stdin || "" }),
  });
  if (!createRes.ok) throw new Error("Failed to create submission");
  const { token } = await createRes.json();

  const fields = "stdout,stderr,compile_output,status_id,status";
  let delay    = 150;
  for (let i = 0; i < 30; i++) {
    await new Promise((r) => setTimeout(r, delay));
    const res = await fetch(`${JUDGE0_BASE}/submissions/${token}?base64_encoded=false&fields=${fields}`);
    if (!res.ok) throw new Error("Failed to fetch submission result");
    const result = await res.json();
    if (result.status_id > 2) return result;
    delay = Math.min(800, delay + 100);
  }
  throw new Error("Judge0 timed out");
}

function warmUpCompiler() {
  if (sessionStorage.getItem("compileRace::warmedUp")) return;
  sessionStorage.setItem("compileRace::warmedUp", "1");
  getJavaLanguageId()
    .then((id) => runOnJudge0({
      source_code: `class Main{public static void main(String[]a){}}`,
      stdin: "",
      language_id: id,
    }))
    .catch(() => {});
}

// FIX: deduplicate quick vs full — only run full batch once if tests.length > 2
function splitTests(tests) {
  if (!Array.isArray(tests)) return { quick: [], full: [] };
  if (tests.length <= 2) return { quick: tests, full: [] }; // full is empty → skip second run
  return { quick: tests.slice(0, 2), full: tests };
}

/* =========================
   TEST RESULT UI
========================= */
function showTestResults(results) {
  if (!testStatusCard || !testStatusList) return;
  testStatusCard.style.display = "block";
  // FIX: use .test-diff-row class (renamed in style.css to avoid collision)
  testStatusList.innerHTML = results.map((r) => `
    <div class="test-result-row ${r.passed ? "pass" : "fail"}">
      <span>${r.passed ? "✅" : "❌"}</span>
      <span class="test-label">${escapeHtml(r.label)}</span>
      ${r.error ? `<span class="test-error">${escapeHtml(r.error)}</span>` : ""}
      ${(!r.passed && r.expected !== undefined && r.actual !== undefined && !r.error) ? `
        <div class="test-diff">
          <div class="test-diff-row"><span class="diff-key">Expected:</span><code class="diff-val expected">${escapeHtml(r.expected)}</code></div>
          <div class="test-diff-row"><span class="diff-key">Got:</span><code class="diff-val actual">${escapeHtml(r.actual)}</code></div>
        </div>
      ` : ""}
    </div>
  `).join("");
}

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
    const qs = window.QUESTIONS || [];
    if (currentIdx + 1 < qs.length) location.href = `race.html?q=${currentIdx + 1}`;
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
    p.style.setProperty("--d",     900 + Math.random() * 1100 + "ms");
    p.style.setProperty("--delay", Math.random() * 400 + "ms");
    p.style.background = colors[Math.floor(Math.random() * colors.length)];
    conf.appendChild(p);
  }
}

function showVictoryAnimation({ time, cps, best }) {
  if (!victoryOverlay) createVictoryOverlay();
  document.getElementById("vTime").textContent = `${time}s`;
  document.getElementById("vCps").textContent  = `${cps}`;
  document.getElementById("vBest").textContent = best !== null ? `${best}s` : "—";
  document.getElementById("victorySub").textContent = "All tests passed. GG 🎉";

  victoryOverlay.classList.add("show");
  launchConfetti(140);
  setTimeout(() => victoryOverlay.classList.remove("show"), 4500);
}

/* =========================
   RUN CODE
========================= */
let isRunning = false;

async function runBatch(batch, labelOffset = 0) {
  const batchResults = [];

  for (let i = 0; i < batch.length; i++) {
    const t = batch[i];
    let result;

    try {
      result = await runOnJudge0({
        source_code: prepareJavaSource(editor.value),
        stdin: t.stdin || "",
        language_id: javaLanguageId,
      });
    } catch (e) {
      console.error(e);
      batchResults.push({ passed: false, label: `Test ${labelOffset + i + 1}`, error: "Network/run error" });
      return { passed: false, results: batchResults };
    }

    const stdout     = normalizeOut(result.stdout);
    const stderr     = normalizeOut(result.stderr);
    const compileOut = normalizeOut(result.compile_output);
    const expected   = normalizeOut(t.out);

    if (compileOut) {
      const firstLine = compileOut.split("\n").find((l) => l.includes("error")) || compileOut.split("\n")[0];
      batchResults.push({ passed: false, label: `Test ${labelOffset + i + 1}`, error: `Compile: ${firstLine.trim().slice(0, 80)}` });
      return { passed: false, results: batchResults };
    }

    if (stderr) {
      const firstLine = stderr.split("\n")[0];
      batchResults.push({ passed: false, label: `Test ${labelOffset + i + 1}`, error: `Runtime: ${firstLine.slice(0, 80)}` });
      return { passed: false, results: batchResults };
    }

    const passed = stdout === expected;
    batchResults.push({ passed, label: `Test ${labelOffset + i + 1}`, expected, actual: stdout });

    if (!passed) return { passed: false, results: batchResults };
  }

  return { passed: true, results: batchResults };
}

function resetRunBtn() {
  const submitMain = runBtn?.querySelector(".sb-submit-main");
  const submitIcon = runBtn?.querySelector(".sb-submit-icon");
  if (runBtn) {
    runBtn.disabled = false;
    runBtn.classList.remove("loading");
  }
  if (submitMain) submitMain.textContent = "Submit Code";
  if (submitIcon) submitIcon.textContent = "▶";
}

async function runCode() {
  if (finished || !startTime || isRunning) return;
  isRunning = true;

  const submitMain = runBtn?.querySelector(".sb-submit-main");
  const submitIcon = runBtn?.querySelector(".sb-submit-icon");

  if (runBtn) {
    runBtn.disabled = true;
    runBtn.classList.add("loading");
  }
  if (submitMain) submitMain.textContent = "Running tests...";
  if (submitIcon) submitIcon.textContent = "⏳";

  if (testStatusCard) testStatusCard.style.display = "none";
  if (testStatusList) testStatusList.innerHTML = "";

  try {
    showToast("🔍 Connecting to compiler...", "#3b82f6");
    javaLanguageId = await getJavaLanguageId();
  } catch (e) {
    console.error(e);
    showToast(`❌ Compiler unavailable: ${e.message || e}`, "#ef4444");
    resetRunBtn();
    isRunning = false;
    return;
  }

  const allTests = currentQuestion.tests?.length
    ? currentQuestion.tests
    : [{ stdin: currentQuestion.stdin || "", out: currentQuestion.expectedOutput || "" }];

  const { quick, full } = splitTests(allTests);

  showToast(`🧪 Quick tests (${quick.length})...`, "#f59e0b");
  const quickRun = await runBatch(quick, 0);
  showTestResults(quickRun.results);

  if (!quickRun.passed) {
    showToast("❌ Failed quick tests", "#ef4444");
    resetRunBtn();
    isRunning = false;
    return;
  }

  // FIX: only run full batch if it's different from quick (i.e. more tests exist)
  if (full.length > 0) {
    showToast(`✅ Quick pass — Full tests (${full.length})...`, "var(--accent)");
    const fullRun = await runBatch(full, 0);
    showTestResults(fullRun.results);

    if (!fullRun.passed) {
      showToast("❌ Failed full tests", "#ef4444");
      resetRunBtn();
      isRunning = false;
      return;
    }
  }

  // ✅ All passed
  clearInterval(timerInterval);
  const finalTime = getElapsedSeconds();
  bgTimer.textContent = finalTime;

  finished  = true;
  isRunning = false;

  windowEl.classList.add("is-complete");
  windowEl.style.setProperty("--trace", "1");
  editor.disabled      = true;
  editor.style.opacity = "0.6";
  if (runBtn) runBtn.disabled = true;

  const cps = (totalCharsTyped / finalTime).toFixed(2);

  // FIX: use !== null so a bestTime of 0 is never incorrectly replaced
  if (bestTime === null || finalTime < bestTime) {
    bestTime = finalTime;
    localStorage.setItem(bestKey, String(finalTime));
  }

  showToast(`✅ Accepted · ${finalTime}s · ${cps} CPS`, "var(--accent)");
  showVictoryAnimation({ time: finalTime, cps, best: bestTime });
}

/* =========================
   CONTROLS
========================= */
if (runBtn) {
  runBtn.addEventListener("click", () => {
    if (!startTime && !finished) {
      showToast("✏️ Start typing your code first!", "#f59e0b");
      return;
    }
    runCode();
  });
}

if (restartBtn) {
  // FIX: replaced confirm() (blocked in iframes) with a two-click confirm pattern
  restartBtn.addEventListener("click", () => {
    if (restartBtn.dataset.confirm === "1") {
      restartBtn.dataset.confirm = "";
      restartBtn.textContent = "↺ Restart";

      clearInterval(timerInterval);
      startTime        = null;
      finished         = false;
      isRunning        = false;
      totalCharsTyped  = 0;

      bgTimer.textContent = "0";
      bgTimer.classList.remove("pulse-active");
      bgTimer.style.opacity = "0.5";

      windowEl.classList.remove("is-complete", "is-typing");
      windowEl.style.setProperty("--trace", "0");
      currentTrace = 0;
      targetTrace  = 0;

      editor.disabled      = false;
      editor.style.opacity = "1";
      if (runBtn) {
        runBtn.disabled = false;
        runBtn.classList.remove("loading");
      }

      if (testStatusCard) testStatusCard.style.display = "none";
      if (testStatusList) testStatusList.innerHTML = "";

      editor.value = buildStarterCode(currentQuestion);
      lastLength   = editor.value.length;

      updateHighlighting();
      updateWindowStats();
      updateActiveLine();
      updateLineNumbers();
      editor.focus();
    } else {
      restartBtn.dataset.confirm = "1";
      restartBtn.textContent = "Sure? Click again";
      restartBtn.style.borderColor = "#fbbf24";
      restartBtn.style.color = "#fbbf24";
      setTimeout(() => {
        restartBtn.dataset.confirm = "";
        restartBtn.textContent = "↺ Restart";
        restartBtn.style.borderColor = "";
        restartBtn.style.color = "";
      }, 2500);
    }
  });
}

if (homeBtn) homeBtn.addEventListener("click", () => { location.href = "index.html"; });

document.querySelectorAll(".logo-clickable").forEach((el) => {
  el.addEventListener("click", () => (location.href = "index.html"));
});

/* =========================
   ACCENT COLOR
   FIX: was defined twice — removed duplicate, kept single instance
========================= */
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

/* =========================
   ONLOAD
========================= */
window.addEventListener("load", () => {
  updateHighlighting();
  updateWindowStats();
  updateActiveLine();
  updateLineNumbers();
  createVictoryOverlay();
  editor.focus();
  warmUpCompiler();
});