import state from "./state.js";
import { Utils } from "./utils.js";

// ---------- Library ----------

let libraryCache = null;

export async function loadLibrary() {
  if (libraryCache) return libraryCache;

  const index = await Utils.fetchJSON("books/index.json");
  const books = {};

  for (const bookId of index.books) {
    const manifest = await Utils.fetchJSON(`books/${bookId}/book.json`);
    books[bookId] = manifest;
  }

  libraryCache = books;
  return books;
}

export function resetLibraryCache() {
  libraryCache = null;
}

export async function loadBookLocalizedData(bookId, language) {
  const index = await Utils.fetchJSON(
    `books/${bookId}/language/index.json`
  );

  let lang = language;

  if (!index.languages.includes(lang)) {
    lang = index.languages[0];
  }

  const data = await Utils.fetchJSON(
    `books/${bookId}/language/${lang}.json`
  );

  return data;
}

// Cache interno
const booksLanguageCache = {};

/**
 * Carrega os dados de idioma de TODOS os livros.
 * Aplica fallback em cadeia:
 * 1) idioma solicitado
 * 2) idioma salvo no state.bookState[bookId]
 * 3) defaultLanguage do manifest
 * 4) primeiro idioma disponível
 */
export async function loadAllBooksLocalizedData(language) {
  const booksIndex = await Utils.fetchJSON("books/index.json");

  const result = {};

  for (const bookId of booksIndex.books) {

    // 1️⃣ Se já estiver em cache, reutiliza
    if (
      booksLanguageCache[bookId] &&
      booksLanguageCache[bookId][language]
    ) {
      result[bookId] = booksLanguageCache[bookId][language];
      continue;
    }

    // 2️⃣ Carrega manifest
    const manifest = await Utils.fetchJSON(
      `books/${bookId}/book.json`
    );

    // 3️⃣ Carrega índice de idiomas do livro
    const langIndex = await Utils.fetchJSON(
      `books/${bookId}/language/index.json`
    );

    const available = langIndex.languages;

    // ---------- FALLBACK EM CADEIA ----------
    let finalLang = language;

    if (!available.includes(finalLang)) {

      // tenta idioma salvo no state
      const savedLang =
        state.bookState?.[bookId]?.language;

      if (savedLang && available.includes(savedLang)) {
        finalLang = savedLang;
      }

      // tenta defaultLanguage do manifest
      else if (
        manifest.defaultLanguage &&
        available.includes(manifest.defaultLanguage)
      ) {
        finalLang = manifest.defaultLanguage;
      }

      // fallback final
      else {
        finalLang = available[0];
      }
    }

    // 4️⃣ Carrega arquivo de idioma
    const localizedData = await Utils.fetchJSON(
      `books/${bookId}/language/${finalLang}.json`
    );

    const bookLocalized = {
      language: finalLang,
      manifest,           // opcional: já devolve manifest
      data: localizedData
    };

    // 5️⃣ Atualiza cache
    if (!booksLanguageCache[bookId]) {
      booksLanguageCache[bookId] = {};
    }
    booksLanguageCache[bookId][finalLang] = bookLocalized;

    result[bookId] = bookLocalized;
  }

  return result;
}

// ---------- Book ----------

let currentBook = null;
const bookCache = new Map();

export async function loadBookStory(bookId) {
  return fetchJSON(`books/${bookId}/story/story.json`);
}

export async function loadBookLanguages(bookId) {
  const index = await fetchJSON(`books/${bookId}/language/index.json`);
  return index.languages;
}

export function getCurrentBook() {
  return currentBook;
}

export function setCurrentBook(bookData) {
  if (!bookData || !bookData.id) {
    throw new Error(t("error.invalidBook"));
  }

  currentBook = bookData;
  state.currentBookId = bookData.id;
  state.save();
}

export async function loadBook(bookId) {
  if (bookCache.has(bookId)) {
    const book = bookCache.get(bookId);
    setCurrentBook(book);
    return book;
  }

  const manifest = await Utils.fetchJSON(`books/${bookId}/book.json`);
  const story = await Utils.fetchJSON(`books/${bookId}/story/story.json`);

  const book = {
    ...manifest,
    story
  };

  bookCache.set(bookId, book);
  setCurrentBook(book);

  return book;
}

export const BookManager = {
  loadLibrary, 
  loadBookLocalizedData, 
  loadAllBooksLocalizedData, 
  getCurrentBook, 
  setCurrentBook, 
  loadBook
};
