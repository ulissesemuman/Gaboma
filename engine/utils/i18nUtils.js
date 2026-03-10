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
    import { resolveText, interpolateAllowed } from "../utils/i18nUtils.js";

const template = resolveText(
  "game.varDelta",
  {},
  "Alteração em {var}: {sign}{value}"
);

const text = interpolateAllowed(
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