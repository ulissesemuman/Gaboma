import state from "./state.js";
import { Utils } from "./utils.js";
import { t } from "./i18n.js";
import { ThemeManager } from "./themeManager.js";
import { FontManager } from "./fontManager.js";

// ---------- Manifest ----------

async function loadBookManifest(bookId) {
  if (!bookId) {
    throw new Error(t("error.invalidBook"));
  }

  return Utils.fetchJSON(`books/${bookId}/book.json`);
}

// ---------- Library ----------

let libraryCache = null;

export async function loadLibrary() {
  if (libraryCache) return libraryCache;

  const index = await loadBooksList();
  const books = {};

  for (const bookId of index.books) {
    const manifest = await loadBookManifest(bookId);
    books[bookId] = manifest;
  }

  libraryCache = books;
  return books;
}

export function resetLibraryCache() {
  libraryCache = null;
}

// ---------- Localization ----------

export async function loadBookLanguageList(bookId) {
  if (!bookId) {
    throw new Error(t("error.invalidBook"));
  }

  return Utils.fetchJSON(
    `books/${bookId}/language/index.json`
  );
}

export async function loadBookLocalizedData(bookId) {
  if (!bookId) {
    throw new Error(t("error.invalidBook"));
  }

  const language = await resolveBookLanguage(bookId);

  return Utils.fetchJSON(
    `books/${bookId}/language/${language}.json`
  );
}

export async function resolveBookLanguage(bookId) {
  const index = await loadBookLanguageList(bookId);
  const available = index.languages;

  const savedBookLang =
    state.bookState?.[bookId]?.language;

  if (savedBookLang) {
    return savedBookLang;
  }

  const manifest = await loadBookManifest(bookId);

  if (manifest.defaultLanguage) {
    return manifest.defaultLanguage;
  }

  if (available.includes(state.uiLanguage)) {
    return state.uiLanguage;
  }

  return available[0];
}

const booksLanguageCache = {};

export async function loadAllBooksLocalizedData() {
  const booksIndex = await loadBooksList();
  const result = {};

  for (const bookId of booksIndex.books) {
    const language = await resolveBookLanguage(bookId);

    if (booksLanguageCache[bookId] &&
      booksLanguageCache[bookId][language]) {
      result[bookId] = booksLanguageCache[bookId][language];
      continue;
    }

    const localizedData = await loadBookLocalizedData(bookId, language);

    const bookLocalized = {
      language: language,
      data: localizedData
    };

    if (!booksLanguageCache[bookId]) {
      booksLanguageCache[bookId] = {};
    }
    booksLanguageCache[bookId][language] = bookLocalized;

    result[bookId] = bookLocalized;
  }

  return result;
}

export function resetBooksLanguageCache() {
  for (const key in booksLanguageCache) {
    delete booksLanguageCache[key];
  } 
}  

// ---------- Book ----------

let currentBook = null;
const bookCache = new Map();

async function loadBooksList() {
  return Utils.fetchJSON("books/index.json");
}

async function loadBookStory(bookId) {
  if (!bookId) {
    throw new Error(t("error.invalidBook"));
  }

  const basePath = `books/${bookId}/story`;

  const story = await Utils.fetchJSON(`${basePath}/story.json`);

  const variables = await Utils.fetchJSONOptional(`${basePath}/variables.json`);
  const items = await Utils.fetchJSONOptional(`${basePath}/items.json`);
  const enemies = await Utils.fetchJSONOptional(`${basePath}/enemies.json`);
  const highlights = await Utils.fetchJSONOptional(`${basePath}/highlights.json`);  

  return {
    ...story,
    variables: variables ?? {},
    items: items ?? {},
    enemies: enemies ?? {},
    highlights: highlights ?? {}
  };
}

export function getCurrentBook() {
  return currentBook;
}

export function setCurrentBook(bookData) {
  if (!bookData || !bookData.manifest || !bookData.manifest.id) {
    throw new Error(t("error.invalidBook"));
  }

  currentBook = bookData;
  state.currentBookId = bookData.manifest.id;
  state.save();
}

export async function setBookState(bookId) {
  if (!bookId) {
    throw new Error(t("error.invalidBook"));
  }

  const book = await getCurrentBook();
  const { manifest, story } = book;

  const defaultStartChapter = manifest.start;

  const currentBookChapter = state.currentBookChapter || defaultStartChapter;
  const language = await resolveBookLanguage(bookId);
  const font = FontManager.resolveFont(bookId);
  const theme = ThemeManager.resolveTheme(bookId);
 
  const initialVariables = {};
  if (story.variables) {
    Object.entries(story.variables).forEach(
      ([id, config]) => {
        if (config.type === "boolean") {
          initialVariables[id] = config.initial ?? false;
          return;
        }

        initialVariables[id] = config.initial ?? 0;
      }
    );
  }

  const initialItems = {};
  if (story.items) {
    Object.entries(story.items).forEach(
      ([id, config]) => {
        initialItems[id] = config.initial ?? 0;
      }
    );
  }

  state.persistGameData(bookId, {
    progress: {
      currentChapter: currentBookChapter
    },
    settings: {
      language: language,
      font: font,
      theme: theme
    },
    variables: initialVariables,
    items: initialItems
  });
 }

export async function loadBook(bookId) {
  if (bookCache.has(bookId)) {
    const book = bookCache.get(bookId);
    setCurrentBook(book);
    return book;
  }

  const manifest = await loadBookManifest(bookId);
  const story = await loadBookStory(bookId);

  const book = {
    manifest,
    story
  };

  bookCache.set(bookId, book);
  setCurrentBook(book);

  return book;
}

export async function getBookHomeConfig(bookId) {
  if (!bookId) {
    throw new Error(t("error.invalidBook"));
  }

  const manifest = await loadBookManifest(bookId);

  const home = manifest?.home ?? {};
  const cover = home?.cover ?? {};

  return {
    showTitle: home.showTitle ?? true,
    showSummary: home.showSummary ?? true,

    cover: {
      front: cover.front ?? "cover.png",
      back: cover.back ?? null,
      allowFlip: cover.allowFlip ?? false
    }
  };
}

export const BookManager = {
  loadLibrary, 
  resetLibraryCache,
  resolveBookLanguage,
  loadAllBooksLocalizedData, 
  resetBooksLanguageCache,
  loadBookLanguageList,
  loadBookLocalizedData, 
  setBookState,
  getCurrentBook, 
  setCurrentBook, 
  loadBook,
  getBookHomeConfig
};
