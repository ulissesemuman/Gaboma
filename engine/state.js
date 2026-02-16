import { Utils } from "./utils.js";

const STORAGE_KEY = "gaboma_state";

const state = {
  // ----- Interface -----
  uiLanguage: null,
  availableUILanguages: [],
  currentView: null, // "library", "book-home", "reader"
  uiTheme: null,  
  uiFont: null,
  defaultUITheme: "gaboma",
  defaultUIFont: "crimson",

  // ----- Biblioteca -----
  currentBookId: null,

  // ----- Livro atual -----
  currentBookLanguage: null,

  // ----- Progresso por livro -----
  bookState: {},

  save() {
    const payload = {
      uiLanguage: this.uiLanguage,
      uiTheme: this.uiTheme,
      uiFont: this.uiFont,
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
      this.uiTheme = data.uiTheme ?? this.uiTheme;
      this.uiFont = data.uiFont ?? this.uiFont;
      this.bookState = data.bookState ?? {};
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
        settings: {
                  language: null,
                  theme: null,
                  font: null,
                  },
        progress: {
                  currentChapter: null,
                  turn: 0,
                  history: [],
                  variables: {},
                  items: {},
                  combat: null,
                  },
        stats: {
                  chaptersVisited: 0,
                  combatsWon: 0,
                  deaths: 0
                },
        metadata: {
                  started: false,
                  startedAt: null,
                  lastPlayedAt: null, 
                  version: null,
                  seed : null,
                  checksum: null
                  },
      };
    }

    return state.bookState[bookId];
  },

  persistGameData(bookId, data) {
    if (!bookId) {
      throw new Error("persistGameData: bookId inválido");
    }

    const bookState = state.ensureBookState(bookId);

    Utils.deepMergeDefined(bookState, data);

    if (data.addHistory) {
      bookState.history.push(data.addHistory);
    }

    bookState.metadata.lastPlayedAt = Date.now();
    //bookState.metadata.version = manifest.version;

    state.save();
  },

  hasProgress(bookId) {
    const progress = this.bookState?.[bookId];
    return !!progress?.metadata?.started;
  }
};

export default state;
