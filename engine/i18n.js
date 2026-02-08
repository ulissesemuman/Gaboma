import state from "./state.js";
import { Utils } from "./utils.js";

let uiLanguageData = {};
let bookLanguageData = {};

// ---------- UI Language ----------

export async function loadUILanguage(lang) {
  const data = await Utils.fetchJSON(`language/${lang}.json`);
  state.uiLanguage = lang;
  state.save();
  uiLanguageData = data;
}

export async function loadAvailableUILanguages() {
  const index = await Utils.fetchJSON("language/index.json");
  state.availableUILanguages = index.languages;
}

//export function t(key) {
//  return uiLanguageData[key] ?? key;
//}

export function t(key, vars = {}) {
  let text = uiLanguageData[key] || key;

  Object.keys(vars).forEach(k => {
    text = text.replaceAll(`{${k}}`, vars[k]);
  });

  return text;
}

// ---------- Book Language ----------

export async function loadBookLanguage(bookId, lang) {
  const data = await Utils.fetchJSON(`books/${bookId}/language/${lang}.json`);
  state.currentBookLanguage = lang;
  bookLanguageData = data;
  return data;
}

export function tb(key) {
  return bookLanguageData[key] ?? key;
}
