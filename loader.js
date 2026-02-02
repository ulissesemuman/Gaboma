import { UIManager } from "./engine/uiManager.js";

async function initApp() {
  await UIManager.init();
}

initApp().catch(error => {
  console.error("Error loading app:", error);
});
