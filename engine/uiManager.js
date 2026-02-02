import state from "./state.js";
import { loadLibrary } from "./bookManager.js";
import { loadBookLocalizedData } from "./bookManager.js";
import { loadUILanguage, loadBookLanguage, t } from "./i18n.js";

// ---------- Utils ----------

async function fetchJSON(path) {
  const res = await fetch(path);
  if (!res.ok) {
    throw new Error(`Erro ao carregar ${path}`);
  }
  return res.json();
}

// ---------- UI Language ----------

async function loadAvailableUILanguages() {
  const index = await fetchJSON("language/index.json");
  state.availableUILanguages = index.languages;
}

function bindUILanguageSelector() {
  const select = document.getElementById("ui-language");
  select.innerHTML = "";

  state.availableUILanguages.forEach(lang => {
    const option = document.createElement("option");
    option.value = lang;
    option.textContent = lang;
    select.appendChild(option);
  });

  select.value = state.uiLanguage;

  select.onchange = async e => {
    await setUILanguage(e.target.value);
  };
}

async function setUILanguage(lang) {
  await loadUILanguage(lang);
  bindUILanguageSelector();
  renderUIText();
  renderLibrary();
}

function renderUIText() {
  const label = document.getElementById("ui-language-label");
  if (!label) return;

  label.textContent = t("ui.language");
}

// ---------- Library ----------

/*async function renderLibrary() {
  const libraryEl = document.getElementById("library");
  libraryEl.innerHTML = `<h1>${t("library.title")}</h1>`;

  Object.values(state.books).forEach(book => {
    const card = document.createElement("div");
    card.className = "book-card";

    card.innerHTML = `
      <h2>${book.title}</h2>
      <p>${book.description}</p>
      <button>${t("library.read")}</button>
    `;

    card.querySelector("button").onclick = () => {
      openBook(book.id);
    };

    libraryEl.appendChild(card);
  });
}*/

async function renderLibrary() {
  const libraryEl = document.getElementById("library");
  libraryEl.innerHTML = `<h1>${t("library.title")}</h1>`;

  for (const book of Object.values(state.books)) {
    const localized = await loadBookLocalizedData(
      book.id,
      state.uiLanguage
    );

    const card = document.createElement("div");
    card.className = "book-card";

    card.innerHTML = `
      <h2>${localized.title}</h2>
      <p>${localized.summary}</p>
      <button>${t("library.read")}</button>
    `;

    card.querySelector("button").onclick = () => {
      openBook(book.id);
    };

    libraryEl.appendChild(card);
  }
}


// ---------- Book Home ----------

async function openBook(bookId) {
  state.currentBookId = bookId;

  const book = state.books[bookId];
  if (!book) return;

  const bookHomeEl = document.getElementById("book-home");
  const libraryEl = document.getElementById("library");

  libraryEl.style.display = "none";
  bookHomeEl.style.display = "block";

  const lang =
    book.defaultLanguage ||
    state.uiLanguage;

  const languageData = await loadBookLanguage(bookId, lang);

  bookHomeEl.innerHTML = `
    <h1>${book.title}</h1>
    <p>${languageData["home.description"] ?? book.description}</p>
    <button id="start-book">${t("book.start")}</button>
  `;

  document
    .getElementById("start-book")
    .onclick = () => startBook();
}

// ---------- Reader ----------

function startBook() {
  const bookHomeEl = document.getElementById("book-home");
  const gameEl = document.getElementById("game");

  bookHomeEl.style.display = "none";
  gameEl.style.display = "block";

  gameEl.innerHTML = `<p>${t("book.loading")}</p>`;
}

// ---------- Init ----------

async function init() {
  await loadAvailableUILanguages();

  const defaultLang =
    navigator.language.toLowerCase();

  const lang = state.availableUILanguages.includes(defaultLang)
    ? defaultLang
    : state.availableUILanguages[0];

  await loadUILanguage(lang);

  renderUIText()

  bindUILanguageSelector();

  await loadLibrary();

  renderLibrary();
}

export const UIManager = {
  init
};
