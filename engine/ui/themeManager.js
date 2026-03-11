import { BookLoader } from "../data/bookLoader.js";
import state from "../core/state.js";
import { t } from "../i18n/globalI18n.js";

export function getThemesList(bookId = null) {
  const themes = [
    { id: "gaboma", name: "Gaboma" },
    { id: "light", name: "Light" },
    { id: "dark", name: "Dark" },
    { id: "parchment", name: "Parchment" },
    { id: "light-red", name: "Light red" },
    { id: "dark-red", name: "Dark red" },  
    { id: "light-green", name: "Light green" },
    { id: "dark-green", name: "Dark green" },
    { id: "light-blue", name: "Light blue" },
    { id: "dark-blue", name: "Dark blue" },
    { id: "pink", name: "Pink" },
    { id: "purple", name: "Purple" },
    { id: "yellow", name: "Yellow" },
    { id: "orange", name: "Orange" },
    { id: "brown", name: "Brown" },
  ];

  if (!bookId) return themes;

  const book = BookLoader.getCurrentBook(bookId);
  const extra = book?.manifest?.extraThemes || [];

  if (extra.length === 0) return themes;

  return [...extra, ...themes];
}

export function setTheme(theme, bookId = null) {
  if (!theme) {
    theme = resolveTheme(bookId);
  }

  if (bookId) {
    if (state.currentView === "book-home" || state.currentView === "reader") {
      document.body.dataset.theme = theme;
    }

    const bookState = state.bookState?.[bookId];

    if (bookState) {
      bookState.theme = theme;
      state.save();
    }
    else{
      throw new Error("setTheme: " + t("error.bookNotFound", { bookId }));
    }
  }
  else {
    if (state.currentView === "library") {
      document.body.dataset.theme = theme;
    }

    state.uiTheme = theme;
    state.save();
  }
}

export function resolveTheme(bookId) {
  let theme = null;

  if (bookId) {
    const bookState = state.bookState?.[bookId]; 
    const book = BookLoader.getCurrentBook();

    if (bookState && bookState.theme) {
      return bookState.theme;
    }

    theme =
        book.manifest.defaultTheme ||
        state.uiTheme ||
        state.defaultUITheme;
  }
  else {
    theme = state.uiTheme || state.defaultUITheme;
  }

  return theme;
}

export const ThemeManager = {
  getThemesList,
  setUITheme: (theme) => setTheme(theme, null),
  setBookTheme: (bookId, theme) => setTheme(theme, bookId),
  resolveTheme
};