const STORAGE_KEY = "gaboma_state";

const state = {
  // ----- Interface -----
  uiLanguage: "en-us",
  availableUILanguages: [],
  currentView: null, // "library", "book-home", "book-reading"
  theme: null,  
  uiFont: null,
  defaultTheme: "gaboma",
  defaultFont: "crimson",

  // ----- Biblioteca -----
  currentBookId: null,

  // ----- Livro atual -----
  currentBookLanguage: null,

  // ----- Progresso por livro -----
  bookState: {
     // [bookId]: {
     //   language: "pt-br",
     //   currentChapter: "intro",
     //   flags: {},
     //}
  },

  save() {
    const payload = {
      uiLanguage: this.uiLanguage,
      currentBookId: this.currentBookId,
      currentBookLanguage: this.currentBookLanguage,
      bookState: this.bookState,
      theme: this.theme,
      uiFont: this.uiFont
    };

    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
    } catch (err) {
      console.error("Erro ao salvar estado:", err);
    }
  },

  load() {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return;

    try {
      const data = JSON.parse(raw);

      // futura migração de versão aqui
      this.uiLanguage = data.uiLanguage ?? this.uiLanguage;
      this.currentBookId = data.currentBookId ?? null;
      this.currentBookLanguage = data.currentBookLanguage ?? null;
      this.bookState = data.bookState ?? {};
      this.theme = data.theme ?? this.theme;
      this.uiFont = data.uiFont ?? this.uiFont;
    } catch (err) {
      console.error("Erro ao carregar estado:", err);
    }
  },

  clear() {
    localStorage.removeItem(STORAGE_KEY);
  },

  ensureBookState(bookId) {
    if (!state.bookState[bookId]) {
      state.bookState[bookId] = {
        language: null,
        currentChapter: null,
        flags: {}
      };
    }

    return state.bookState[bookId];
  },

  hasProgress(bookId) {
    const progress = this.bookState?.[bookId];
    return progress && progress.currentChapter;
  },

  startBook(bookId, language) {
    this.bookState[bookId] = {
      language,
      currentChapter: "intro",
      flags: {}
    };
    this.save();
  }
};

export default state;
