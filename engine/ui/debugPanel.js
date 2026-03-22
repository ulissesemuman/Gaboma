/**
 * debugPanel.js
 *
 * Real-time debug panel for Gaboma authors.
 * Shows variables, items, active combats, and current chapter.
 *
 * HARDCODED FLAG: set GABOMA_DEBUG = false to disable entirely.
 * In the future, this will be controlled by the visual editor.
 */

import state   from "../core/state.js";
import { Reader } from "../core/reader.js";
import { renderReader } from "./uiManager.js";

const GABOMA_DEBUG = true;

let _panel      = null;
let _btn        = null;
let _open       = false;
let _rafId      = null;

// ─── Public API ───────────────────────────────────────────────────────────────

export function initDebugPanel() {
  if (!GABOMA_DEBUG) return;

  _injectStyles();
  _createButton();
  _createPanel();

  // Auto-refresh while open
  _startRefreshLoop();


}

// ─── Init helpers ─────────────────────────────────────────────────────────────

function _injectStyles() {
  if (document.getElementById("gaboma-debug-styles")) return;

  const style = document.createElement("style");
  style.id = "gaboma-debug-styles";
  style.textContent = `
    #gaboma-debug-btn {
      position: fixed;
      bottom: 60px;
      left: 8px;
      z-index: 9000;
      width: 32px;
      height: 32px;
      border-radius: 50%;
      border: none;
      background: rgba(30,30,30,0.82);
      color: #7fff7f;
      font-size: 15px;
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
      box-shadow: 0 2px 6px rgba(0,0,0,0.4);
      transition: background 0.15s;
    }

    #gaboma-debug-btn:hover {
      background: rgba(50,50,50,0.95);
    }

    #gaboma-debug-panel {
      position: fixed;
      bottom: 100px;
      left: 8px;
      z-index: 8999;
      width: 280px;
      max-height: 60vh;
      background: rgba(18,18,18,0.96);
      color: #c8f5c8;
      font-family: monospace;
      font-size: 11px;
      border-radius: 8px;
      box-shadow: 0 4px 20px rgba(0,0,0,0.6);
      display: none;
      flex-direction: column;
      overflow: hidden;
    }

    #gaboma-debug-panel.open {
      display: flex;
    }

    #gaboma-debug-header {
      padding: 6px 10px;
      background: rgba(0,0,0,0.4);
      font-weight: bold;
      font-size: 12px;
      color: #7fff7f;
      letter-spacing: 0.05em;
      flex-shrink: 0;
    }

    #gaboma-debug-body {
      overflow-y: auto;
      padding: 8px 10px;
      flex: 1;
    }

    .dbg-section {
      margin-bottom: 10px;
    }

    .dbg-section-title {
      color: #ffd700;
      font-weight: bold;
      margin-bottom: 3px;
      border-bottom: 1px solid rgba(255,215,0,0.2);
      padding-bottom: 2px;
    }

    .dbg-row {
      display: flex;
      justify-content: space-between;
      gap: 8px;
      padding: 1px 0;
      color: #c8f5c8;
    }

    .dbg-key {
      opacity: 0.75;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
      max-width: 55%;
    }

    .dbg-val {
      color: #7fdcff;
      text-align: right;
      white-space: nowrap;
    }

    .dbg-val.bool-true  { color: #7fff7f; }
    .dbg-val.bool-false { color: #ff7f7f; }
    .dbg-val.zero       { opacity: 0.35; }

    .dbg-edit-input {
      appearance: none;
      -webkit-appearance: none;
      background: rgba(0,0,0,0.35);
      border: 1px solid rgba(255,255,255,0.2);
      border-radius: 3px;
      color: #7fdcff;
      font-size: 11px;
      font-family: monospace;
      text-align: right;
      width: 60px;
      padding: 1px 4px;
      outline: none;
    }
    .dbg-edit-input:focus {
      border-color: rgba(127,220,255,0.6);
      background: rgba(0,0,0,0.5);
    }
    /* Style number spinner arrows to match font color */
    .dbg-edit-input::-webkit-inner-spin-button,
    .dbg-edit-input::-webkit-outer-spin-button {
      opacity: 0.5;
      filter: invert(1);
    }

    .dbg-edit-select,
    .dbg-chapter-select {
      background: rgba(0,0,0,0.35);
      border: 1px solid rgba(255,255,255,0.2);
      border-radius: 3px;
      font-size: 11px;
      font-family: monospace;
      padding: 1px 4px;
      outline: none;
      cursor: pointer;
      color-scheme: dark;
    }
    .dbg-edit-select { color: #7fff7f; }
    .dbg-chapter-select { color: #ffb347; max-width: 140px; }
    .dbg-edit-select:focus,
    .dbg-chapter-select:focus {
      border-color: rgba(255,255,255,0.45);
      background: rgba(0,0,0,0.5);
    }

    .dbg-val-max {
      color: rgba(127,220,255,0.45);
      font-size: 10px;
      margin-left: 2px;
    }

    .dbg-chapter {
      color: #ffb347;
      word-break: break-all;
    }

    .dbg-empty {
      opacity: 0.4;
      font-style: italic;
    }
  `;
  document.head.appendChild(style);
}

function _createButton() {
  _btn = document.createElement("button");
  _btn.id = "gaboma-debug-btn";
  _btn.title = "Debug panel";
  _btn.textContent = "🐛";
  _btn.onclick = _togglePanel;
  document.body.appendChild(_btn);
}

function _createPanel() {
  _panel = document.createElement("div");
  _panel.id = "gaboma-debug-panel";

  const header = document.createElement("div");
  header.id = "gaboma-debug-header";
  header.textContent = "⚙ Gaboma Debug";

  const body = document.createElement("div");
  body.id = "gaboma-debug-body";

  _panel.appendChild(header);
  _panel.appendChild(body);
  document.body.appendChild(_panel);
}

// ─── Toggle ───────────────────────────────────────────────────────────────────

function _togglePanel() {
  _open = !_open;
  _panel.classList.toggle("open", _open);
  if (_open) _refresh();
}

// ─── Refresh loop ─────────────────────────────────────────────────────────────

function _startRefreshLoop() {
  setInterval(() => {
    if (!_open) return;

    // Pause refresh while any input/select inside the panel has focus
    const panel = document.getElementById("gaboma-debug-panel");
    if (panel && panel.querySelector(":focus")) return;

    _refresh();
  }, 800);
}

function _refresh() {
  const body = document.getElementById("gaboma-debug-body");
  if (!body) return;

  const bookId = state.currentBookId;
  if (!bookId) {
    body.innerHTML = '<span class="dbg-empty">No book loaded</span>';
    return;
  }

  const progress = state.bookState[bookId]?.progress;
  if (!progress) {
    body.innerHTML = '<span class="dbg-empty">No progress</span>';
    return;
  }

  const story = Reader.getCurrentStory?.();

  const sections = [];

  // ── Equipped ─────────────────────────────────────────────────────
  if (Object.keys(progress.equipped ?? {}).length > 0) {
    sections.push(_sectionEquipped(progress));
  }

  // ── Combat ───────────────────────────────────────────────────────
  const activeCombats = Object.values(progress.combat ?? {})
    .filter(c => c.status === "active");
  if (activeCombats.length > 0) {
    sections.push(_sectionCombat(activeCombats));
  }

  // DOM-based sections first (editable, order matters)
  body.innerHTML = "";
  body.appendChild(_sectionChapter(progress));
  body.appendChild(_buildVarsSection(progress, story));
  body.appendChild(_buildItemsSection(progress));

  // Non-editable sections via innerHTML appended after
  const nonEditable = document.createElement("div");
  nonEditable.innerHTML = sections.join("");
  while (nonEditable.firstChild) body.appendChild(nonEditable.firstChild);
}

// ─── Section builders ─────────────────────────────────────────────────────────

function _sectionChapter(progress) {
  const chapterId = progress.currentChapterId ?? "—";
  const prev      = progress.previousChapterId ?? "—";
  const gameOver  = progress.gameOver ? " 💀 GAME OVER" : "";
  const story     = Reader.getCurrentStory?.();
  const chapters  = story?.chapters ? Object.keys(story.chapters) : [];

  // Build section as DOM to avoid onchange firing on innerHTML refresh
  const section = document.createElement("div");
  section.className = "dbg-section";

  const titleEl = document.createElement("div");
  titleEl.className = "dbg-section-title";
  titleEl.textContent = `Chapter${gameOver}`;
  section.appendChild(titleEl);

  const rowCurrent = document.createElement("div");
  rowCurrent.className = "dbg-row";
  const keyEl = document.createElement("span");
  keyEl.className = "dbg-key";
  keyEl.textContent = "current";
  rowCurrent.appendChild(keyEl);

  const sel = document.createElement("select");
  sel.className = "dbg-chapter-select";
  chapters.forEach(id => {
    const o = document.createElement("option");
    o.value = id;
    o.textContent = id;
    if (id === chapterId) o.selected = true;
    sel.appendChild(o);
  });
  sel.onchange = () => {
    const bookId = state.currentBookId;
    if (!bookId) return;
    // Force previousChapterId to null so goToChapter doesn't short-circuit
    state.bookState[bookId].progress.previousChapterId = null;
    renderReader(sel.value);
  };
  rowCurrent.appendChild(sel);
  section.appendChild(rowCurrent);

  const rowPrev = document.createElement("div");
  rowPrev.className = "dbg-row";
  rowPrev.innerHTML = `<span class="dbg-key">previous</span><span class="dbg-val dbg-chapter">${prev}</span>`;
  section.appendChild(rowPrev);

  return section;
}

function _sectionVars(progress, story) {
  const vars = progress.variables ?? {};
  const keys = Object.keys(vars);
  if (keys.length === 0) {
    return `<div class="dbg-section">
      <div class="dbg-section-title">Variables</div>
      <div class="dbg-empty">none</div>
    </div>`;
  }

  const rows = keys.map(k => {
    const val     = vars[k];
    const isBool  = typeof val === "boolean";
    const isZero  = val === 0;
    const cls     = isBool ? (val ? "bool-true" : "bool-false") : (isZero ? "zero" : "");
    const display = isBool ? (val ? "true" : "false") : String(val);

    // Show max if defined
    const maxOverride = progress.varMaxOverrides?.[k];
    const defMax      = story?.variables?.[k]?.max;
    const max         = maxOverride ?? defMax;
    const maxStr      = max !== undefined && !isBool ? ` / ${max}` : "";

    return `<div class="dbg-row">
      <span class="dbg-key" title="${k}">${k}</span>
      <span class="dbg-val ${cls}">${display}${maxStr}</span>
    </div>`;
  }).join("");

  return `<div class="dbg-section">
    <div class="dbg-section-title">Variables</div>
    ${rows}
  </div>`;
}

function _sectionItems(progress) {
  const items = progress.items ?? {};
  const keys  = Object.keys(items).filter(k => items[k] !== 0);
  if (keys.length === 0) {
    return `<div class="dbg-section">
      <div class="dbg-section-title">Items</div>
      <div class="dbg-empty">none</div>
    </div>`;
  }

  const rows = keys.map(k => `
    <div class="dbg-row">
      <span class="dbg-key" title="${k}">${k}</span>
      <span class="dbg-val">${items[k]}</span>
    </div>`).join("");

  return `<div class="dbg-section">
    <div class="dbg-section-title">Items</div>
    ${rows}
  </div>`;
}

function _sectionEquipped(progress) {
  const equipped = progress.equipped ?? {};
  const rows = Object.entries(equipped)
    .filter(([, slots]) => slots.length > 0)
    .map(([cat, slots]) => `
      <div class="dbg-row">
        <span class="dbg-key">${cat}</span>
        <span class="dbg-val">${slots.join(", ")}</span>
      </div>`).join("");

  return `<div class="dbg-section">
    <div class="dbg-section-title">Equipped</div>
    ${rows}
  </div>`;
}

function _sectionCombat(combats) {
  const rows = combats.map(c => `
    <div class="dbg-row">
      <span class="dbg-key" title="${c.instanceId}">${c.instanceId}</span>
      <span class="dbg-val">${c.hp} / ${c.maxHp} HP  R${c.round}</span>
    </div>`).join("");

  return `<div class="dbg-section">
    <div class="dbg-section-title">Combat (active)</div>
    ${rows}
  </div>`;
}

// ─── Editable sections (DOM) ──────────────────────────────────────────────────

function _buildVarsSection(progress, story) {
  const vars = progress.variables ?? {};
  const keys = Object.keys(vars);

  const section = document.createElement("div");
  section.className = "dbg-section";

  const title = document.createElement("div");
  title.className = "dbg-section-title";
  title.textContent = "Variables";
  section.appendChild(title);

  if (keys.length === 0) {
    const empty = document.createElement("div");
    empty.className = "dbg-empty";
    empty.textContent = "none";
    section.appendChild(empty);
    return section;
  }

  keys.forEach(k => {
    const val    = vars[k];
    const isBool = typeof val === "boolean";
    const bookId = state.currentBookId;

    const row = document.createElement("div");
    row.className = "dbg-row";

    const keyEl = document.createElement("span");
    keyEl.className = "dbg-key";
    keyEl.title = k;
    keyEl.textContent = k;
    row.appendChild(keyEl);

    if (isBool) {
      // Boolean: select true/false
      const sel = document.createElement("select");
      sel.className = "dbg-val dbg-edit-select";
      ["true", "false"].forEach(opt => {
        const o = document.createElement("option");
        o.value = opt;
        o.textContent = opt;
        if (String(val) === opt) o.selected = true;
        sel.appendChild(o);
      });
      sel.onchange = () => {
        progress.variables[k] = sel.value === "true";
        state.save();
      };
      row.appendChild(sel);
    } else {
      // Numeric: inline input
      const maxOverride = progress.varMaxOverrides?.[k];
      const defMax      = story?.variables?.[k]?.max;
      const max         = maxOverride ?? defMax;
      const maxStr      = max !== undefined ? ` / ${max}` : "";

      const input = document.createElement("input");
      input.type = "number";
      input.className = "dbg-val dbg-edit-input";
      input.value = val;
      if (max !== undefined) input.max = max;

      const commit = () => {
        const parsed = Number(input.value);
        if (!isNaN(parsed)) {
          progress.variables[k] = parsed;
          state.save();
        }
      };
      input.addEventListener("blur", commit);
      input.addEventListener("keydown", e => { if (e.key === "Enter") { commit(); input.blur(); } });
      row.appendChild(input);

      if (maxStr) {
        const maxEl = document.createElement("span");
        maxEl.className = "dbg-val-max";
        maxEl.textContent = maxStr;
        row.appendChild(maxEl);
      }
    }

    section.appendChild(row);
  });

  return section;
}

function _buildItemsSection(progress) {
  const items = progress.items ?? {};
  const keys  = Object.keys(items);

  const section = document.createElement("div");
  section.className = "dbg-section";

  const title = document.createElement("div");
  title.className = "dbg-section-title";
  title.textContent = "Items";
  section.appendChild(title);

  if (keys.length === 0) {
    const empty = document.createElement("div");
    empty.className = "dbg-empty";
    empty.textContent = "none";
    section.appendChild(empty);
    return section;
  }

  keys.forEach(k => {
    const row = document.createElement("div");
    row.className = "dbg-row";

    const keyEl = document.createElement("span");
    keyEl.className = "dbg-key";
    keyEl.title = k;
    keyEl.textContent = k;
    row.appendChild(keyEl);

    const input = document.createElement("input");
    input.type = "number";
    input.className = "dbg-val dbg-edit-input";
    input.value = items[k];
    input.min = 0;

    const commit = () => {
      const parsed = parseInt(input.value, 10);
      if (!isNaN(parsed) && parsed >= 0) {
        progress.items[k] = parsed;
        state.save();
      }
    };
    input.addEventListener("blur", commit);
    input.addEventListener("keydown", e => { if (e.key === "Enter") { commit(); input.blur(); } });
    row.appendChild(input);

    section.appendChild(row);
  });

  return section;
}


export const DebugPanel = { initDebugPanel };
