const STORAGE_KEY = "gaboma_state";

const state = {
  // ----- Interface -----
  uiLanguage: null,
  availableUILanguages: [],
  currentView: null, // "library", "book-home", "book-reading"
  theme: null,  
  uiFont: null,
  defaultTheme: "gaboma",
  defaultUIFont: "crimson",

  // ----- Biblioteca -----
  currentBookId: null,

  // ----- Livro atual -----
  currentBookLanguage: null,
  currentBookChapter: null,

  // ----- Progresso por livro -----
  bookState: {
     // [bookId]: {
     //   language: "pt-br",
     //   currentChapter: "intro",
     //   theme: "gaboma",
     //   font: "crimson",
     //   flags: {},
     //}
  },

  save() {
    const payload = {
      uiLanguage: this.uiLanguage,
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
        theme: null,
        font: null,
        flags: {}
      };
    }

    return state.bookState[bookId];
  },

  hasProgress(bookId) {
    const progress = this.bookState?.[bookId];
    return progress && progress.currentChapter;
  }
};

export default state;
