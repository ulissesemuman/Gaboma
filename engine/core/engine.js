import state from "./state.js";
import { Reader } from "./reader.js";

export function applyEffects(effects = []) {
  const bookId = state.currentBookId;
  if (!bookId) {
    throw new Error("No current book selected");
  }

  const bookState = state.bookState[bookId];
  const story = Reader.getCurrentStory();

  effects.forEach(effect => {

    switch (effect.type) {

      case "addVar": {
        const current = bookState.progress.variables[effect.id];

        // addVar on boolean is a no-op (effects.js already warned)
        if (typeof current === "boolean") break;

        const varDef  = story?.variables?.[effect.id];
        const raw     = (current ?? 0) + effect.delta;
        const clampMin = varDef?.min !== undefined ? varDef.min : -Infinity;
        const clampMax = _effectiveMax(bookState, story, effect.id);
        bookState.progress.variables[effect.id] = Math.min(clampMax, Math.max(clampMin, raw));

        // XP hook: if this variable is the player's XP var, check for level up
        if (effect.id === bookState.progress._playerXpVar) {
          _checkLevelUp(bookState, story, effect.id);
        }
        break;
      }

      case "setVarMax": {
        // Set a new permanent max for a variable, stored in progress
        const overrides = bookState.progress.varMaxOverrides ?? {};
        overrides[effect.id] = effect.value;
        bookState.progress.varMaxOverrides = overrides;
        // Re-clamp current value to new max
        const cur = bookState.progress.variables[effect.id] ?? 0;
        bookState.progress.variables[effect.id] = Math.min(effect.value, cur);
        break;
      }

      case "addVarMax": {
        // Add to the current effective max permanently
        const current = _effectiveMax(bookState, story, effect.id);
        const newMax  = current + effect.value;
        const overrides = bookState.progress.varMaxOverrides ?? {};
        overrides[effect.id] = newMax;
        bookState.progress.varMaxOverrides = overrides;
        // Re-clamp current value if it now exceeds new max
        const cur = bookState.progress.variables[effect.id] ?? 0;
        bookState.progress.variables[effect.id] = Math.min(newMax, cur);
        break;
      }

      case "setBoolVar": {
        // Direct boolean assignment — no arithmetic
        bookState.progress.variables[effect.id] = effect.value;
        break;
      }

      case "addItem": {
        const current = bookState.progress.items[effect.id] ?? 0;
        const next    = Math.max(0, current + effect.delta);

        bookState.progress.items[effect.id] = next;

        // Fire item hooks
        const itemDef = story?.items?.items?.[effect.id];
        if (itemDef) {
          // onAcquire: first unit gained (0 → 1+)
          if (current === 0 && next > 0 && itemDef.onAcquire?.effects?.length) {
            _applyItemHook(itemDef.onAcquire.effects, bookState, story);
          }
          // onDrop: last unit lost (1+ → 0)
          if (current > 0 && next === 0 && itemDef.onDrop?.effects?.length) {
            _applyItemHook(itemDef.onDrop.effects, bookState, story);
          }
        }
        break;
      }

      case "startCombat":
      case "endCombat":
        // Handled by CombatEngine via effects.js — nothing to do here
        break;

      case "equipItem": {
        const itemId  = effect.id;
        const itemDef = _getItemDef(story, itemId);
        if (!itemDef) { console.warn(`[Gaboma] equipItem: unknown item "${itemId}"`); break; }

        const catId  = itemDef.category;
        const catDef = _getCategoryDef(story, catId);
        if (_getCategoryType(catDef) !== "equippable") {
          console.warn(`[Gaboma] equipItem: category "${catId}" is not equippable`); break;
        }

        const maxSlots = _getCategoryMax(catDef);
        const equipped = bookState.progress.equipped;
        const slots    = equipped[catId] ?? [];

        // If already equipped, skip
        if (slots.includes(itemId)) break;

        // If at capacity, unequip the oldest item first
        if (slots.length >= maxSlots) {
          const toRemove = slots[0];
          _runEquipHook("onUnequip", toRemove, bookState, story);
          slots.shift();
        }

        slots.push(itemId);
        equipped[catId] = slots;
        _runEquipHook("onEquip", itemId, bookState, story);
        break;
      }

      case "unequipItem": {
        const itemId  = effect.id;
        const itemDef = _getItemDef(story, itemId);
        if (!itemDef) { console.warn(`[Gaboma] unequipItem: unknown item "${itemId}"`); break; }

        const catId  = itemDef.category;
        const equipped = bookState.progress.equipped;
        const slots    = equipped[catId] ?? [];
        const idx      = slots.indexOf(itemId);

        if (idx === -1) break; // not equipped, nothing to do

        _runEquipHook("onUnequip", itemId, bookState, story);
        slots.splice(idx, 1);
        equipped[catId] = slots;
        break;
      }

      case "consumeItem": {
        const itemId  = effect.id;
        const itemDef = _getItemDef(story, itemId);
        if (!itemDef) { console.warn(`[Gaboma] consumeItem: unknown item "${itemId}"`); break; }

        const catId  = itemDef.category;
        const catDef = _getCategoryDef(story, catId);
        if (_getCategoryType(catDef) !== "consumable") {
          console.warn(`[Gaboma] consumeItem: category "${catId}" is not consumable`); break;
        }

        const current = bookState.progress.items[itemId] ?? 0;
        if (current <= 0) { console.warn(`[Gaboma] consumeItem: no "${itemId}" in inventory`); break; }

        // Consume: remove 1 from inventory first
        bookState.progress.items[itemId] = current - 1;

        // Then run onConsume hook
        if (itemDef.onConsume?.effects?.length) {
          _applyItemHook(itemDef.onConsume.effects, bookState, story);
        }
        break;
      }

      case "buyItem": {
        // { type: "buyItem", id: "sword", currency: "gold" }
        const itemId   = effect.id;
        const currency = effect.currency;
        const itemDef  = _getItemDef(story, itemId);

        if (!itemDef) { console.warn(`[Gaboma] buyItem: unknown item "${itemId}"`); break; }
        if (!currency) { console.warn(`[Gaboma] buyItem: missing currency for item "${itemId}"`); break; }

        const price   = itemDef.value ?? 0;
        const balance = bookState.progress.variables[currency] ?? 0;

        if (balance < price) {
          bookState.progress._lastBuyResult = "insufficient_funds";
          break;
        }

        // Deduct currency
        const varDef   = story?.variables?.[currency];
        const clampMin = varDef?.min !== undefined ? varDef.min : -Infinity;
        const clampMax = _effectiveMax(bookState, story, currency);
        bookState.progress.variables[currency] = Math.min(clampMax, Math.max(clampMin, balance - price));

        // Add item (fires onAcquire if 0 → 1+)
        const currentQty = bookState.progress.items[itemId] ?? 0;
        const nextQty    = currentQty + 1;
        bookState.progress.items[itemId] = nextQty;

        if (currentQty === 0 && nextQty > 0 && itemDef.onAcquire?.effects?.length) {
          _applyItemHook(itemDef.onAcquire.effects, bookState, story);
        }

        bookState.progress._lastBuyResult = "ok";
        break;
      }

      case "showCharacterSheet":
      case "showConsumableSelector":
        // Handled by effects.js — SheetModal opens after applyEffects returns
        break;

      case "rollChance":
        // não altera estado
        break;

      default:
        throw new Error(`Unknown effect: ${effect.type}`);
    }
  });

  checkFatalVariables(bookState, story);

  state.save();
}

/**
 * Applies item hook effects directly (setVarMax, addVarMax, addVar, setBoolVar).
 * Intentionally limited — does not support addItem to avoid infinite recursion.
 */
function _applyItemHook(effects, bookState, story) {
  effects.forEach(eff => {
    // Reuse the same switch by building a minimal fake call
    // We only support var/varMax effects in hooks to keep it safe
    switch (eff.type) {
      case "addVarMax": {
        const cur = _effectiveMax(bookState, story, eff.id);
        const newMax = cur + eff.value;
        (bookState.progress.varMaxOverrides ??= {})[eff.id] = newMax;
        const v = bookState.progress.variables[eff.id] ?? 0;
        bookState.progress.variables[eff.id] = Math.min(newMax, v);
        break;
      }
      case "setVarMax": {
        (bookState.progress.varMaxOverrides ??= {})[eff.id] = eff.value;
        const v = bookState.progress.variables[eff.id] ?? 0;
        bookState.progress.variables[eff.id] = Math.min(eff.value, v);
        break;
      }
      case "addVar": {
        const varDef = story?.variables?.[eff.id];
        const cur    = bookState.progress.variables[eff.id] ?? 0;
        const raw    = cur + (eff.delta ?? eff.value ?? 0);
        const min    = varDef?.min !== undefined ? varDef.min : -Infinity;
        const max    = _effectiveMax(bookState, story, eff.id);
        bookState.progress.variables[eff.id] = Math.min(max, Math.max(min, raw));
        break;
      }
      case "setBoolVar":
        bookState.progress.variables[eff.id] = Boolean(eff.value);
        break;
      default:
        console.warn(`[Gaboma] Item hook: unsupported effect type "${eff.type}"`);
    }
  });
}

/**
 * Returns the effective max for a variable:
 * progress.varMaxOverrides[id] > story.variables[id].max > Infinity
 */
function _effectiveMax(bookState, story, varId) {
  if (bookState.progress.varMaxOverrides?.[varId] !== undefined) {
    return bookState.progress.varMaxOverrides[varId];
  }
  const def = story?.variables?.[varId];
  return def?.max !== undefined ? def.max : Infinity;
}

function checkFatalVariables(bookState, story) {
  const variables = story.variables;

  if (!variables) return;

  for (const [id, config] of Object.entries(variables)) {

    if (config.fatalAtZero) {
      const value =
        bookState.progress.variables[id] ?? 0;

      if (value <= 0) {
        bookState.progress.gameOver = true;
      }
    }
  }
}

/**
 * Checks whether the current XP value crosses any level thresholds defined
 * in story.levelup. Fires matching effects in ascending level order.
 * Uses bookState.progress._playerLevel to track the current level (default 1).
 */
function _checkLevelUp(bookState, story, xpVarId) {
  const levelupConfig = story?.levelup;
  if (!levelupConfig?.levels?.length) return;

  const currentXp    = bookState.progress.variables[xpVarId] ?? 0;
  const currentLevel = bookState.progress._playerLevel ?? 1;

  // Sort ascending so we process level 2 before level 3, etc.
  const levels = [...levelupConfig.levels].sort((a, b) => a.level - b.level);

  for (const levelDef of levels) {
    if (levelDef.level <= currentLevel) continue;       // already at or past this level
    if (currentXp < levelDef.xpRequired) continue;     // not enough XP yet

    // Level up!
    bookState.progress._playerLevel = levelDef.level;

    // Fire level-up effects (reuse item hook pipeline — safe subset of effects)
    if (levelDef.effects?.length) {
      _applyItemHook(levelDef.effects, bookState, story);
    }

    // Store level-up event so combatModal (or any UI) can display it
    bookState.progress._pendingLevelUps = bookState.progress._pendingLevelUps ?? [];
    bookState.progress._pendingLevelUps.push({
      level:  levelDef.level,
      label:  levelDef.label ?? null   // optional author-defined label e.g. "Warrior II"
    });
  }
}


export const Engine = {
  applyEffects
}
// ─── Item / Category helpers ──────────────────────────────────────────────────

function _getItemDef(story, itemId) {
  return story?.items?.items?.[itemId] ?? null;
}

function _getCategoryDef(story, catId) {
  return story?.items?.categories?.[catId] ?? null;
}

function _getCategoryType(catDef) {
  if (!catDef) return null;
  const t = catDef.type;
  if (!t) return null;
  if (t === "consumable") return "consumable";
  if (t === "equippable") return "equippable";
  if (typeof t === "object" && t.equippable) return "equippable";
  return null;
}

function _getCategoryMax(catDef) {
  if (!catDef) return 1;
  const t = catDef.type;
  if (typeof t === "object" && t.equippable?.max) return t.equippable.max;
  return 1;
}

function _runEquipHook(hookName, itemId, bookState, story) {
  const itemDef = _getItemDef(story, itemId);
  if (!itemDef) return;
  const hook = itemDef[hookName];
  if (hook?.effects?.length) {
    _applyItemHook(hook.effects, bookState, story);
  }
}
