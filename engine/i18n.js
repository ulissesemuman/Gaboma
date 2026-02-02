import state from "./state.js";

let uiLanguageData = {};
let bookLanguageData = {};

// ---------- Utils ----------

async function fetchJSON(path) {
  const res = await fetch(path);
  if (!res.ok) {
    throw new Error(`Erro ao carregar ${path}`);
  }
  return res.json();
}

// ---------- UI Language ----------

export async function loadUILanguage(lang) {
  const data = await fetchJSON(`language/${lang}.json`);
  state.uiLanguage = lang;
  uiLanguageData = data;
}

export function t(key) {
  return uiLanguageData[key] ?? key;
}

// ---------- Book Language ----------

export async function loadBookLanguage(bookId, lang) {
  const data = await fetchJSON(`books/${bookId}/language/${lang}.json`);
  state.currentBookLanguage = lang;
  bookLanguageData = data;
  return data;
}

export function tb(key) {
  return bookLanguageData[key] ?? key;
}
