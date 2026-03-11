import state from "../core/state.js";
import { FetchUtils } from "../utils/fetchUtils.js";

let uiLanguageData = {};

export async function loadUILanguage(language) {
  const data = await FetchUtils.fetchJSON(`language/${language}.json`);
  state.uiLanguage = language;
  state.save();
  uiLanguageData = data;
  return data;
}

export async function loadAvailableUILanguages() {
  const index = await FetchUtils.fetchJSON("language/index.json");
  state.availableUILanguages = index.languages;
}

export function t(key, vars = {}) {
  let text = uiLanguageData[key] || key;

  Object.keys(vars).forEach(k => {
    text = text.replaceAll(`{${k}}`, vars[k]);
  });

  return text;
}

