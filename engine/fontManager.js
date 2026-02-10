import state from "./state.js";
import { BookManager } from "./bookManager.js";
import { Utils } from "./utils.js";

export function setFont(font) {
  document.body.setAttribute("data-font", font);

  state.uiFont = font;
  state.save();
}

export function resolveFont(bookId) {
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

export async function getFontList() {
  return Utils.fetchJSON("assets/fonts.json");
}

async function loadGoogleFonts() {
  const data = await getFontList();
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
    setUIFont(state.uiFont);
  }
}

export async function setUIFont(fontId) {
  if (!fontId) {
    fontId = resolveFont();
  }

  const data = await getFontList();
  const font = data["google-fonts"].find(f => f.id === fontId);

  if (!font) return;

  document.body.style.fontFamily = `"${font.name}", serif`;

  state.uiFont = fontId;
  state.save();
}

export const FontManager = {
  loadGoogleFonts,
  resolveFont,
  setUIFont,
  getFontList
 };