const state = {
  // ----- Interface -----
  uiLanguage: null,
  availableUILanguages: [],

  // ----- Biblioteca -----
  books: {},            // { [bookId]: bookManifest }
  currentBookId: null,

  // ----- Livro atual -----
  currentBookLanguage: null,

  // ----- Progresso por livro -----
  bookStates: {
    // [bookId]: {
    //   language: "pt-br",
    //   chapter: "intro",
    //   flags: {},
    // }
  }
};

export default state;
