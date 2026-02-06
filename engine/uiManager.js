import state from "./state.js";
import { loadLibrary, loadBookLocalizedData } from "./bookManager.js";
import { loadUILanguage, loadBookLanguage, t } from "./i18n.js";
import { renderCurrentChapter } from "./reader.js";

// ---------- Utils ----------

async function fetchJSON(path) {
  const res = await fetch(path);
  if (!res.ok) {
    throw new Error(`Erro ao carregar ${path}`);
  }
  return res.json();
}

// ---------- UI ----------

export function clearUI() {
  const views = ["library", "book-home", "game"];

  views.forEach(id => {
    const el = document.getElementById(id);
    if (el) {
      el.style.display = "none"; // Esconder todas as views principais
      el.innerHTML = ""; // Limpar conteúdo dinâmico
    }
  });

  // Limpar barra inferior
  document.getElementById("bottom-bar").innerHTML = "";  

  // Fecha popup de configurações se estiver aberto
  const overlay = document.getElementById("config-overlay");
  if (overlay) {
    overlay.style.display = "none";
    const popup = document.getElementById("config-popup");
    if (popup) {
      popup.innerHTML = "";
    }  
  }

  // Resetar estado visual auxiliar (se existir)
  document.body.classList.remove("modal-open");
}

function prepareView(viewId) {
  // 1. Limpa toda a UI
  clearUI();

  // 2. Atualiza o estado global
  state.currentView = viewId;

  // 3. Obtém o elemento da view
  const viewEl = document.getElementById(viewId);

  if (!viewEl) {
    console.warn(`View "${viewId}" não encontrada no DOM`);
    return null;
  }

  // 4. Exibe a view
  viewEl.style.display = "block";

  // 5. Re-renderiza a barra inferior
  renderBottomBar();

  // 6. Retorna o elemento para renderização específica
  return viewEl;
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
  renderBottomBar();
}

function renderUIText() {
  const label = document.getElementById("ui-language-label");
  if (!label) return;

  label.textContent = t("ui.chooseLanguage");
}

// ---------- Library ----------

async function renderLibrary() {

  const libraryEl = prepareView("library");
  if (!libraryEl) return;
  
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
      renderBookHome(book.id);
    };

    libraryEl.appendChild(card);
  }
}


// ---------- Book Home ----------

export async function renderBookHome(bookId) {

  const homeEl = prepareView("book-home");
  if (!homeEl) return;

  const book = state.books[bookId];

  const lang =
    book.defaultLanguage ||
    state.uiLanguage;

  const localized = await loadBookLocalizedData(bookId, lang);

  homeEl.innerHTML = `
    <div class="book-home-content">
      <img
        class="book-cover"
        src="books/${bookId}/assets/cover.png"
        alt="${localized.title}"
      />

      <h1>${localized.title}</h1>
      <p>${localized.summary}</p>

      <label>
        ${t("book.chooseLanguage")}
        <select id="book-language"></select>
      </label>

      <div class="book-home-actions">
        <button id="start-book">
          ${t("book.start")}
        </button>
      </div>
    </div>
  `;

  renderBookLanguageSelector(bookId, lang);

  renderBottomBar();

  if (state.hasProgress(bookId)) {
  document.getElementById("continue-book").onclick = () => {
    renderReader(bookId);
  };
  }
}

async function renderBookLanguageSelector(bookId, selectedLang) {
  const select = document.getElementById("book-language");

  const index = await fetch(
    `books/${bookId}/language/index.json`
  ).then(r => r.json());

  index.languages.forEach(lang => {
    const option = document.createElement("option");
    option.value = lang;
    option.textContent = lang;
    option.selected = lang === selectedLang;
    select.appendChild(option);
  });

  select.onchange = () => {
    state.books[bookId].defaultLanguage = select.value;
    state.save();
    renderBookHome(bookId); // re-render
  };
}

async function openBook(bookId) {

  clearUI();
  state.currentBookId = bookId;
  state.save();

  const book = state.books[bookId];
  if (!book) return;

  const bookHomeEl = document.getElementById("book-home");

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

export async function renderReader(bookId, { reset = false } = {}) {
  
  const gameEl = prepareView("game");
  if (!gameEl) return;  

  gameEl.innerHTML = `<p>Lendo livro: ${bookId}</p>`;

  // preparar estado
  if (reset || !state.hasProgress(bookId)) {
    state.startNewBook(bookId);
  }

  state.currentBook = bookId;
  state.save();

  // menu inferior
  renderBottomBar();

  // renderizar capítulo atual
  renderCurrentChapter();
}

function startBook() {
  const bookHomeEl = document.getElementById("book-home");
  const gameEl = document.getElementById("game");

  bookHomeEl.style.display = "none";
  gameEl.style.display = "block";

  gameEl.innerHTML = `<p>${t("book.loading")}</p>`;
}

// ---------- Button bar ----------

export function renderBottomBar() {
  // Biblioteca
  if (state.currentView === "library") {
    setBottomBar([
      { id: "config", label: t("ui.config"), onClick: openConfigPopup }
    ]);
    return;
  }

  // Home do livro
  if (state.currentView === "book-home") {
    setBottomBar([
      { id: "library", label: t("ui.library"), onClick: renderLibrary },
      { id: "config", label: t("ui.config"), onClick: openConfigPopup }
    ]);
    return;
  }

  // Leitor
  if (state.currentView === "reader") {
    setBottomBar([
      { id: "home", label: t("ui.bookHome"), onClick: renderBookHome },
      { id: "library", label: t("ui.library"), onClick: renderLibrary },
      { id: "config", label: t("ui.config"), onClick: openConfigPopup }
    ]);
    return;
  }
}

export function setBottomBar(buttons) {
  const bar = document.getElementById("bottom-bar");
  bar.innerHTML = "";

  buttons.forEach(btn => {
    const button = document.createElement("button");
    button.id = `bottom-${btn.id}`;
    button.textContent = btn.label;
    button.onclick = btn.onClick;
    bar.appendChild(button);
  });
}

// ---------- Config popup ----------

export function openConfigPopup() {
  const overlay = document.getElementById("config-overlay");
  const popup = document.getElementById("config-popup");

  popup.innerHTML = `
    <h2>Configurações</h2>

    <div class="config-section">
      <label for="ui-language">
        ${t("ui.chooseLanguage")}
      </label>
      <select id="ui-language-popup"></select>
    </div>
  `;

  bindUILanguageSelector("ui-language-popup");

  overlay.style.display = "flex";
}

document.getElementById("config-overlay").onclick = (e) => {
  if (e.target.id === "config-overlay") {
    e.currentTarget.style.display = "none";
  }
};

// ---------- Init ----------

async function init() {
  state.currentView = "library";

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

  renderBottomBar();
}

export const UIManager = {
  init
};
