import state from "../core/state.js";
import { FetchUtils } from "../utils/fetchUtils.js";

let bookLanguageData = {};

export async function loadBookLanguage(bookId, language) {
  const data = await FetchUtils.fetchJSON(`books/${bookId}/language/${language}.json`);
  const bookState = state.bookState[bookId];
  bookState.settings.language = language;
  state.save();
  bookLanguageData = data;
  return data;
}

export function tb(key, vars = {}) {
  let text = bookLanguageData[key] ?? key;

  Object.keys(vars).forEach(k => {
    text = text.replaceAll(`{${k}}`, vars[k]);
  });

  return text;
}
