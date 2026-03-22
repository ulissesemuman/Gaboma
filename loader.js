import { UIManager } from "./engine/ui/uiManager.js";
import { BookLoader } from "./engine/data/bookLoader.js";

async function initApp() {
  const params = new URLSearchParams(window.location.search);
  const bookUrl = params.get("bookUrl");

  await UIManager.init(bookUrl ?? null);

  window._gaboma = { BookLoader };
}

initApp().catch(error => {
  console.error("Error loading app:", error);
});
