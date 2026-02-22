import { Utils } from "./utils.js";

const STORAGE_KEY = "gaboma_state";

const state = {
  uiLanguage: null,
  availableUILanguages: [],
  currentView: null, // "library", "book-home", "reader"
  uiTheme: null,  
  uiFont: null,
  defaultUITheme: "gaboma",
  defaultUIFont: "crimson",
 
  currentBookId: null,
  lastBookId: null,

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
                  currentChapterId: null,
                  turn: 0,
                  history: [],
                  variables: {},
                  items: {},
                  combat: null,
                  gameover: false,
                  chaptersVisited: {}
                  },
        stats: {
                  totalChaptersVisited: 0,
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

    if (data.progress?.currentChapterId !== undefined) {
      bookState.progress.currentChapterId = data.progress.currentChapterId;
    }

    if (data.progress?.turn !== undefined) {
      bookState.progress.turn = data.progress.turn;
    }

    if (data.progress?.combat !== undefined) {
      Utils.mergeStrict(bookState.progress.combat, data.progress.combat);
    }

    if (data.progress?.variables) {
      Utils.mergeDynamic(bookState.progress.variables, data.progress.variables);
    }

    if (data.progress?.items) {
      Utils.mergeDynamic(bookState.progress.items, data.progress.items);
    }

    if (data.progress?.chaptersVisited) {
      Utils.mergeDynamic(bookState.progress.chaptersVisited, data.progress.chaptersVisited);
    }

    if (data.settings) {
      Utils.mergeStrict(bookState.settings, data.settings);
    }

    if (data.metadata) {
      Utils.mergeStrict(bookState.metadata, data.metadata);
    }

    if (data.stats) {
      Utils.mergeStrict(bookState.stats, data.stats);
    }    

    if (data.progress?.addHistory) {
      const entries = Array.isArray(data.progress.addHistory)
        ? data.progress.addHistory
        : [data.progress.addHistory];

      entries.forEach(entry => {
        bookState.progress.history.push({
          ...entry
        });
      });
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
