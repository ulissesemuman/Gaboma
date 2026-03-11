import state from "../core/state.js";
import { t } from "../i18n/globalI18n.js";
import { tb } from "../i18n/bookI18n.js";

/**
 * Retorna null se a chave não existir.
 */
export function safeT(key, params = {}) {
  const result = t(key, params);
  return result === key ? null : result;
}

/**
 * Retorna null se a chave não existir no livro.
 */
export function safeTb(key, params = {}) {
  const result = tb(key, params);
  return result === key ? null : result;
}

/**
 * Resolve prioridade:
 * 1. Livro
 * 2. Global
 * 3. fallback
 */
export function resolveText(key, params = {}, fallback = null) {
  const bookValue = safeTb(key, params);
  if (bookValue) return bookValue;

  const globalValue = safeT(key, params);
  if (globalValue) return globalValue;

  return fallback ?? key;
}

/**
 * Substitui apenas placeholders permitidos
 */
export function interpolateAllowed(template, values, allowed = []) {
  let text = template;

  allowed.forEach(k => {
    if (values[k] !== undefined) {
      text = text.replaceAll(`{${k}}`, values[k]);
    }
  });

  return text;
}


function exemplo1() {
    //import { resolveText, interpolateAllowed } from "../utils/i18nUtils.js";

const template = resolveText(
  "game.varDelta",
  {},
  "Alteração em {var}: {sign}{value}"
);

const text = interpolateAllowed();
//import { resolveText, interpolateAllowed } from "../utils/i18nUtils.js";

/*const template = resolveText(
  "game.varDelta",
  {},
  "Alteração em {var}: {sign}{value}"
);

const text = interpolateAllowed(
  template,
  {
    var: varLabel,
    sign: delta > 0 ? "+" : "",
    value: Math.abs(delta)
  },
  ["var", "sign", "value"]
);*/
}

/**
 * Resolves a message string:
 *   1. Passes through tb() to translate i18n keys
 *   2. Replaces {varName} masks with live values from progress
 *
 * Works for startMessage, endMessage, narrative text, chapter text, etc.
 *
 * @param {string} text - raw key or literal string
 * @returns {string}
 */
export function interpolateBook(text) {
  if (!text) return text;

  // Step 1: translate i18n key (if it's a key, returns translation; if literal, returns as-is)
  const translated = tb(text);

  // Step 2: replace {mask} with live values
  const bookId   = state.currentBookId;
  const progress = state.bookState?.[bookId]?.progress;
  if (!progress) return translated;

  return translated.replace(/\{(\w+)\}/g, (match, key) => {
    if (progress.variables?.[key] !== undefined) return progress.variables[key];
    if (progress.items?.[key]     !== undefined) return progress.items[key];

    // Enemy HP by instanceId or type
    for (const inst of Object.values(progress.combat ?? {})) {
      if (inst.instanceId === key || inst.enemyType === key) return inst.hp;
    }

    return match; // unresolved — keep {key}
  });
}
