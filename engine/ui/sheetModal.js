/**
 * sheetModal.js
 *
 * Character sheet modal — two variants:
 *
 *   SheetModal.openFull({ readOnly?, allowSelling?, sellCurrency? })
 *     Full sheet: character portrait, variables (showInSheet), full inventory.
 *
 *   SheetModal.openConsumables({ readOnly?, allowSelling?, sellCurrency? })
 *     Simplified sheet: consumable items only. Ideal for in-combat use.
 *
 * Layout (full):
 *   ┌──────────────────────────────────────┐
 *   │  [Portrait]  │  Variables (scroll)   │
 *   │──────────────────────────────────────│
 *   │  Inventory (scroll)                  │
 *   │  [item row]  qty  [actions...]       │
 *   └──────────────────────────────────────┘
 *
 * Item actions per category type:
 *   consumable : Use | Drop* | Sell*
 *   equippable : Equip / Unequip | Drop* | Sell*
 *   (* hidden when readOnly / noDrop / allowSelling not set)
 */

import state from "../core/state.js";
import { Reader } from "../core/reader.js";
import { Engine } from "../core/engine.js";
import { tb } from "../i18n/bookI18n.js";
import { safeT } from "../utils/i18nUtils.js";
import { t } from "../i18n/globalI18n.js";


// ─── State ────────────────────────────────────────────────────────────────────

let _opts = {};
let _mode = "full"; // "full" | "consumables"
let _expandedItemId = null;

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Opens the full character sheet.
 * @param {{ readOnly?: boolean, allowSelling?: boolean, sellCurrency?: string }} opts
 */
function openFull(opts = {}) {
  _mode = "full";
  _open(opts);
}

/**
 * Opens the simplified consumables-only sheet.
 * @param {{ readOnly?: boolean, allowSelling?: boolean, sellCurrency?: string }} opts
 */
function openConsumables(opts = {}) {
  _mode = "consumables";
  _open(opts);
}

function close() {
  const overlay = document.getElementById("sheet-overlay");
  if (!overlay) return;

  overlay.classList.remove("visible");

  const onClose = _opts._onClose ?? null;

  setTimeout(() => {
    overlay.remove();
    if (onClose) onClose();
  }, 260);
}

// ─── Internal ─────────────────────────────────────────────────────────────────

function _open(opts) {
  _opts = opts ?? {};
  _expandedItemId = null;

  const overlay = _getOrCreateOverlay();
  _render(overlay);

  requestAnimationFrame(() => overlay.classList.add("visible"));
}

function _getOrCreateOverlay() {
  let overlay = document.getElementById("sheet-overlay");

  if (!overlay) {
    overlay = document.createElement("div");
    overlay.id = "sheet-overlay";

    const modal = document.createElement("div");
    modal.id = "sheet-modal";
    overlay.appendChild(modal);
    document.body.appendChild(overlay);

    // Close on backdrop click
    overlay.addEventListener("click", e => {
      if (e.target === overlay) close();
    });
  }

  return overlay;
}

function _render(overlay) {
  const modal = overlay.querySelector("#sheet-modal");
  modal.innerHTML = "";

  const bookId   = state.currentBookId;
  const progress = state.bookState[bookId].progress;
  const story    = Reader.getCurrentStory();

  // ── Title ────────────────────────────────────────────────────────
  const titleEl = document.createElement("div");
  titleEl.className = "sheet-title";
  titleEl.textContent =
    _mode === "consumables"
      ? (safeT("sheet.itemsTitle") ?? t("sheet.itemsTitle") ?? "Items")
      : (safeT("sheet.title") ?? t("sheet.title") ?? "Character Sheet");
  modal.appendChild(titleEl);

  // ── Full mode: portrait + variables ──────────────────────────────
  if (_mode === "full") {
    const topSection = document.createElement("div");
    topSection.className = "sheet-top";

    topSection.appendChild(_buildPortrait(bookId));
    topSection.appendChild(_buildVariables(progress, story));

    modal.appendChild(topSection);

    const divider = document.createElement("hr");
    divider.className = "sheet-divider";
    modal.appendChild(divider);
  }

  // ── Inventory ────────────────────────────────────────────────────
  const invLabel = document.createElement("div");
  invLabel.className = "sheet-inventory-label";
  invLabel.textContent = safeT("sheet.inventory") ?? t("sheet.inventory") ?? "Inventory";
  modal.appendChild(invLabel);

  modal.appendChild(_buildInventory(progress, story));

  // ── Close button ─────────────────────────────────────────────────
  const closeBtn = document.createElement("button");
  closeBtn.className = "sheet-close-btn";
  closeBtn.textContent = t("ui.continue") ?? "Close";
  closeBtn.onclick = close;
  modal.appendChild(closeBtn);
}

// ─── Portrait ─────────────────────────────────────────────────────────────────

function _buildPortrait(bookId) {
  const wrap = document.createElement("div");
  wrap.className = "sheet-portrait-wrap";

  const imgPath = `books/${bookId}/assets/character/char_img.png`;

  const img = document.createElement("img");
  img.className = "sheet-portrait";
  img.alt = "";
  img.src = imgPath;
  img.onerror = () => {
    // Replace with silhouette SVG placeholder
    img.remove();
    wrap.innerHTML = `
      <svg class="sheet-portrait-placeholder" viewBox="0 0 64 64" fill="none"
           xmlns="http://www.w3.org/2000/svg">
        <circle cx="32" cy="22" r="12" fill="currentColor"/>
        <path d="M8 58c0-13.255 10.745-24 24-24s24 10.745 24 24" fill="currentColor"/>
      </svg>
    `;
  };

  wrap.appendChild(img);
  return wrap;
}

// ─── Variables ────────────────────────────────────────────────────────────────

function _buildVariables(progress, story) {
  const wrap = document.createElement("div");
  wrap.className = "sheet-vars";

  const varDefs = story?.variables ?? {};
  const sheetVars = Object.entries(varDefs).filter(([, def]) => def.showInSheet);

  if (sheetVars.length === 0) {
    const empty = document.createElement("div");
    empty.className = "sheet-empty";
    empty.style.fontSize = "12px";
    empty.textContent = safeT("sheet.noVars") ?? "";
    wrap.appendChild(empty);
    return wrap;
  }

  sheetVars.forEach(([varId, def]) => {
    const value = progress.variables[varId];

    const row = document.createElement("div");
    row.className = "sheet-var-row";

    const nameEl = document.createElement("div");
    nameEl.className = "sheet-var-name";
    nameEl.textContent = tb(def.label ?? varId) || varId;
    row.appendChild(nameEl);

    if (typeof value === "boolean") {
      // Boolean: show checkmark / cross
      const valEl = document.createElement("div");
      valEl.className = "sheet-var-value";
      valEl.textContent = value ? "✓" : "✗";
      valEl.style.color = value ? "#27ae60" : "#c0392b";
      row.appendChild(valEl);
    } else {
      // Numeric: bar + value/max
      const effectiveMax = _effectiveMax(progress, def);

      if (effectiveMax !== Infinity) {
        const pct = Math.max(0, Math.min(100, (value / effectiveMax) * 100));
        const colorClass = pct > 60 ? "high" : pct > 25 ? "mid" : "low";

        const track = document.createElement("div");
        track.className = "sheet-var-bar-track";

        const fill = document.createElement("div");
        fill.className = `sheet-var-bar-fill ${colorClass}`;
        fill.style.width = `${pct}%`;
        track.appendChild(fill);
        row.appendChild(track);
      }

      const valEl = document.createElement("div");
      valEl.className = "sheet-var-value";
      valEl.textContent = effectiveMax !== Infinity
        ? `${value} / ${effectiveMax}`
        : String(value);
      row.appendChild(valEl);
    }

    wrap.appendChild(row);
  });

  return wrap;
}

// ─── Inventory ────────────────────────────────────────────────────────────────

function _buildInventory(progress, story) {
  const wrap = document.createElement("div");
  wrap.className = "sheet-inventory";

  const itemDefs      = story?.items?.items ?? {};
  const categoryDefs  = story?.items?.categories ?? {};
  const ownedItems    = Object.entries(progress.items).filter(([, qty]) => qty > 0);

  // Filter to consumables only in simplified mode
  const filtered = _mode === "consumables"
    ? ownedItems.filter(([id]) => {
        const catId  = itemDefs[id]?.category;
        const catDef = categoryDefs[catId];
        return _categoryType(catDef) === "consumable";
      })
    : ownedItems;

  if (filtered.length === 0) {
    const empty = document.createElement("div");
    empty.className = "sheet-empty";
    empty.textContent = safeT("sheet.emptyInventory") ?? t("sheet.emptyInventory") ?? "No items.";
    wrap.appendChild(empty);
    return wrap;
  }

  filtered.forEach(([itemId, qty]) => {
    const itemDef = itemDefs[itemId];
    if (!itemDef) return;

    const catId  = itemDef.category;
    const catDef = categoryDefs[catId];
    const type   = _categoryType(catDef);

    const isStackable = _isStackable(catDef, itemDef);
    const isEquipped  = (progress.equipped[catId] ?? []).includes(itemId);
    const hasNoDrop   = (itemDef.flags ?? []).includes("noDrop");

    const actions = _buildActionList(itemId, itemDef, type, isEquipped, hasNoDrop);
    const hasActions = !_opts.readOnly && actions.length > 0;
    const isExpanded = _expandedItemId === itemId && hasActions;

    // ── Item row ──────────────────────────────────────────────────
    const row = document.createElement("div");
    row.className = "sheet-item-row" + (hasActions ? " has-actions" : "") + (isExpanded ? " expanded" : "");

    const nameEl = document.createElement("div");
    nameEl.className = "sheet-item-name";
    nameEl.textContent = tb(itemDef.label ?? itemId) || itemId;
    row.appendChild(nameEl);

    if (isEquipped) {
      const badge = document.createElement("div");
      badge.className = "sheet-item-badge";
      badge.textContent = safeT("sheet.equipped") ?? t("sheet.equipped") ?? "Equipped";
      row.appendChild(badge);
    }

    if (isStackable && qty > 1) {
      const qtyEl = document.createElement("div");
      qtyEl.className = "sheet-item-qty";
      qtyEl.textContent = `×${qty}`;
      row.appendChild(qtyEl);
    }

    if (hasActions) {
      const chevron = document.createElement("div");
      chevron.className = "sheet-item-chevron";
      chevron.textContent = "▼";
      row.appendChild(chevron);

      row.onclick = () => {
        _expandedItemId = isExpanded ? null : itemId;
        const overlay = document.getElementById("sheet-overlay");
        _render(overlay);
      };
    }

    wrap.appendChild(row);

    // ── Action tray (expanded) ────────────────────────────────────
    if (isExpanded) {
      const tray = document.createElement("div");
      tray.className = "sheet-item-actions";

      actions.forEach(action => {
        const btn = document.createElement("button");
        btn.className = "sheet-item-action-btn" + (action.danger ? " danger" : "");
        btn.textContent = action.label;
        btn.onclick = () => _handleItemAction(action.id, itemId, itemDef, type);
        tray.appendChild(btn);
      });

      wrap.appendChild(tray);
    }
  });

  return wrap;
}

// ─── Action list builder ──────────────────────────────────────────────────────

function _buildActionList(itemId, itemDef, type, isEquipped, hasNoDrop) {
  const actions = [];

  if (type === "consumable") {
    actions.push({
      id: "use",
      label: safeT("sheet.action.use") ?? t("sheet.action.use") ?? "Use"
    });
  }

  if (type === "equippable") {
    if (isEquipped) {
      actions.push({
        id: "unequip",
        label: safeT("sheet.action.unequip") ?? t("sheet.action.unequip") ?? "Unequip"
      });
    } else {
      actions.push({
        id: "equip",
        label: safeT("sheet.action.equip") ?? t("sheet.action.equip") ?? "Equip"
      });
    }
  }

  if (!hasNoDrop) {
    actions.push({
      id: "drop",
      label: safeT("sheet.action.drop") ?? t("sheet.action.drop") ?? "Drop",
      danger: true
    });
  }

  if (_opts.allowSelling && itemDef.value !== undefined) {
    actions.push({
      id: "sell",
      label: `${safeT("sheet.action.sell") ?? t("sheet.action.sell") ?? "Sell"} (${itemDef.value})`,
    });
  }

  return actions;
}

// ─── Action handlers ──────────────────────────────────────────────────────────

function _handleItemAction(actionId, itemId, itemDef, type) {
  _expandedItemId = null;

  switch (actionId) {
    case "use": {
      // consumeItem: runs onConsume hook + addItem -1
      Engine.applyEffects([{ type: "consumeItem", id: itemId }]);
      break;
    }

    case "equip": {
      Engine.applyEffects([{ type: "equipItem", id: itemId }]);
      break;
    }

    case "unequip": {
      Engine.applyEffects([{ type: "unequipItem", id: itemId }]);
      break;
    }

    case "drop": {
      // addItem -1 triggers onDrop if reaching 0
      Engine.applyEffects([{ type: "addItem", id: itemId, delta: -1 }]);
      break;
    }

    case "sell": {
      const currency = _opts.sellCurrency;
      const value    = itemDef.value ?? 0;

      if (!currency) {
        console.warn("[Gaboma] SheetModal: sell action requires sellCurrency option.");
        break;
      }

      Engine.applyEffects([
        { type: "addItem", id: itemId, delta: -1 },    // triggers onDrop if qty→0
        { type: "addVar",  id: currency, delta: value } // award currency
      ]);
      break;
    }

    default:
      console.warn(`[Gaboma] SheetModal: unknown action "${actionId}"`);
  }

  // Re-render sheet with updated state
  const overlay = document.getElementById("sheet-overlay");
  if (overlay) _render(overlay);
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function _categoryType(catDef) {
  if (!catDef) return null;
  const t = catDef.type;
  if (!t) return null;
  if (t === "consumable") return "consumable";
  if (t === "equippable") return "equippable";
  if (typeof t === "object" && t.equippable) return "equippable";
  return null;
}

function _isStackable(catDef, itemDef) {
  // Item-level flag wins
  if (itemDef?.flags?.includes("stackable")) return true;
  if (itemDef?.flags?.includes("no-stack"))  return false;

  // Category-level
  if (catDef?.stackable === true)        return true;
  if (catDef?.stackable === "per-item")  return false; // per-item: no override found above → not stackable
  return false;
}

function _effectiveMax(progress, varDef) {
  // Check varMaxOverrides first — same logic as engine.js
  const varId = varDef?.id;
  if (varId && progress.varMaxOverrides?.[varId] !== undefined) {
    return progress.varMaxOverrides[varId];
  }
  return varDef?.max !== undefined ? varDef.max : Infinity;
}

// ─── Exported helpers used by engine.js (effects) ────────────────────────────

function _getOrCreateOverlayForEffect() {
  return _getOrCreateOverlay();
}

// ─── Public API ───────────────────────────────────────────────────────────────

export const SheetModal = {
  openFull,
  openConsumables,
  close,
};
