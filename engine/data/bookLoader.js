import state from "../core/state.js";
import { EnemyRegistry } from "../combat/enemyRegistry.js";
import { FetchUtils } from "../utils/fetchUtils.js";
import { t } from "../i18n/globalI18n.js";
import { ThemeManager } from "../ui/themeManager.js";
import { FontManager } from "../ui/fontManager.js";
import { StoryAssembler } from "./storyAssembler.js";

// ---------- Manifest ----------

async function loadBookManifest(bookId) {
  if (!bookId) {
    throw new Error(t("error.invalidBook"));
  }

  return FetchUtils.fetchJSON(`books/${bookId}/book.json`);
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

  return FetchUtils.fetchJSON(
    `books/${bookId}/language/index.json`
  );
}

export async function loadBookLocalizedData(bookId) {
  if (!bookId) {
    throw new Error(t("error.invalidBook"));
  }

  const language = await resolveBookLanguage(bookId);

  return FetchUtils.fetchJSON(
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
  return FetchUtils.fetchJSON("books/index.json");
}

export function getCurrentBook() {
  return currentBook;
}

function setCurrentBook(bookData) {
  if (!bookData || !bookData.manifest || !bookData.manifest.id) {
    throw new Error(t("error.invalidBook"));
  }

  currentBook = bookData;
  state.currentBookId = bookData.manifest.id;
  state.save();
}

export async function initBookState(bookId) {
  if (!bookId) {
    throw new Error(t("error.invalidBook"));
  }

  const book = getCurrentBook();
  const story = book.story;

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
  if (story.items?.items) {
    Object.entries(story.items.items).forEach(
      ([id, config]) => {
        initialItems[id] = config.initial ?? 0;
      }
    );
  }

  // Store playerHpVar/playerXpVar so combatEngine can reference them
  // without needing to know the book structure
  const playerHpVar = story.player?._playerHpVar ?? null;
  const playerXpVar = story.player?._playerXpVar ?? null;

  state.persistGameData(bookId, {
    progress: {
      variables: initialVariables,
      items: initialItems,
      _playerHpVar: playerHpVar,
      _playerXpVar: playerXpVar
    },
    settings: {
      language: language,
      font: font,
      theme: theme
    },
  });
 }

export async function loadBook(bookId) {
  if (bookCache.has(bookId)) {
    const book = bookCache.get(bookId);
    setCurrentBook(book);
    return book;
  }

  const manifest = await loadBookManifest(bookId);
  const story = await StoryAssembler.loadBookStory(bookId);

  // Initialize enemy registry with data from this book
  EnemyRegistry.setEnemyData(story.enemies ?? null);  

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

/**
 * Injects a book-specific CSS override.
 * If books/{bookId}/style.css does not exist, the browser silently ignores
 * the 404 — no error handling needed.
 */
export function loadBookCSS(bookId) {
  // Remove any previously loaded book CSS
  unloadBookCSS();

  const link = document.createElement("link");
  link.rel = "stylesheet";
  link.href = `books/${bookId}/style.css`;
  link.id = "gaboma-book-style";
  document.head.appendChild(link);
}

/**
 * Removes the book-specific CSS override, restoring system styles.
 */
export function unloadBookCSS() {
  document.getElementById("gaboma-book-style")?.remove();
}

export const BookLoader = {
  loadLibrary, 
  resetLibraryCache,
  resolveBookLanguage,
  loadAllBooksLocalizedData, 
  resetBooksLanguageCache,
  loadBookLanguageList,
  loadBookLocalizedData, 
  initBookState,
  getCurrentBook, 
  loadBook,
  getBookHomeConfig,
  loadBookCSS,
  unloadBookCSS
};
