import state from "./state.js";
import { BookManager } from "./bookManager.js";
import { loadUILanguage, loadAvailableUILanguages, loadBookLanguage, t } from "./i18n.js";
import { renderCurrentChapter } from "./reader.js";
import { Utils } from "./utils.js";

// ---------- UI ----------

function clearUI() {
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

  // Resetar estado visual auxiliar (se existir)
  document.body.classList.remove("modal-open");
}

function prepareView(viewId) {
  clearUI();

  state.currentView = viewId;

  const viewEl = document.getElementById(viewId);

  if (!viewEl) {
    console.warn(t("view.notFound", { viewId }));
    return null;
  }

  viewEl.style.display = "block";

  renderBottomBar();

  return viewEl;
}

function renderCurrentView() {
  switch (state.currentView) {
    case "library":
      openLibrary();
      applyUIVisualIdentity();
      break;

    case "book-home":
      openBookHome(state.currentBookId);
      applyBookVisualIdentity(BookManager.getCurrentBook());
      break;

    case "game":
      renderReader(state.currentBookId);
      applyBookVisualIdentity(BookManager.getCurrentBook());
      break;

    default:
      console.warn(t("view.unknown", { view: state.currentView }));
      renderLibrary();
  }
}

function applyUIVisualIdentity() {
  const theme = state.theme || state.defaultTheme;
  const font = state.uiFont || state.defaultFont;

  setTheme(theme);

  setUIFont(font);
}

// ---------- UI Language ----------

function bindUILanguageSelector(selectEl) {
  if (!selectEl) {
    throw new Error(t("bindUILanguageSelector: " + "error.elementNotFound", { element: "#selectEl" }));
  }

  selectEl.innerHTML = "";

  state.availableUILanguages.forEach(lang => {
    const option = document.createElement("option");
    option.value = lang;
    option.textContent = lang;
    selectEl.appendChild(option);
  });

  selectEl.value = state.uiLanguage;

  selectEl.onchange = async e => {
    await setUILanguage(e.target.value);
  };
}

async function setUILanguage(lang) {
  await loadUILanguage(lang);
  renderUIText();
  renderCurrentView();
  renderBottomBar();

  if (isConfigPopupOpen()) {
    renderConfigPopup();
  }  
}

function renderUIText() {
  
}

// ---------- Library ----------

async function openLibrary() {
  const books = await BookManager.loadLibrary();

  const localized = await BookManager.loadAllBooksLocalizedData(state.uiLanguage); 

  applyUIVisualIdentity();

  renderLibrary(books, localized);
}

function renderLibrary(books, localized) {

  const libraryEl = prepareView("library");
  if (!libraryEl) {
    throw new Error("renderLibrary: " + t("error.elementNotFound", { element: "#library" }));
  }

  libraryEl.innerHTML = `<h1>${t("library.title")}</h1>`;

  for (const book of Object.values(books)) {
    const card = document.createElement("div");
    card.className = "book-card";

    card.innerHTML = `
      <h2>${localized[book.id].data.title}</h2>
      <p>${localized[book.id].data.summary}</p>
      <button>${t("library.read")}</button>
    `;

    card.querySelector("button").onclick = () => {
      openBookHome(book.id);
    };

    libraryEl.appendChild(card);
  }
}


// ---------- Book Home ----------

async function openBookHome(bookId) {

  let book = BookManager.getCurrentBook();  

  if (bookId !== state.currentBookId || !book) {
    book = await BookManager.loadBook(bookId);

    state.ensureBookState(bookId);

    state.bookState[bookId].language = book.defaultLanguage || state.uiLanguage;
    state.save();
  }

  applyBookVisualIdentity(book);

  const lang = state.bookState[bookId].language ||
    book.defaultLanguage ||
    state.uiLanguage ||
    state.availableUILanguages[0];

  const localized = await BookManager.loadBookLocalizedData(bookId, lang);  

  renderBookHome(localized);
}

function renderBookHome(localized) {

  const homeEl = prepareView("book-home");
  if (!homeEl) {
    throw new Error("renderBookHome: " + t("error.elementNotFound", { element: "#book-home" }));
  }

  const bookId = state.currentBookId;

  homeEl.innerHTML = `
    <div class="book-home-container">
      <div class="book-cover-wrapper">
        <img
          class="book-cover"
          src="books/${bookId}/assets/cover.png"
          alt="${localized.title}"
        />
      </div>

      <div class="book-summary">
        <h1>${localized.title}</h1>
        <p>${localized.summary}</p>
      </div>        

      <div class="book-actions">
        <button id="start-book">
          ${t("book.start")}
        </button>
      </div>
    </div>
  `;

  if (state.hasProgress(bookId)) {
    document.getElementById("continue-book").onclick = () => {
      renderReader(bookId);
    };
  }
}

function hasActiveBookContext() {
  return (
    state.currentView === "book-home" ||
    state.currentView === "game"
  );
}

function applyBookVisualIdentity(book) {
  const bookState = state.bookState[book.id] || {};

  const theme =
    bookState.theme ||
    book.defaultTheme ||
    state.defaultTheme;

  const font =
    bookState.font ||
    book.defaultFont ||
    state.defaultFont;

  document.body.dataset.theme = theme;
  document.body.dataset.font = font;
}

// ---------- Book Language ----------

function bindBookLanguageSelector(selectEl) {
  if (!selectEl) {
    throw new Error("bindBookLanguageSelector: " + t("error.elementNotFound", { element: "#selectEl" }));
  }

  const book = BookManager.getCurrentBook();
  if (!book) {
    throw new Error("bindBookLanguageSelector: " + t("error.invalidBook"));
  }

  const bookId = book.id;
  const bookState = state.bookState[bookId];

  selectEl.innerHTML = "";

  book.languages.forEach(lang => {
    const option = document.createElement("option");
    option.value = lang;
    option.textContent = lang;
    option.selected = lang === bookState.language;
    selectEl.appendChild(option);
  });

  selectEl.onchange = async (e) => {
    bookState.language = e.target.value;
    state.save();

    // re-render apenas a view atual
    renderCurrentView();
  };
}

// ---------- Reader ----------

 function renderReader(bookId, { reset = false } = {}) {
  
  const gameEl = prepareView("game");
  if (!gameEl) {
    throw new Error("renderReader: " + t("error.elementNotFound", { element: "#game" }));
  }

  gameEl.innerHTML = `<p>Lendo livro: ${bookId}</p>`;

  if (reset || !state.hasProgress(bookId)) {
    state.startNewBook(bookId);
  }

  applyBookVisualIdentity(BookManager.getCurrentBook());

  state.currentBook = bookId;
  state.save();

  renderCurrentChapter();
}

// ---------- Button bar ----------

function renderBottomBar() {
  // Biblioteca
  if (state.currentView === "library") {
    setBottomBar([
      { id: "config", label: t("ui.settings"), onClick: openConfigPopup }
    ]);
    return;
  }

  // Home do livro
  if (state.currentView === "book-home") {
    setBottomBar([
      { id: "library", label: t("ui.library"), onClick: openLibrary },
      { id: "config", label: t("ui.settings"), onClick: openConfigPopup }
    ]);
    return;
  }

  // Leitor
  if (state.currentView === "reader") {
    setBottomBar([
      { id: "home", label: t("ui.bookHome"), onClick: openBookHome },
      { id: "library", label: t("ui.library"), onClick: openLibrary },
      { id: "config", label: t("ui.settings"), onClick: openConfigPopup }
    ]);
    return;
  }
}

function setBottomBar(buttons) {
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

function openConfigPopup() {
  const overlay = document.getElementById("config-overlay");

  renderConfigPopup();

  overlay.style.display = "flex";
}

function renderConfigPopup() {
  const popup = document.getElementById("config-popup");

  let html = `
    <h2>${t("ui.settings")}</h2>

    <div class="config-section">
      <label for="ui-language">
        ${t("ui.chooseUILanguage")}
      </label>
      <select id="ui-language"></select>
    </div>
  `;

  html += `
    <div class="config-section">
      <label for="theme-selector">
        ${t("ui.theme")}
      </label>
      <select id="theme-selector">
        <option value="gaboma">Gaboma</option>
        <option value="light">Light</option>
        <option value="dark">Dark</option>
        <option value="parchment">Parchment</option>
        <option value="light-red">Light red</option>
        <option value="dark-red">Dark red</option>
        <option value="light-green">Light green</option>
        <option value="dark-green">Dark green</option>
        <option value="light-blue">Light blue</option>
        <option value="dark-blue">Dark blue</option>
        <option value="pink">Pink</option>
        <option value="purple">Purple</option>
        <option value="yellow">Yellow</option>
        <option value="orange">Orange</option>
        <option value="brown">Brown</option>
      </select>
    </div>
  `;

  html += `
    <div class="config-section">
      <label for="font-selector">
        ${t("ui.font")}
      </label>
      <select id="font-selector"></select>
    </div>
   ` 

  bindFontSelector("font-selector");

  if (hasActiveBookContext()) {
    html += `
      <div class="config-section">
        <label for="book-language">
          ${t("ui.chooseBookLanguage")}
        </label>
        <select id="book-language"></select>
      </div>
    `;
  }

  html += `
    <div class="config-section">
      <button id="export-progress">${t("ui.exportProgress")}</button>
      <button id="import-progress">${t("ui.importProgress")}</button>
      <button id="reset-progress">${t("ui.resetProgress")}</button>
    </div>
  `;

  popup.innerHTML = html;

  document.getElementById("export-progress").onclick = exportState;
  document.getElementById("reset-progress").onclick = resetState;
  document.getElementById("import-progress").onclick = () => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = "application/json";
    input.onchange = e => {
      const file = e.target.files[0];
      if (file) {
        importState(file);
      } else {
         showDialog({
          title: t("ui.warning"),
          message: t("ui.noFileSelected"),
          buttons: [
            { label: t("ui.ok"), value: true }
          ]
        }); 
      }
    };
    input.click();
  };    

  const themeSelect = document.getElementById("theme-selector");
  themeSelect.value = state.theme;

  themeSelect.onchange = e => {
    setTheme(e.target.value);
  };  

  // UI language
  bindUILanguageSelector(
    popup.querySelector("#ui-language")
  );

  // Book language (somente se existir)
  if (hasActiveBookContext()) {
    bindBookLanguageSelector(
      popup.querySelector("#book-language")
    );
  }
}

function isConfigPopupOpen() {
  const overlay = document.getElementById("config-overlay");
  return overlay.style.display === "flex";
}

document.getElementById("config-overlay").onclick = (e) => {
  if (e.target.id === "config-overlay") {
    e.currentTarget.style.display = "none";
  }
};

// ---------- Dialog popup ----------

async function showDialog({
  title = "",
  message = "",
  buttons = []
}) {
  return new Promise(resolve => {
    const overlay = document.getElementById("dialog-overlay");
    const titleEl = document.getElementById("dialog-title");
    const messageEl = document.getElementById("dialog-message");
    const buttonsEl = document.getElementById("dialog-buttons");

    titleEl.textContent = title;
    messageEl.textContent = message;
    buttonsEl.innerHTML = "";

    buttons.forEach(btn => {
      const button = document.createElement("button");
      button.textContent = btn.label;

      button.onclick = () => {
        overlay.style.display = "none";
        resolve(btn.value);
      };

      buttonsEl.appendChild(button);
    });

    overlay.style.display = "flex";
  });
}


// ---------- Fonts ----------

export async function loadGoogleFonts() {
  const data = await Utils.fetchJSON("assets/fonts.json");
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

async function bindFontSelector(selectId = "font-selector") {
  const data = await Utils.fetchJSON("assets/fonts.json");
  const select = document.getElementById(selectId);

  select.innerHTML = "";

  data["google-fonts"].forEach(font => {
    const option = document.createElement("option");
    option.value = font.id;
    option.textContent = font.name;
    select.appendChild(option);
  });

  select.value = state.uiFont;

  select.onchange = e => {
    setUIFont(e.target.value);
  };
}

async function setUIFont(fontId) {
  const data = await Utils.fetchJSON("assets/fonts.json");
  const font = data["google-fonts"].find(f => f.id === fontId);

  if (!font) return;

  document.body.style.fontFamily = `"${font.name}", serif`;

  state.uiFont = fontId;
  state.save();
}

// ---------- THemes ----------

function setTheme(theme) {
  document.body.setAttribute("data-theme", theme);

  state.theme = theme;
  state.save();
}

// ---------- Save ----------

async function exportState() {

  const payload = {
    uiLanguage: state.uiLanguage,
    currentBookId: state.currentBookId,
    currentBookLanguage: state.currentBookLanguage,
    bookState: state.bookState,
    theme: state.theme,
    uiFont: state.uiFont
  };

  const dataStr = JSON.stringify(payload, null, 2);
  const blob = new Blob([dataStr], { type: "application/json" });

  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");

  a.href = url;
  a.download = "gaboma-save.json";
  a.click();

  URL.revokeObjectURL(url);

  await showDialog({
    title: t("ui.warning"),
    message: t("ui.exportProgressSuccess"),
    buttons: [
      { label: t("ui.ok"), value: true }
    ]
  });  
}

async function importState(file) {
  const confirmed = await showDialog({
    title: t("ui.confirmation"),
    message: t("ui.importProgressWarning"),
    buttons: [
      { label: t("ui.cancel"), value: false },
      { label: t("ui.confirm"), value: true }
    ]
  });

  if (!confirmed) return;

  const reader = new FileReader();

  reader.onload = e => {
    try {
      const imported = JSON.parse(e.target.result);

      if (!isValidState(imported)) {
        throw new Error(t("ui.invalidFile"));
      }

      state.uiLanguage = imported.uiLanguage ?? state.uiLanguage;
      state.currentBookId = imported.currentBookId ?? (state.currentBookId || null);
      state.currentBookLanguage = imported.currentBookLanguage ?? (state.currentBookLanguage || null);
      state.bookState = imported.bookState ?? {};
      state.theme = imported.theme ?? state.theme;
      state.uiFont = imported.uiFont ?? state.uiFont;      

      state.save();

      renderCurrentView();

    } catch (e) {

      showDialog({
        title: t("ui.warning"),
        message: t("ui.invalidFile"),
        buttons: [
          { label: t("ui.ok"), value: true }
        ]
      }); 
    }
  };

  reader.readAsText(file);

  await showDialog({
    title: t("ui.warning"),
    message: t("ui.importProgressSuccess"),
    buttons: [
      { label: t("ui.ok"), value: true }
    ]
  });   
}

async function resetState() {
  const confirmed = await showDialog({
    title: t("ui.confirmation"),
    message: t("ui.resetProgressWarning"),
    buttons: [
      { label: t("ui.cancel"), value: false },
      { label: t("ui.confirm"), value: true }
    ]
  });

  if (!confirmed) return;

  state.clear();

  await showDialog({
    title: t("ui.warning"),
    message: t("ui.resetProgressSuccess"),
    buttons: [
      { label: t("ui.ok"), value: true }
    ]
  });    

  location.reload();  
}

function isValidState(obj) {
  return (
    obj &&
    typeof obj === "object" &&
    obj.bookState &&
    typeof obj.bookState === "object"
  );
}

// ---------- Init ----------

async function init() {
  state.load();

  await loadGoogleFonts()

  await loadAvailableUILanguages();

  const defaultLang =
    navigator.language.toLowerCase();

  const lang = state.availableUILanguages.includes(defaultLang)
    ? defaultLang
    : state.availableUILanguages[0];

  await loadUILanguage(lang);

  renderUIText()

  applyUIVisualIdentity();

  await openLibrary();

  renderBottomBar();
}

export const UIManager = {
  init
};
