import state from "./state.js";
import { BookManager } from "./bookManager.js";
import { Utils } from "./utils.js";

export async function getFontsList() {
  return Utils.fetchJSON("assets/fonts.json");
}

async function setFont(fontId, bookId = null) {
  if (!fontId) {
    fontId = resolveFont(bookId);
  }

  const data = await getFontsList();
  const font = data["google-fonts"].find(f => f.id === fontId);

  if (!font) return;

  if (bookId) {
    if (state.currentView === "book-home" || state.currentView === "reader") {
      document.body.style.fontFamily = `"${font.name}", serif`;
    }

    const bookState = state.bookState?.[bookId];

    if (bookState) {
      bookState.font = fontId;
      state.save();
    }
    else{
    if (state.currentView === "library") {
      document.body.style.fontFamily = `"${font.name}", serif`;
    }

      throw new Error("getFontsList: " + t("error.bookNotFound", { bookId }));
    }
  }
  else {
    state.uiFont = fontId;
    state.save();
  }
}

export function resolveFont(bookId = null) {
  let font = null

  if (bookId) {
    const bookState = state.bookState?.[bookId]; 
    const book = BookManager.getCurrentBook();

    if (bookState && bookState.font) {
      return bookState.font;
    }

    font =
        book.defaultFont ||
        state.uiFont ||
        state.defaultUIFont;
  }
  else {
    font = state.uiFont || state.defaultUIFont;
  }

  return font;
}

async function loadGoogleFonts() {
  const data = await getFontsList();
  const fonts = data["google-fonts"];

  if (!fonts || fonts.length === 0) return;

  const families = fonts
    .map(f => f.name.trim().replace(/\s+/g, "+"))
    .map(name => `family=${name}`)
    .join("&");

  const href = `https://fonts.googleapis.com/css2?${families}&display=swap`;

  let link = document.getElementById("dynamic-fonts");

  link.href = href;

  if (state.uiFont) {
    //setFont(state.uiFont);
  }
}

export const FontManager = {
  getFontsList,
  setUIFont: (fontId) => setFont(fontId, null),
  setBookFont: (bookId, fontId) => setFont(fontId, bookId),
  resolveFont,
  loadGoogleFonts,
};  