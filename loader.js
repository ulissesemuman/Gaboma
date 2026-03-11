import { UIManager } from "./engine/ui/uiManager.js";
import { BookLoader } from "./engine/data/bookLoader.js";

async function initApp() {
  await UIManager.init();

  window._gaboma = { BookLoader };
}

initApp().catch(error => {
  console.error("Error loading app:", error);
});
