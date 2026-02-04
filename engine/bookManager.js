import state from "./state.js";

// ---------- Utils ----------

async function fetchJSON(path) {
  const res = await fetch(path);
  if (!res.ok) {
    throw new Error(`Erro ao carregar ${path}`);
  }
  return res.json();
}

// ---------- Library ----------

export async function loadLibrary() {
  const index = await fetchJSON("books/index.json");

  for (const bookId of index.books) {
    const manifest = await fetchJSON(`books/${bookId}/book.json`);
    state.books[bookId] = manifest;
  }

  return state.books;
}

export async function loadBookLocalizedData(bookId, language) {
  const index = await fetchJSON(
    `books/${bookId}/language/index.json`
  );

  let lang = language;

  if (!index.languages.includes(lang)) {
    lang = index.languages[0];
  }

  const data = await fetchJSON(
    `books/${bookId}/language/${lang}.json`
  );

  return data;
}

// ---------- Book ----------

export async function loadBookStory(bookId) {
  return fetchJSON(`books/${bookId}/story/story.json`);
}

export async function loadBookLanguages(bookId) {
  const index = await fetchJSON(`books/${bookId}/language/index.json`);
  return index.languages;
}
