import { t } from "./i18n.js";

const DialogIcons = {
  error: `
    <svg viewBox="0 0 24 24" fill="currentColor">
      <path d="M12 2L2 22h20L12 2zm0 15h-1v-2h2v2h-1zm0-4h-1V9h2v4h-1z"/>
    </svg>
  `,
  warning: `
    <svg viewBox="0 0 24 24" fill="currentColor">
      <path d="M1 21h22L12 2 1 21zm11-3h-1v-2h2v2h-1zm0-4h-1v-4h2v4h-1z"/>
    </svg>
  `,
  success: `
    <svg viewBox="0 0 24 24" fill="currentColor">
      <path d="M9 16.2l-3.5-3.5L4 14l5 5 12-12-1.5-1.5z"/>
    </svg>
  `,
  info: `
    <svg viewBox="0 0 24 24" fill="currentColor">
      <path d="M11 7h2V5h-2v2zm0 12h2V9h-2v10zm1-17C6.48 2 2 6.48 2 12s4.48 10 10 10
      10-4.48 10-10S17.52 2 12 2z"/>
    </svg>
  `
};

export function showDialog({
  layout = "alert", // alert | confirm | custom
  title = "",
  message = "",
  icon = null, // error | warning | success | info
  iconColor = null,
  buttons = []
}) {
  return new Promise(resolve => {
    const overlay = document.getElementById("dialog-overlay");
    const dialog = document.getElementById("dialog-box");
    const titleEl = document.getElementById("dialog-title");
    const messageEl = document.getElementById("dialog-message");
    const iconEl = document.getElementById("dialog-icon");
    const buttonsEl = document.getElementById("dialog-buttons");

    titleEl.textContent = title;
    messageEl.textContent = message;

    // Layout automático
    if (layout === "alert") {
      buttons = [{ label: t("ui.ok"), value: "ok", primary: true }];
    }

    if (layout === "confirm") {
      buttons = [
        { label: t("ui.cancel"), value: "cancel" },
        { label: t("ui.confirm"), value: "confirm", primary: true }
      ];
    }

    // Ícone
    iconEl.innerHTML = "";
    if (icon && DialogIcons[icon]) {
      iconEl.innerHTML = DialogIcons[icon];
      iconEl.style.color = iconColor || "inherit";
    }

    // Botões
    buttonsEl.innerHTML = "";

    let primaryButton = null;

    buttons.forEach(btn => {
      const button = document.createElement("button");
      button.textContent = btn.label;

      if (btn.primary) {
        button.classList.add("primary");
        primaryButton = button;
      }

      button.onclick = () => close(btn.value);

      buttonsEl.appendChild(button);
    });

    // Função de fechar
    function close(value) {
      dialog.style.position = "";
      dialog.style.left = "";
      dialog.style.top = "";        
      overlay.classList.remove("active");
      overlay.setAttribute("aria-hidden", "true");
      document.removeEventListener("keydown", handleKey);
      resolve(value);
    }

    // Teclado
    function handleKey(e) {
      if (e.key === "Escape") {
        close("cancel");
      }

      if (e.key === "Enter" && primaryButton) {
        primaryButton.click();
      }
    }

    document.addEventListener("keydown", handleKey);

    // Mostrar
    overlay.classList.add("active");
    makeDialogDraggable();
    overlay.setAttribute("aria-hidden", "false");

    // Foco automático
    setTimeout(() => {
      if (primaryButton) {
        primaryButton.focus();
      }
    }, 50);
  });
}

function makeDialogDraggable() {
  const dialog = document.getElementById("dialog-box");
  const handle = document.getElementById("dialog-title");

  let isDragging = false;
  let offsetX = 0;
  let offsetY = 0;

  handle.onmousedown = (e) => {
    isDragging = true;

    const rect = dialog.getBoundingClientRect();
    offsetX = e.clientX - rect.left;
    offsetY = e.clientY - rect.top;

    dialog.style.transition = "none";
  };

  document.onmousemove = (e) => {
    if (!isDragging) return;

    dialog.style.position = "fixed";
    dialog.style.left = `${e.clientX - offsetX}px`;
    dialog.style.top = `${e.clientY - offsetY}px`;
  };

  document.onmouseup = () => {
    if (!isDragging) return;

    isDragging = false;
    dialog.style.transition = "";
  };
}

export const DialogManager = {
  showDialog
};