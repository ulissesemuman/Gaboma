import { TextManager } from "./textManager.js";
import { registerVisualEvent } from "./uiManager.js";


export function showChapterFeedback(messageKeyOrText, extraContext = {}) {
  if (!messageKeyOrText) return;

  // 1️⃣ Resolver texto (livro primeiro)
  let text = tb(messageKeyOrText);

  // Se tb não traduziu (retornou a própria chave)
  if (text === messageKeyOrText) {
    const globalText = t(messageKeyOrText);
    if (globalText !== messageKeyOrText) {
      text = globalText;
    }
  }

  // 2️⃣ Substituir variáveis {var}
  text = TextManager.interpolateVariables(text, extraContext);

  // 3️⃣ Renderizar
  renderFeedback(text);

  // 4️⃣ Registrar no histórico como event visual
  registerVisualEvent({
    type: "message",
    text
  });
}

function renderFeedback(text) {
  const container = document.getElementById("chapter-feedback");
  if (!container) return;

  const msg = document.createElement("div");
  msg.className = "chapter-feedback-message";
  msg.textContent = text;

  container.appendChild(msg);

  // Auto remover após 4s (opcional)
  setTimeout(() => {
    msg.classList.add("fade-out");
    setTimeout(() => msg.remove(), 300);
  }, 4000);
}