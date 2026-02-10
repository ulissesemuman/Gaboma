import state from "./state.js";
import { BookManager } from "./bookManager.js";
import { loadUILanguage, loadAvailableUILanguages, loadBookLanguage, t } from "./i18n.js";
import { renderCurrentChapter } from "./reader.js";
import { Utils } from "./utils.js";
import { ThemeManager } from "./themeManager.js";
import { FontManager } from "./fontManager.js";
import { DialogManager } from "./dialogManager.js";

// ---------- UI ----------

function resolveUILanguage() {
  const available = state.availableUILanguages;

  if (!Array.isArray(available) || available.length === 0) {
    throw new Error(t("error.noAvailableUILanguages"));
  }

  if (state.uiLanguage) {
    return state.uiLanguage;
  }

  if (navigator.language) {
    const browserLang = navigator.language.toLowerCase();

    if (available.includes(browserLang)) {
      return browserLang;
    }

    const baseLang = browserLang.split("-")[0];
    const match = available.find(lang =>
      lang.startsWith(baseLang)
    );

    if (match) {
      return match;
    }
  }

  return available[0];
}

function clearUI() {
  const views = ["library", "book-home", "reader"];

  views.forEach(id => {
    const el = document.getElementById(id);
    if (el) {
      el.style.display = "none";
      el.innerHTML = "";
    }
  });

  document.getElementById("bottom-bar").innerHTML = "";  

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
      break;

    case "book-home":
      openBookHome(state.currentBookId);
      break;

    case "reader":
      renderReader(state.currentBookId);
      applyBookVisualIdentity(BookManager.getCurrentBook());
      break;

    default:
      console.warn(t("view.unknown", { view: state.currentView }));
      openLibrary();
  }
}

function applyUIVisualIdentity() {
  ThemeManager.setTheme();

  FontManager.setUIFont();
}

// ---------- UI Language ----------

function bindUILanguageSelector(selectEl) {
  if (!selectEl) {
    throw new Error("bindUILanguageSelector: " + t("error.elementNotFound", { element: "#selectEl" }));
  }

  selectEl.innerHTML = "";

  state.availableUILanguages.forEach(lang => {
    const option = document.createElement("option");
    option.value = lang;
    option.textContent = lang;
    selectEl.appendChild(option);
  });

  selectEl.value = resolveUILanguage();

  selectEl.onchange = async e => {
    await setUILanguage(e.target.value);
  };
}

async function setUILanguage(lang) {
  await loadUILanguage(lang);
  renderCurrentView();
  renderBottomBar();

  if (isConfigPopupOpen()) {
    renderConfigPopup();
  }  
}

// ---------- Library ----------

async function openLibrary() {

  if((state.currentView !== "library")) {
    BookManager.resetLibraryCache();
    BookManager.resetBooksLanguageCache();
  }

  const books = await BookManager.loadLibrary();

  const localized = await BookManager.loadAllBooksLocalizedData(); 

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

    if (!state.bookState?.[bookId]) {
      await BookManager.setBookState(bookId);
    }
  }

  applyBookVisualIdentity(book);

  const localized = await BookManager.loadBookLocalizedData(bookId);

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
    state.currentView === "reader"
  );
}

function applyBookVisualIdentity(book) {
  const bookState = state.bookState[book.id] || {};

  const theme = ThemeManager.resolveTheme(book.id);

  const font = FontManager.resolveFont(book.id);

  document.body.dataset.theme = theme;
  document.body.dataset.font = font;
}

// ---------- Book Language ----------

async function bindBookLanguageSelector(selectEl) {
  if (!selectEl) {
    throw new Error("bindBookLanguageSelector: " + t("error.elementNotFound", { element: "#selectEl" }));
  }

  const bookId = state.currentBookId;
  const index = await BookManager.loadBookLanguageList(bookId);
  const languages = index.languages;

  const bookState = state.bookState[bookId];

  selectEl.innerHTML = "";

  languages.forEach(lang => {
    const option = document.createElement("option");
    option.value = lang;
    option.textContent = lang;
    selectEl.appendChild(option);
  });

  selectEl.value = await BookManager.resolveBookLanguage(state.currentBookId);

  selectEl.onchange = async (e) => {
    bookState.language = e.target.value;
    state.save();

    renderCurrentView();
  };
}

// ---------- Reader ----------

 function renderReader(bookId, { reset = false } = {}) {
  
  const readerEl = prepareView("reader");
  if (!readerEl) {
    throw new Error("renderReader: " + t("error.elementNotFound", { element: "#reader" }));
  }

  readerEl.innerHTML = `<p>Lendo livro: ${bookId}</p>`;

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

  bindFontSelector("font-selector");  

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
  themeSelect.value = ThemeManager.resolveTheme(state.currentBookId);

  themeSelect.onchange = e => {
    ThemeManager.setTheme(e.target.value);
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

// ---------- Fonts ----------

async function bindFontSelector(selectEl) {
  const data = await FontManager.getFontList();
  const select = document.getElementById(selectEl);

  select.innerHTML = "";

  data["google-fonts"].forEach(font => {
    const option = document.createElement("option");
    option.value = font.id;
    option.textContent = font.name;
    select.appendChild(option);
  });

  select.value = FontManager.resolveFont();

  select.onchange = e => {
    FontManager.setUIFont(e.target.value);
  };
}

// ---------- Save ----------

async function exportState() {

  const payload = {
    uiLanguage: state.uiLanguage,
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

  await DialogManager.showDialog({
    layout: "alert",
    title: t("ui.success"),
    message: t("ui.exportProgressSuccess"),
    icon: "success",
    iconColor: "#4caf50"
  });  

}

async function importState(file) {
  const result = await DialogManager.showDialog({
    layout: "confirm",
    title: t("ui.overwriteSaveData"),
    message: t("ui.overwriteSaveDataWarning"),
    icon: "warning",
    iconColor: "#f9a825"
  });

  if (result !== "confirm") return;

  const reader = new FileReader();

  reader.onload = e => {
    try {
      const imported = JSON.parse(e.target.result);

      if (!isValidState(imported)) {
        throw new Error(t("ui.invalidFile"));
      }

      state.uiLanguage = imported.uiLanguage ?? state.uiLanguage;
      state.bookState = imported.bookState ?? {};
      state.theme = imported.theme ?? state.theme;
      state.uiFont = imported.uiFont ?? state.uiFont;      

      state.save();

      renderCurrentView();

    } catch (e) {
        DialogManager.showDialog({
        layout: "alert",
        title: t("ui.warning"),
        message: t("ui.invalidFile"),
        icon: "error",
        iconColor: "#f44336"
      });        
    }
  };

  reader.readAsText(file);

  await DialogManager.showDialog({
    layout: "alert",
    title: t("ui.success"),
    message: t("ui.importProgressSuccess"),
    icon: "success",
    iconColor: "#4caf50"
  });  
}

async function resetState() {
  const result = await DialogManager.showDialog({
    layout: "confirm",
    title: t("ui.deleteSave"),
    message: t("ui.deleteSaveWarning"),
    icon: "warning",
    iconColor: "#f9a825"
  });

  if (result !== "confirm") return;
  
  state.clear();

  await DialogManager.showDialog({
    layout: "alert",
    title: t("ui.success"),
    message: t("ui.deleteProgressSuccess"),
    icon: "success",
    iconColor: "#4caf50"
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

  await FontManager.loadGoogleFonts();

  await loadAvailableUILanguages();

  const language = resolveUILanguage();

  await loadUILanguage(language);
  
  await openLibrary();

  renderBottomBar();
}

export const UIManager = {
  init
};
