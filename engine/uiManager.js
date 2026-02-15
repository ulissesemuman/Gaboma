import state from "./state.js";
import { BookManager } from "./bookManager.js";
import { loadUILanguage, loadAvailableUILanguages, loadBookLanguage, t, tb } from "./i18n.js";
import { Reader } from "./reader.js";
import { ThemeManager } from "./themeManager.js";
import { FontManager } from "./fontManager.js";
import { DialogManager } from "./dialogManager.js";
import { Engine } from "./engine.js";

// ---------- UI ----------

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

function renderCurrentView() {
  switch (state.currentView) {
    case "library":
      openLibrary();
      break;

    case "book-home":
      openBookHome();
      break;

    case "reader":
      renderReader(state.currentBookChapter);
      break;

    default:
      console.warn(t("ui.unknownView", { view: state.currentView }));
      openLibrary();
  }
}

function prepareView(viewId) {
  const viewEl = document.getElementById(viewId);

  if (!viewEl) {
    console.warn(t("ui.unknownView", { view: viewId }));
    return null;
  }

  clearUI();

  viewEl.style.display = "block";

  state.currentView = viewId;  

  renderBottomBar();

  return viewEl;
}

function applyUIVisualIdentity() {
  ThemeManager.setUITheme();
  FontManager.setUIFont();
}

// ---------- UI Language ----------

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

async function setUILanguage(language) {
  await loadUILanguage(language);

  renderCurrentView();

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

  renderLibrary(books, localized);
}

function renderLibrary(books, localized) {

  const libraryEl = prepareView("library");
  if (!libraryEl) {
    throw new Error("renderLibrary: " + t("error.elementNotFound", { element: "#library" }));
  }

  applyUIVisualIdentity();  

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
      state.currentBookId = book.id;
      openBookHome();
    };

    libraryEl.appendChild(card);
  }
}

// ---------- Book Home ----------

async function openBookHome() {

  const bookId = state.currentBookId;
  const book = BookManager.getCurrentBook();  

  if (bookId !== state.currentBookId || !book) {
    await BookManager.loadBook(bookId);

    if (!state.bookState?.[bookId]) {
      await BookManager.setBookState(bookId);
    }
  }

  await loadBookLanguage(bookId, state.bookState[bookId].settings.language);

  const localized = await BookManager.loadBookLocalizedData(bookId);
  const bookHomeConfig = await BookManager.getBookHomeConfig(bookId);  

  renderBookHome(bookId, localized, bookHomeConfig);
}

function renderBookHome(bookId, localized, bookHomeConfig) {

  const homeEl = prepareView("book-home");
  if (!homeEl) {
    throw new Error("renderBookHome: " + t("error.elementNotFound", { element: "#book-home" }));
  }

  applyBookVisualIdentity(bookId);

  const coverConfig = bookHomeConfig.cover;
  let coverImg = coverConfig.front;

  homeEl.innerHTML = `
    <div class="book-home-container">
      <div id="book-cover-wrapper" class="book-cover-wrapper">
        <img
          id="book-cover"
          class="book-cover"
          src="books/${bookId}/assets/covers/${coverImg}"
          alt="${localized.title}"
        />
        <button id="toggle-cover" title="Virar capa">
          ↺
        </button>
      </div>

      <div id="book-summary" class="book-summary">
        <h1 id="book-title">${localized.title}</h1>
        <p id="book-summary-text">${localized.summary}</p>
      </div>

      <div class="book-actions">
        <button id="book-action">
          ${t("book.start")}
        </button>
      </div>
    </div>
  `;

  if (!bookHomeConfig.showTitle)
  {
    document.getElementById("book-title").style.display = "none";
  }

  if (!bookHomeConfig.showSummary)
  {
    document.getElementById("book-title").style.display = "none";
  }

  if (!bookHomeConfig.showTitle  && !bookHomeConfig.showSummary)
  {
    document.getElementById("book-summary").style.display = "none";
  }

  if (coverConfig.allowFlip)
  {
    document.getElementById("toggle-cover").onclick = () => {
      coverImg = coverImg === 
        coverConfig.front ? coverConfig.back : coverConfig.front;

      let img = document.getElementById("book-cover");

      img.src = `books/${bookId}/assets/covers/${coverImg}`;
    };
  }   
  else
  {
    document.getElementById("toggle-cover").style.display = "none";
  }

  if (state.hasProgress(bookId)) {
    document.getElementById("book-action").textContent = t("book.continue");
  }

  document.getElementById("book-action").onclick = () => {
    openReader();
  };
}

function hasActiveBookContext() {
  return (
    state.currentView === "book-home" ||
    state.currentView === "reader"
  );
}

function applyBookVisualIdentity(bookId) {
  ThemeManager.setBookTheme(bookId);
  FontManager.setBookFont(bookId);  
}

// ---------- Book Language ----------

async function bindBookLanguageSelector(selectEl) {
  if (!selectEl) {
    throw new Error("bindBookLanguageSelector: " + t("error.elementNotFound", { element: "#selectEl" }));
  }

  const bookId = state.currentBookId;
  const index = await BookManager.loadBookLanguageList(bookId);
  const languages = index.languages;

  selectEl.innerHTML = "";

  languages.forEach(lang => {
    const option = document.createElement("option");
    option.value = lang;
    option.textContent = lang;
    selectEl.appendChild(option);
  });

  selectEl.value = await BookManager.resolveBookLanguage(state.currentBookId);

  selectEl.onchange = async (e) => {
    await setBookLanguage(bookId, e.target.value);
  };
}

async function setBookLanguage(bookId, language) {
  await loadBookLanguage(bookId, language);

  renderCurrentView();

  if (isConfigPopupOpen()) {
    renderConfigPopup();
  }
}

// ---------- Reader ----------

 function openReader() {
  const book = BookManager.getCurrentBook();

  if (!book?.story) {
    console.error("Livro sem story carregada.");
    return;
  }

  Reader.loadStory(book.story);

  let chapter = null

  const bookId = state.currentBookId;
  
  if (state.hasProgress(bookId)) {
    chapter = Reader.goToChapter(state.bookState[bookId].progress.currentChapter);
  } else {
    chapter = Reader.startStory();
  }

  renderReader(chapter);
}

export function renderReader(chapter) {
  
 const readerEl = prepareView("reader");
  if (!readerEl) {
    throw new Error("renderReader: " + t("error.elementNotFound", { element: "#reader" }));
  }

  const bookId = state.currentBookId;

  applyBookVisualIdentity(bookId);

  // Texto
  chapter.text.forEach(paragraph => {
    const p = document.createElement("p");
    p.textContent = tb(paragraph);
    readerEl.appendChild(p);
  });

  // Se não houver escolhas → fim
  if (!chapter.choices || chapter.choices.length === 0) {
    const endBtn = document.createElement("button");
    endBtn.textContent = tb("book.restart");
    endBtn.onclick = () => {
      const newChapter = Reader.startStory();
      renderReader(newChapter);
    };

    readerEl.appendChild(endBtn);
    return;
  }

  const resolved = Engine.resolveChapter(chapter);
  const choices = resolved.choices;

  // Choices
  choices.forEach(choice => {
    const btn = document.createElement("button");
    btn.textContent = tb(choice.text);

    btn.onclick = () => {
      const nextChapter = Reader.goToChapter(choice.next);
      //const nextChapter = Engine.choose(choice.next);
      renderReader(nextChapter);
    };

    readerEl.appendChild(btn);
  });
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
  const hasBook = hasActiveBookContext();

  let html = `
      <h2>${t("ui.settings")}</h2>
  `;

  html += `
    <div class="config-tabs">
      <button class="config-tab active" data-tab="general">
        Geral
      </button>
      <button class="config-tab" data-tab="book">
        Livro Atual
      </button>
    </div>
  `;  

  html += `
    <div class="config-content">
  `;  

  html += `
      <div class="config-panel active" data-panel="general">

        <div class="config-section">
          <label for="ui-language-selector">
            ${t("ui.chooseUILanguage")}
          </label>
          <select id="ui-language-selector"></select>
        </div>

        <div class="config-section">
          <label for="ui-theme-selector">
            ${t("ui.chooseUITheme")}
          </label>
          <select id="ui-theme-selector"></select>
        </div>

        <div class="config-section">
          <label for="ui-font-selector">
            ${t("ui.chooseUIfont")}
          </label>
          <select id="ui-font-selector"></select>
        </div>

      </div>
  `;

  html += `
      <div class="config-panel" data-panel="book">

        <div class="config-section">
          <label for="book-language-selector">
            ${t("ui.chooseBookLanguage")}
          </label>
          <select id="book-language-selector" ${!state.currentBookId ? "disabled" : ""}></select>
        </div>

        <div class="config-section">
          <label for="book-theme-selector">
            ${t("ui.chooseBookTheme")}
          </label>
          <select id="book-theme-selector" ${!state.currentBookId ? "disabled" : ""}></select>
        </div>

        <div class="config-section">
          <label for="book-font-selector">
            ${t("ui.chooseBookFont")}
          </label>
          <select id="book-font-selector" ${!state.currentBookId ? "disabled" : ""}></select>
        </div>

      </div>
  `;

  html += `
    </div>
  `;  

  html += `
    <div class="config-section">
      <button id="export-progress">${t("ui.exportProgress")}</button>
      <button id="import-progress">${t("ui.importProgress")}</button>
      <button id="reset-progress">${t("ui.resetProgress")}</button>
    </div>
  `;

  popup.innerHTML = html;

  bindUILanguageSelector(
    popup.querySelector("#ui-language-selector")
  );

  bindUIThemeSelector(
    popup.querySelector("#ui-theme-selector")
  );

  bindUIFontSelector(
    popup.querySelector("#ui-font-selector")
  );    

  if (state.currentBookId) {
    bindBookLanguageSelector(
      popup.querySelector("#book-language-selector")
    );

    bindBookThemeSelector(
      popup.querySelector("#book-theme-selector")
    );

    bindBookFontSelector(
      popup.querySelector("#book-font-selector")  
    );    
  }

  bindProgressButtons();
  
  bindConfigTabs()
}

function bindConfigTabs() {
  const tabs = document.querySelectorAll(".config-tab");
  const panels = document.querySelectorAll(".config-panel");

  tabs.forEach(tab => {
    tab.onclick = () => {
      const target = tab.dataset.tab;

      tabs.forEach(t => t.classList.remove("active"));
      panels.forEach(p => p.classList.remove("active"));

      tab.classList.add("active");
      document
        .querySelector(`[data-panel="${target}"]`)
        .classList.add("active");
    };
  });
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

// ---------- Themes ----------

async function bindUIThemeSelector(selectEl) {
  if (!selectEl) {
    throw new Error("bindThemeSelector: " + t("error.elementNotFound", { element: "#selectEl" }));
  }

  const themes = ThemeManager.getThemesList();
  
  selectEl.innerHTML = "";

  themes.forEach(theme => {
    const option = document.createElement("option");
    option.value = theme.id;
    option.textContent = theme.name;
    selectEl.appendChild(option);
  });

  selectEl.value = ThemeManager.resolveTheme();

  selectEl.onchange = e => {
    ThemeManager.setUITheme(e.target.value);
  };  
}

async function bindBookThemeSelector(selectEl) {
  if (!selectEl) {
    throw new Error("bindBookThemeSelector: " + t("error.elementNotFound", { element: "#selectEl" }));
  }

  const bookId = state.currentBookId;
  const bookState = state.bookState[bookId];  

  const themes = ThemeManager.getThemesList();
  
  selectEl.innerHTML = "";

  themes.forEach(theme => {
    const option = document.createElement("option");
    option.value = theme.id;
    option.textContent = theme.name;
    selectEl.appendChild(option);
  });

  selectEl.value = ThemeManager.resolveTheme(bookId);

  selectEl.onchange = e => {
    bookState.theme = e.target.value;
    state.save();

    ThemeManager.setBookTheme(bookId, e.target.value);
  };  
}

// ---------- Fonts ----------

async function bindUIFontSelector(selectEl) {
  if (!selectEl) {
    throw new Error("bindFontSelector: " + t("error.elementNotFound", { element: "#selectEl" }));
  }

  const data = await FontManager.getFontsList();
  
  selectEl.innerHTML = "";

  data["google-fonts"].forEach(font => {
    const option = document.createElement("option");
    option.value = font.id;
    option.textContent = font.name;
    selectEl.appendChild(option);
  });

  selectEl.value = FontManager.resolveFont();

  selectEl.onchange = e => {
    FontManager.setUIFont(e.target.value);
  };
}

async function bindBookFontSelector(selectEl) {
  if (!selectEl) {
    throw new Error("bindBookFontSelector: " + t("error.elementNotFound", { element: "#selectEl" }));
  }

  const bookId = state.currentBookId;
  const bookState = state.bookState[bookId];    

  const data = await FontManager.getFontsList();
  
  selectEl.innerHTML = "";

  data["google-fonts"].forEach(font => {
    const option = document.createElement("option");
    option.value = font.id;
    option.textContent = font.name;
    selectEl.appendChild(option);
  });

  selectEl.value = FontManager.resolveFont(bookId);

  selectEl.onchange = e => {
    bookState.font = e.target.value;
    state.save();

    FontManager.setBookFont(bookId, e.target.value);
  };
}

// ---------- Save ----------

async function exportState() {

  const payload = {
    uiLanguage: state.uiLanguage,
    bookState: state.bookState,
    theme: state.uiTheme,
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
      state.uiTheme = imported.theme ?? state.uiTheme;
      state.uiFont = imported.uiFont ?? state.uiFont;      

      state.save();

      renderCurrentView();

      DialogManager.showDialog({
        layout: "alert",
        title: t("ui.success"),
        message: t("ui.importProgressSuccess"),
        icon: "success",
        iconColor: "#4caf50"
      });       

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

function bindProgressButtons() {
  const exportBtn = document.getElementById("export-progress");
  const resetBtn = document.getElementById("reset-progress");
  const importBtn = document.getElementById("import-progress");

  if (exportBtn) exportBtn.onclick = exportState;
  if (resetBtn) resetBtn.onclick = resetState;
  if (importBtn) importBtn.onclick = () => {
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
