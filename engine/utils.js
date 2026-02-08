export function showDialog({
  title = "",
  message = "",
  buttons = []
}) {
  return new Promise(resolve => {
    const overlay = document.getElementById("dialog-overlay");
    const titleEl = document.getElementById("dialog-title");
    const messageEl = document.getElementById("dialog-message");
    const buttonsEl = document.getElementById("dialog-buttons");

    titleEl.textContent = title;
    messageEl.textContent = message;
    buttonsEl.innerHTML = "";

    buttons.forEach(btn => {
      const button = document.createElement("button");
      button.textContent = btn.label;

      button.onclick = () => {
        overlay.style.display = "none";
        resolve(btn.value);
      };

      buttonsEl.appendChild(button);
    });

    overlay.style.display = "flex";
  });
}

async function fetchJSON(path) {
  const res = await fetch(path);
  if (!res.ok) {
    throw new Error(t("error.failedToLoad", { path }));
  }
  return res.json();
}

export const Utils = {
  fetchJSON,
  showDialog
};