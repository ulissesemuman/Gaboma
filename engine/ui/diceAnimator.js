/**
 * diceAnimator.js
 *
 * Renders animated SVG dice (D4, D6, D8, D10, D12, D20).
 * Multiple dice of the same roll appear simultaneously.
 * Position is configurable via book.json: ui.dicePosition
 * Supported positions: "center" | "top" | "bottom-left" | "bottom-right"
 */

// ─── SVG face generators ──────────────────────────────────────────────────────

const DICE_FACES = {

  d6: (value) => `
    <svg viewBox="0 0 60 60" xmlns="http://www.w3.org/2000/svg" class="dice-svg">
      <rect x="2" y="2" width="56" height="56" rx="10" ry="10"
            fill="var(--dice-face)" stroke="var(--dice-border)" stroke-width="2.5"/>
      ${d6Dots(value)}
    </svg>`,

  d4: (value) => `
    <svg viewBox="0 0 60 70" xmlns="http://www.w3.org/2000/svg" class="dice-svg">
      <polygon points="30,4 58,64 2,64"
               fill="var(--dice-face)" stroke="var(--dice-border)" stroke-width="2.5"/>
      <text x="30" y="56" text-anchor="middle"
            font-size="22" font-weight="bold" fill="var(--dice-text)">${value}</text>
    </svg>`,

  d8: (value) => `
    <svg viewBox="0 0 60 60" xmlns="http://www.w3.org/2000/svg" class="dice-svg">
      <polygon points="30,2 58,30 30,58 2,30"
               fill="var(--dice-face)" stroke="var(--dice-border)" stroke-width="2.5"/>
      <text x="30" y="36" text-anchor="middle"
            font-size="20" font-weight="bold" fill="var(--dice-text)">${value}</text>
    </svg>`,

  d10: (value) => `
    <svg viewBox="0 0 60 70" xmlns="http://www.w3.org/2000/svg" class="dice-svg">
      <polygon points="30,2 58,20 50,58 10,58 2,20"
               fill="var(--dice-face)" stroke="var(--dice-border)" stroke-width="2.5"/>
      <text x="30" y="42" text-anchor="middle"
            font-size="20" font-weight="bold" fill="var(--dice-text)">${value}</text>
    </svg>`,

  d12: (value) => `
    <svg viewBox="0 0 70 70" xmlns="http://www.w3.org/2000/svg" class="dice-svg">
      <polygon points="35,2 62,13 70,42 52,65 18,65 0,42 8,13"
               fill="var(--dice-face)" stroke="var(--dice-border)" stroke-width="2.5"/>
      <text x="35" y="42" text-anchor="middle"
            font-size="19" font-weight="bold" fill="var(--dice-text)">${value}</text>
    </svg>`,

  d20: (value) => `
    <svg viewBox="0 0 60 70" xmlns="http://www.w3.org/2000/svg" class="dice-svg">
      <polygon points="30,2 58,18 58,52 30,68 2,52 2,18"
               fill="var(--dice-face)" stroke="var(--dice-border)" stroke-width="2.5"/>
      <text x="30" y="42" text-anchor="middle"
            font-size="20" font-weight="bold" fill="var(--dice-text)">${value}</text>
    </svg>`,
};

// D6 dot layout — classic pip positions
function d6Dots(value) {
  const positions = {
    1: [[30, 30]],
    2: [[18, 18], [42, 42]],
    3: [[18, 18], [30, 30], [42, 42]],
    4: [[18, 18], [42, 18], [18, 42], [42, 42]],
    5: [[18, 18], [42, 18], [30, 30], [18, 42], [42, 42]],
    6: [[18, 16], [42, 16], [18, 30], [42, 30], [18, 44], [42, 44]],
  };

  return (positions[value] || []).map(([cx, cy]) =>
    `<circle cx="${cx}" cy="${cy}" r="5" fill="var(--dice-text)"/>`
  ).join("");
}

// ─── Position map ─────────────────────────────────────────────────────────────

const POSITION_STYLES = {
  center:       "top:50%;left:50%;transform:translate(-50%,-50%)",
  top:          "top:80px;left:50%;transform:translateX(-50%)",
  "bottom-left":  "bottom:80px;left:24px",
  "bottom-right": "bottom:80px;right:24px",
};

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Plays a dice roll animation and resolves when complete.
 *
 * @param {Object} diceEvent  - { dice: { count, sides }, results: [], total }
 * @param {string} position   - override position; falls back to book config or "center"
 * @returns {Promise<void>}   - resolves after animation + display time
 */
export function playDiceAnimation(diceEvent, position = null) {
  return new Promise(resolve => {

    const { dice, results, total } = diceEvent;
    const sides  = dice.sides;
    const faceKey = `d${sides}`;
    const pos    = position ?? _resolvePosition();
    const posStyle = POSITION_STYLES[pos] ?? POSITION_STYLES.center;

    // ── Build overlay ─────────────────────────────────────────────
    const overlay = document.createElement("div");
    overlay.className = "dice-overlay";
    overlay.style.cssText = posStyle;

    const wrappers = results.map((result, i) => {
      const wrapper = document.createElement("div");
      wrapper.className = "dice-wrapper dice-rolling";

      // Show a random rolling face during animation
      wrapper.innerHTML = _randomFace(faceKey, sides);

      const label = document.createElement("div");
      label.className = "dice-value-label";
      label.textContent = result;
      wrapper.appendChild(label);

      overlay.appendChild(wrapper);
      return { wrapper, result, label };
    });

    // Total badge (only when more than 1 die)
    let totalBadge = null;
    if (results.length > 1) {
      totalBadge = document.createElement("div");
      totalBadge.className = "dice-total-badge";
      totalBadge.textContent = `= ${total}`;
      overlay.appendChild(totalBadge);
    }

    document.body.appendChild(overlay);

    // ── Rolling phase (700ms) ─────────────────────────────────────
    const rollInterval = setInterval(() => {
      wrappers.forEach(({ wrapper }) => {
        const face = _randomFace(faceKey, sides);
        // replace SVG only (not the label)
        const existing = wrapper.querySelector(".dice-svg");
        if (existing) wrapper.replaceChild(
          _svgElement(face), existing
        );
      });
    }, 80);

    // ── Settle phase ──────────────────────────────────────────────
    setTimeout(() => {
      clearInterval(rollInterval);

      wrappers.forEach(({ wrapper, result, label }) => {
        wrapper.classList.remove("dice-rolling");
        wrapper.classList.add("dice-settling");

        // Show final value
        const finalFace = DICE_FACES[faceKey]
          ? DICE_FACES[faceKey](result)
          : DICE_FACES.d6(result);

        const existing = wrapper.querySelector(".dice-svg");
        if (existing) wrapper.replaceChild(
          _svgElement(finalFace), existing
        );

        // Reveal label
        setTimeout(() => { label.style.opacity = "1"; }, 300);
      });

      // Reveal total badge
      if (totalBadge) {
        setTimeout(() => {
          totalBadge.style.opacity = "1";
          totalBadge.style.transform = "translateY(0)";
        }, 400);
      }
    }, 700);

    // ── Display phase (2s) + fade out ─────────────────────────────
    setTimeout(() => {
      overlay.classList.add("hiding");
      setTimeout(() => {
        overlay.remove();
        resolve();
      }, 350);
    }, 700 + 2000);
  });
}

// ─── Internal helpers ─────────────────────────────────────────────────────────

function _randomFace(faceKey, sides) {
  const randomVal = Math.floor(Math.random() * sides) + 1;
  const generator = DICE_FACES[faceKey] ?? DICE_FACES.d6;
  return generator(randomVal);
}

function _svgElement(html) {
  const div = document.createElement("div");
  div.innerHTML = html.trim();
  return div.firstChild;
}

function _resolvePosition() {
  // Try to read from current book manifest
  try {
    const { BookLoader } = window._gaboma ?? {};
    const book = BookLoader?.getCurrentBook?.();
    return book?.manifest?.ui?.dicePosition ?? "center";
  } catch {
    return "center";
  }
}

export const DiceAnimator = { playDiceAnimation };
