import { BookManager } from "./bookManager.js";
import state from "./state.js";

export function setTheme(theme) {
  if (!theme) {
    theme = resolveTheme();
  }

  document.body.setAttribute("data-theme", theme);

  state.theme = theme;
  state.save();
}

export function resolveTheme(bookId) {
  let theme = null;

  if (bookId) {
    const bookState = state.bookState?.[bookId]; 
    const book = BookManager.getCurrentBook();

    if (bookState && bookState.theme) {
      return bookState.theme;
    }

    theme =
        book.defaultTheme ||
        state.theme ||
        state.defaultTheme;
  }
  else {
    theme = state.theme || state.defaultTheme;
  }

  return theme;
}

export const ThemeManager = {
  setTheme,
  resolveTheme
};