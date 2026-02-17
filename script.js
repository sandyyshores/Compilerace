const editor = document.getElementById("editor");
const highlightContent = document.getElementById("highlight-content");
const bgTimer = document.getElementById("bg-timer");
const runBtn = document.getElementById("runBtn");
const restartBtn = document.getElementById("restartBtn");
const colorPicker = document.getElementById("colorPicker");
const highlightLayer = document.getElementById("highlight-layer"); // cached for performance
const windowEl = document.querySelector(".editor-window");

let victoryOverlay = null;

function createVictoryOverlay() {
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
    </div>
  `;
  document.body.appendChild(victoryOverlay);
}

function launchConfetti(count = 120) {
  const conf = document.getElementById("confetti");
  if (!conf) return;
  conf.innerHTML = "";

  for (let i = 0; i < count; i++) {
    const p = document.createElement("span");
    p.style.left = Math.random() * 100 + "vw";
    p.style.setProperty("--d", (900 + Math.random() * 1100) + "ms");
    p.style.transform = `translateY(-20px) rotate(${Math.random() * 360}deg)`;
    p.style.opacity = (0.7 + Math.random() * 0.3).toString();
    conf.appendChild(p);
  }
}

function showVictoryAnimation({ time, cps, best }) {
  if (!victoryOverlay) createVictoryOverlay();

  document.getElementById("vTime").textContent = `${time}s`;
  document.getElementById("vCps").textContent = `${cps}`;
  document.getElementById("vBest").textContent = best ? `${best}s` : "—";
  document.getElementById("victorySub").textContent = "Code matched perfectly. GG.";

  victoryOverlay.classList.add("show");
  launchConfetti(140);

  setTimeout(() => victoryOverlay.classList.remove("show"), 2600);
}

/* ===== Smooth Border Trace ===== */
let currentTrace = 0;
let targetTrace = 0;
let traceRAF = null;

function updateTraceProgress() {
  const targetChars = 140;
  targetTrace = Math.min(1, editor.value.length / targetChars);

  if (editor.value.trim().length > 0) {
    windowEl.classList.add("is-typing");
  } else {
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

let startTime = null;
let timerInterval = null;
let finished = false;
let isTabPressed = false;

/* ===== Performance + Stats ===== */
function debounce(fn, delay = 25) {
  let t;
  return (...args) => {
    clearTimeout(t);
    t = setTimeout(() => fn(...args), delay);
  };
}

let totalCharsTyped = 0;
let bestTime = parseInt(localStorage.getItem("compileRaceBestTime"), 10) || null;

/**
 * 🎨 SYNTAX HIGHLIGHTING ENGINE
 */
function updateHighlighting() {
  let code = editor.value;
  code = code.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  code = code.replace(/(\/\/.*)/g, '<span class="token comment">$1</span>');
  code = code.replace(/("(?:[^"\\&]|\\.)*")/g, '<span class="token string">$1</span>');

  const keywords = /\b(public|class|static|void|import|new|return|if|else|while|for|String|System|out|println)\b/g;

  const parts = code.split(/(<span.*?<\/span>)/g);
  code = parts.map(part => {
    if (part.startsWith('<span')) return part;
    return part.replace(keywords, '<span class="token keyword">$1</span>');
  }).join('');

  highlightContent.innerHTML = code;
}

/**
 * ⏱️ EVENT LISTENERS
 */
editor.addEventListener("input", debounce((e) => {
  if (e.inputType !== "deleteContentBackward") {
    totalCharsTyped++;
  }

  if (finished) return;

  if (!startTime && editor.value.trim().length > 0) {
    startTime = Date.now();

    if (timerInterval) clearInterval(timerInterval);

    timerInterval = setInterval(() => {
      if (finished) return;

      const newTime = Math.floor((Date.now() - startTime) / 1000);

      if (bgTimer.textContent !== newTime.toString()) {
        bgTimer.textContent = newTime;

        bgTimer.classList.remove('pulse-active');
        void bgTimer.offsetWidth;
        bgTimer.classList.add('pulse-active');
      }
    }, 1000);

    showToast("Race started! Go!", "var(--accent)");
  }

  updateTraceProgress();
  updateHighlighting();
}));

editor.addEventListener("scroll", () => {
  highlightLayer.scrollTop = editor.scrollTop;
  highlightLayer.scrollLeft = editor.scrollLeft;
});

/**
 * ⌨️ KEYBOARD LOGIC (SHORTSCUTS & SMART EDITING)
 */
editor.addEventListener("keyup", (e) => {
  if (e.key === "Tab") isTabPressed = false;
});

editor.addEventListener("keydown", (e) => {
  if (e.key === "Tab") isTabPressed = true;
  if (finished) return;

  const start = editor.selectionStart;
  const end = editor.selectionEnd;

  if (isTabPressed && e.key === "Enter") {
    e.preventDefault();
    if (confirm("Restart the challenge?")) location.reload();
    return;
  }

  if (e.ctrlKey && e.key === "Enter") {
    e.preventDefault();
    runCode();
    return;
  }

  const nextChar = editor.value.substring(start, start + 1);
  const closers = ['}', ')', ']', '"', "'"];
  if (closers.includes(e.key) && nextChar === e.key) {
    e.preventDefault();
    editor.selectionStart = editor.selectionEnd = start + 1;
    return;
  }

  const pairs = { '{': '}', '(': ')', '[': ']', '"': '"', "'": "'" };
  if (pairs[e.key]) {
    e.preventDefault();
    editor.value = editor.value.substring(0, start) + e.key + pairs[e.key] + editor.value.substring(end);
    editor.selectionStart = editor.selectionEnd = start + 1;
    updateHighlighting();
    return;
  }

  if (e.key === "Enter") {
    const charBefore = editor.value.substring(start - 1, start);
    const charAfter = editor.value.substring(start, start + 1);
    if (charBefore === "{" && charAfter === "}") {
      e.preventDefault();
      const indentation = "    ";
      editor.value = editor.value.substring(0, start) + "\n" + indentation + "\n" + editor.value.substring(end);
      editor.selectionStart = editor.selectionEnd = start + indentation.length + 1;
      updateHighlighting();
      return;
    }
  }

  if (e.key === "Tab") {
    e.preventDefault();
    editor.value = editor.value.substring(0, start) + "    " + editor.value.substring(end);
    editor.selectionStart = editor.selectionEnd = start + 4;
    updateHighlighting();
  }
});
/* =========================
   🚫 DISABLE PASTE (RACE MODE)
========================= */

// Block keyboard paste (Ctrl+V / Cmd+V)
editor.addEventListener("keydown", (e) => {
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "v") {
        e.preventDefault();
        showToast("🚫 Paste disabled ;/", "#ef4444");
    }
});

// Block actual paste event (covers right-click & mobile)
editor.addEventListener("paste", (e) => {
    e.preventDefault();
    showToast("🚫 Paste disabled ;/", "#ef4444");
});

// Disable context menu inside editor (right-click menu)
editor.addEventListener("contextmenu", (e) => {
    e.preventDefault();
});
editor.addEventListener("drop", (e) => {
    e.preventDefault();
});

function runCode() {
  if (finished || !startTime) return;
  const userCode = editor.value.replace(/\s+/g, '');
  const requiredLine = 'System.out.println("Hello World");'.replace(/\s+/g, '');

  if (userCode.includes(requiredLine)) {
    finished = true;
    clearInterval(timerInterval);

    // Smoothly lock border to full + final outline state
    windowEl.classList.add("is-complete");
    windowEl.style.setProperty("--trace", "1");
    currentTrace = 1;
    targetTrace = 1;

    editor.disabled = true;
    editor.style.opacity = "0.5";
    windowEl.style.borderColor = "var(--accent)";
    windowEl.style.boxShadow = "0 0 20px var(--accent-glow)";

    const time = Math.max(1, parseInt(bgTimer.textContent, 10));
    const cps = (totalCharsTyped / time).toFixed(2);

    if (!bestTime || time < bestTime) {
      bestTime = time;
      localStorage.setItem("compileRaceBestTime", time);
    }

    showToast(`🏆 ${time}s • ${cps} CPS • Best: ${bestTime}s`, "var(--accent)");
    showVictoryAnimation({ time, cps, best: bestTime });

  } else {
    windowEl.classList.add('shake');
    setTimeout(() => windowEl.classList.remove('shake'), 400);
    showToast("❌ Code mismatch! Try again.", "#ef4444");
  }
}

colorPicker.addEventListener("input", (e) => {
  const color = e.target.value;
  document.documentElement.style.setProperty("--accent", color);
  document.documentElement.style.setProperty("--accent-glow", color + "44");
});

runBtn.addEventListener("click", runCode);

restartBtn.addEventListener("click", () => {
  if (!confirm("Restart the challenge?")) return;

  clearInterval(timerInterval);
  startTime = null;
  finished = false;
  totalCharsTyped = 0;

  bgTimer.textContent = "0";
  bgTimer.classList.remove("pulse-active");

  // Reset trace state
  windowEl.classList.remove("is-complete");
  windowEl.classList.remove("is-typing");
  windowEl.style.setProperty("--trace", "0");
  currentTrace = 0;
  targetTrace = 0;

  editor.disabled = false;
  editor.style.opacity = "1";
  editor.value = `public class Main {
    public static void main(String[] args) {
        
    }
}`;

  windowEl.style.borderColor = "";
  windowEl.style.boxShadow = "";

  updateHighlighting();
  editor.focus();
});

function showToast(msg, color = "var(--accent)") {
  const toast = document.getElementById("output-toast");
  if (!toast) return;

  toast.textContent = msg;
  toast.style.borderLeftColor = color;

  toast.classList.add("show");

  clearTimeout(toast.hideTimer);
  toast.hideTimer = setTimeout(() => {
    toast.classList.remove("show");
  }, 2500);
}

window.onload = () => {
  updateHighlighting();
  createVictoryOverlay();
  editor.focus();
};
