const STORAGE_KEY = "gamebook.state";

const state = {
  // ----- Interface -----
  uiLanguage: "en-us",
  availableUILanguages: [],
  currentView: null, // "library", "book-home", "book-reading"

  // ----- Biblioteca -----
  books: {},            // { [bookId]: bookManifest }
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
      currentBook: this.currentBook,
      bookState: this.bookState
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
      this.currentBook = data.currentBook ?? null;
      this.bookState = data.bookState ?? {};
    } catch (err) {
      console.error("Erro ao carregar estado:", err);
    }
  },

  clear() {
    localStorage.removeItem(STORAGE_KEY);
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
