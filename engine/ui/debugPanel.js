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

const GABOMA_DEBUG = true;

let _panel      = null;
let _btn        = null;
let _open       = false;
let _rafId      = null;

// ─── Public API ───────────────────────────────────────────────────────────────

export function initDebugPanel() {
  if (!GABOMA_DEBUG) return;

  _createButton();
  _createPanel();

  // Auto-refresh while open
  _startRefreshLoop();
}

// ─── Init helpers ─────────────────────────────────────────────────────────────

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

  const opacityRow = document.createElement("div");
  opacityRow.id = "gaboma-debug-opacity-row";

  const opacityLabel = document.createElement("label");
  opacityLabel.textContent = "opacity";
  opacityLabel.htmlFor = "gaboma-debug-opacity-slider";

  const opacitySlider = document.createElement("input");
  opacitySlider.type = "range";
  opacitySlider.id = "gaboma-debug-opacity-slider";
  opacitySlider.min = "30";
  opacitySlider.max = "100";
  opacitySlider.value = "96";  // default: near-opaque (matches background rgba)
  opacitySlider.oninput = () => {
    _panel.style.opacity = (opacitySlider.value / 100).toFixed(2);
  };

  opacityRow.appendChild(opacityLabel);
  opacityRow.appendChild(opacitySlider);

  _panel.appendChild(header);
  _panel.appendChild(body);
  _panel.appendChild(opacityRow);
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
  function loop() {
    if (_open) _refresh();
    _rafId = requestAnimationFrame(loop);
  }
  _rafId = requestAnimationFrame(loop);
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

  // ── Chapter ──────────────────────────────────────────────────────
  sections.push(_sectionChapter(progress));

  // ── Variables ────────────────────────────────────────────────────
  sections.push(_sectionVars(progress, story));

  // ── Items ────────────────────────────────────────────────────────
  sections.push(_sectionItems(progress));

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

  body.innerHTML = sections.join("");
}

// ─── Section builders ─────────────────────────────────────────────────────────

function _sectionChapter(progress) {
  const chapterId = progress.currentChapterId ?? "—";
  const prev      = progress.previousChapterId ?? "—";
  const gameOver  = progress.gameOver ? " 💀 GAME OVER" : "";
  return `
    <div class="dbg-section">
      <div class="dbg-section-title">Chapter${gameOver}</div>
      <div class="dbg-row">
        <span class="dbg-key">current</span>
        <span class="dbg-val dbg-chapter">${chapterId}</span>
      </div>
      <div class="dbg-row">
        <span class="dbg-key">previous</span>
        <span class="dbg-val dbg-chapter">${prev}</span>
      </div>
    </div>`;
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

export const DebugPanel = { initDebugPanel };
