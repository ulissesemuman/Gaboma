/**
 * messageAnimator.js
 *
 * Two animation styles for feedback messages:
 *   - "explosion" : pops from center, scales up elastically, fades out expanding
 *   - "slide"     : rises from below the screen, bounces at destination, descends slowly
 *
 * Default style set globally. Override per book via book.json → ui.messageStyle
 */

let _engineDefault = "slide";

export function setDefaultMessageStyle(style) {
  if (style === "explosion" || style === "slide") {
    _engineDefault = style;
  }
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * @param {string}  text
 * @param {number}  [duration=2200]   - hold time in ms between in and out animations
 * @param {string}  [styleOverride]   - "explosion" | "slide" | null
 * @returns {Promise<void>}
 */
export function showMessage(text, duration = 2200, styleOverride = null) {
  return new Promise(resolve => {

    const style    = styleOverride ?? _resolveBookStyle() ?? _engineDefault;
    const isSlide  = style === "slide";

    const el = document.createElement("div");
    el.className = `feedback-message style-${style}`;
    el.textContent = text;

    // For slide: set resting position above the bottom bar (88px default).
    // The bottom bar is ~56px tall; add a small gap.
    if (isSlide) {
      const bottomBar = document.getElementById("bottom-bar");
      const barHeight = bottomBar ? bottomBar.offsetHeight : 56;
      el.style.setProperty("--msg-rest", `${barHeight + 16}px`);
    }

    document.body.appendChild(el);

    // Trigger in-animation on next frame so the element is in the DOM first
    requestAnimationFrame(() => {
      el.classList.add("phase-in");
    });

    const inDuration  = isSlide ? 520 : 300;
    const outDuration = isSlide ? 480 : 350;

    setTimeout(() => {
      el.classList.remove("phase-in");
      el.classList.add("phase-out");

      setTimeout(() => {
        el.remove();
        resolve();
      }, outDuration);

    }, inDuration + duration);
  });
}

function _resolveBookStyle() {
  try {
    const book = window._gaboma?.BookLoader?.getCurrentBook?.();
    return book?.manifest?.ui?.messageStyle ?? null;
  } catch {
    return null;
  }
}

export const MessageAnimator = { showMessage, setDefaultMessageStyle };