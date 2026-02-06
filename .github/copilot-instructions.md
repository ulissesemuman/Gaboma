<!-- Copilot instructions for this repository. Keep concise and codebase-specific. -->
# Project-specific guidance for AI coding agents

This file gives focused, actionable guidance to help an AI agent be immediately productive editing this repository.

- **Big picture**: This is a static, browser-first gamebook manager. The app is a set of ES modules under `engine/` and JSON-backed books under `books/`. The app boots `loader.js` which calls `UIManager.init()` and expects to be served over HTTP (native `fetch` is used for JSON and assets).

- **Major components**:
  - `engine/` — core modules (UI, state, i18n, book manager, reader).
    - `engine/uiManager.js` — orchestrates DOM views (`#library`, `#book-home`, `#game`), language selectors, and boot sequence (`UIManager.init`).
    - `engine/bookManager.js` — loads `books/index.json` and per-book manifests (`books/<id>/book.json`) and localized book metadata (`books/<id>/language/*.json`).
    - `engine/i18n.js` — exposes `loadUILanguage(lang)`, `t(key)` for UI translation, and `loadBookLanguage(bookId, lang)`, `tb(key)` for book-specific translations.
    - `engine/reader.js` — renders chapters and uses helpers from UI modules (reader code uses global or cross-module helpers; double-check imports when editing).
    - `engine/state.js` — central runtime state (persisted methods such as `state.save()`, `state.hasProgress()`, `state.startNewBook()` are referenced elsewhere; search for their implementations).

- **Data layout & patterns**:
  - Books: `books/<bookId>/book.json` (manifest), `books/<bookId>/language/index.json` lists supported languages, localized strings at `books/<bookId>/language/<lang>.json`, story data at `books/<bookId>/story/story.json`, assets under `books/<bookId>/assets/`.
  - UI translations: `language/<lang>.json` with `language/index.json` listing available UI languages.
  - Fetch pattern: modules commonly use a `fetchJSON` helper and rely on HTTP fetching. Assume the app runs on a local static server during development.

- **Cross-file conventions**:
  - Many UI interactions rely on specific DOM IDs: `library`, `book-home`, `game`, `bottom-bar`, `ui-language`, `config-overlay`, `config-popup`. Use these IDs when adding UI elements or handlers.
  - Translations use `t("key.path")` for UI and `tb("key")` for book-localized strings — prefer these helpers instead of hard-coding text.
  - Modules export named functions; `UIManager` is exported as an object with `init`.

- **Run / debug (developer workflow)**:
  - Serve the project root over HTTP before opening `index.html` (otherwise `fetch` will fail). Example commands run from project root:

```bash
# With node (recommended):
npx http-server -c-1 .

# Or with Python 3:
python -m http.server 8000
```

  - Open the served URL (e.g., `http://localhost:8080` or `:8000`) in a browser and use DevTools console to inspect fetch errors or missing imports.

- **Editing guidance & examples**:
  - To add new book metadata, create `books/<id>/book.json` and `books/<id>/language/index.json` plus at least one `<lang>.json` file.
  - When changing UI text, update `language/<lang>.json` and use `t("...")` in code.
  - When adding functions used across modules, prefer explicit named imports/exports rather than relying on globals. Example: if `reader.js` uses `setBottomBar` and `t`, either import them or ensure the module providing them exports them and the importer imports them.
  - No build step: the code uses native ES modules. Keep file paths stable and use relative imports like `./engine/uiManager.js`.

- **Integration points to check when making changes**:
  - Calls to `state.*` methods in UI code (`state.save()`, `state.hasProgress()`, `state.startNewBook()`) — locate and verify their implementations before refactoring state shape.
  - `loadBookLocalizedData(bookId, lang)` is async and used inside list rendering; avoid blocking UI by batching or preloading when adding large books.
  - Reader rendering is split between `reader.js` and `uiManager.js` — search for cross-file references (`renderCurrentChapter`, `openReader`, `openBookHome`) when modifying reader flow.

- **What not to change without checking**:
  - DOM IDs in `index.html` — many modules target them directly.
  - The JSON structure under `books/` (manifest keys and language index shape) — changing keys requires updates across `bookManager.js`, `uiManager.js`, and templates.

If any section seems incomplete or you want more examples (e.g., `state` methods or the reader flow), say which area and I will expand with exact file references and code snippets.
