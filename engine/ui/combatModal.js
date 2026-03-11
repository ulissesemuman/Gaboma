/**
 * combatModal.js
 *
 * Combat overlay modal. Opens when a chapter has active combat instances.
 * Replaces the normal chapter choices with combat actions.
 *
 * Layout:
 *   ┌─────────────────────────────────────┐
 *   │  [Enemy name]   HP bar (if showHp)  │
 *   │  [Enemy image]  HP: 8 / 12          │
 *   │  [Description]                      │
 *   │  ─────────────────────────────────  │
 *   │  Round: 3      Player HP: ♥ 14      │
 *   │  ─────────────────────────────────  │
 *   │  [Attack]  [Use Potion]  [Flee]     │
 *   │        (disabled during enemy turn) │
 *   └─────────────────────────────────────┘
 *
 * Multiple enemies: tabs or stacked cards, one targeted at a time.
 */

import state from "../core/state.js";
import { EnemyRegistry } from "../combat/enemyRegistry.js";
import { CombatEngine } from "../combat/combatEngine.js";
import { Engine } from "../core/engine.js";
import { History } from "../flow/history.js";
import { t } from "../i18n/globalI18n.js";
import { tb } from "../i18n/bookI18n.js";
import { safeT, interpolateBook } from "../utils/i18nUtils.js";
import { Reader } from "../core/reader.js";
import { MessageAnimator } from "./messageAnimator.js";

// ─── State ────────────────────────────────────────────────────────────────────

let _onClose = null;
let _currentChapterId = null;
let _targetInstanceId = null;

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Opens the combat modal.
 * @param {{ combats: Object[], chapterId: string, onClose: Function }} opts
 */
function open({ combats, chapterId, onClose }) {
  _onClose = onClose;
  _currentChapterId = chapterId;
  _targetInstanceId = combats[0].instanceId;

  const overlay = _getOrCreateOverlay();

  _render(overlay, combats);

  // Animate in
  requestAnimationFrame(() => overlay.classList.add("visible"));
}

function close() {
  const overlay = document.getElementById("combat-overlay");
  if (!overlay) return;

  overlay.classList.remove("visible");

  setTimeout(() => {
    overlay.remove();
    if (_onClose) _onClose();
  }, 260);
}

// ─── Rendering ────────────────────────────────────────────────────────────────

function _render(overlay, combats) {
  const modal = overlay.querySelector("#combat-modal");
  modal.innerHTML = "";

  const bookId   = state.currentBookId;
  const progress = state.bookState[bookId].progress;
  const story    = Reader.getCurrentStory();
  const resolved = EnemyRegistry.resolveInstance(_targetInstanceId);
  const instance = progress.combat[_targetInstanceId];

  // ── Enemy tabs (if multiple) ───────────────────────────────────────
  if (combats.length > 1) {
    const tabs = document.createElement("div");
    tabs.className = "combat-enemy-tabs";

    combats.forEach(c => {
      const r = EnemyRegistry.resolveInstance(c.instanceId);
      const tab = document.createElement("button");
      tab.className = "combat-enemy-tab" + (c.instanceId === _targetInstanceId ? " active" : "");
      tab.textContent = tb(r.label) || c.instanceId;
      tab.onclick = () => {
        _targetInstanceId = c.instanceId;
        _render(overlay, combats);
      };
      tabs.appendChild(tab);
    });

    modal.appendChild(tabs);
  }

  // ── Enemy info ─────────────────────────────────────────────────────
  const infoRow = document.createElement("div");
  infoRow.className = "combat-enemy-info";

  // Portrait
  if (resolved.image) {
    const img = document.createElement("img");
    img.className = "combat-enemy-portrait";
    img.src = resolved.image;
    img.alt = tb(resolved.label) || "";
    infoRow.appendChild(img);
  } else {
    const ph = document.createElement("div");
    ph.className = "combat-enemy-portrait-placeholder";
    infoRow.appendChild(ph);
  }

  const details = document.createElement("div");
  details.className = "combat-enemy-details";

  const nameEl = document.createElement("div");
  nameEl.className = "combat-enemy-name";
  nameEl.textContent = tb(resolved.label) || _targetInstanceId;
  details.appendChild(nameEl);

  // HP bar between name and description (default: visible)
  if (instance.showHp !== false) {
    details.appendChild(_buildHpBar(instance.hp, instance.maxHp, "enemy-hp"));
  }

  if (resolved.description) {
    const desc = document.createElement("div");
    desc.className = "combat-enemy-desc";
    desc.textContent = tb(resolved.description);
    details.appendChild(desc);
  }

  infoRow.appendChild(details);
  modal.appendChild(infoRow);

  // ── Status row: round + player HP ─────────────────────────────────
  const statusRow = document.createElement("div");
  statusRow.className = "combat-status-row";

  const roundEl = document.createElement("span");
  roundEl.textContent = `${safeT("combat.round") ?? "Round"}: ${instance.round}`;
  statusRow.appendChild(roundEl);

  const playerHpVar = progress._playerHpVar;
  if (playerHpVar) {
    const playerHp    = progress.variables[playerHpVar] ?? 0;
    const playerHpMax = story.variables?.[playerHpVar]?.max ?? playerHp;

    const playerHpEl = document.createElement("span");
    playerHpEl.id = "combat-player-hp-label";
    playerHpEl.textContent = `♥ ${playerHp}${playerHpMax ? " / " + playerHpMax : ""}`;
    statusRow.appendChild(playerHpEl);
  }

  modal.appendChild(statusRow);

  // ── Turn banner ────────────────────────────────────────────────────
  const banner = document.createElement("div");
  banner.className = "combat-turn-banner";
  banner.id = "combat-turn-banner";
  banner.textContent = safeT("combat.yourTurn") ?? "Your turn!";
  modal.appendChild(banner);

  // Show banner with a brief delay so player notices it
  setTimeout(() => banner.classList.add("visible"), 150);

  // ── Action buttons ─────────────────────────────────────────────────
  // ── Target selector (when multiple enemies active) ────────────────
  if (combats.length > 1) {
    const progress    = state.bookState[bookId].progress;
    const actionCount = progress.variables["_actionCount"] ?? 1;

    const targetSection = document.createElement("div");
    targetSection.className = "combat-target-section";

    const targetLabel = document.createElement("div");
    targetLabel.className = "combat-target-label";
    targetLabel.textContent = safeT("combat.chooseTarget") ?? "Choose target:";
    targetSection.appendChild(targetLabel);

    const targetBtns = document.createElement("div");
    targetBtns.className = "combat-target-btns";

    combats.forEach(cm => {
      const r   = EnemyRegistry.resolveInstance(cm.instanceId);
      const btn = document.createElement("button");
      btn.className = "combat-target-btn" + (cm.instanceId === _targetInstanceId ? " selected" : "");
      btn.textContent = tb(r.label) || cm.instanceId;
      btn.onclick = () => {
        _targetInstanceId = cm.instanceId;
        _render(overlay, combats); // re-render with new target
      };
      targetBtns.appendChild(btn);
    });

    targetSection.appendChild(targetBtns);
    modal.appendChild(targetSection);
  }

  // ── Action buttons ─────────────────────────────────────────────────
  const actionsEl = document.createElement("div");
  actionsEl.className = "combat-actions";
  actionsEl.id = "combat-actions";

  const playerActions = Reader.getCurrentStory()?.player?.actions ?? [];
  const available = CombatEngine.getAvailablePlayerActions(
    _currentChapterId, _targetInstanceId, playerActions
  );

  available.forEach(action => {
    const btn = document.createElement("button");
    btn.className = "combat-action-btn";
    btn.textContent = tb(action.label) || action.id;
    btn.dataset.actionId = action.id;

    btn.onclick = async () => {
      await _handleCombatAction(action, combats, overlay);
    };

    actionsEl.appendChild(btn);
  });

  modal.appendChild(actionsEl);
}

// ─── Action handling ──────────────────────────────────────────────────────────

async function _handleCombatAction(playerAction, combats, overlay) {
  // Disable all action buttons while processing
  _setActionsEnabled(false);

  // Hide turn banner
  const banner = document.getElementById("combat-turn-banner");
  if (banner) banner.classList.remove("visible");

  // Snapshot HP before action (for damage animation)
  const bookId   = state.currentBookId;
  const hpBefore = {};
  for (const cm of combats) {
    hpBefore[cm.instanceId] = state.bookState[bookId].progress.combat[cm.instanceId]?.hp ?? 0;
  }

  // Execute the action (sync — mutates state)
  const outcome = CombatEngine.handlePlayerAction(
    playerAction,
    _targetInstanceId,
    _currentChapterId,
    Engine.applyEffects,
    History.registerStateEvent
  );

  // HP after action
  const hpAfter = {};
  for (const cm of combats) {
    hpAfter[cm.instanceId] = state.bookState[bookId].progress.combat[cm.instanceId]?.hp ?? 0;
  }

  // ── Start HP drain animations immediately (parallel with event messages) ──
  const drainPromises = combats
    .filter(cm => (hpBefore[cm.instanceId] ?? 0) !== (hpAfter[cm.instanceId] ?? 0))
    .map(cm => _animateHpDrain(cm.instanceId, hpBefore[cm.instanceId], hpAfter[cm.instanceId]));

  // ── Play effect events ───────────────────────────────────────────
  const { DiceAnimator } = await import("./diceAnimator.js");

  for (const event of outcome.events) {

    if (event.type === "turn") {
      // Only show enemy turn popup — player turn is handled by _render banner
      if (event.turn === "enemy") {
        await _showTurnPopup("enemy", event.instanceId);
      }

    } else if (event.type === "dice" && event.dice) {
      await DiceAnimator.playDiceAnimation(event);

      // After dice: show damage to the enemy that was targeted this dice roll
      const targetId = event.instanceId ?? _targetInstanceId;
      const dmg = (hpBefore[targetId] ?? 0) - (hpAfter[targetId] ?? 0);
      if (dmg > 0) {
        const res  = EnemyRegistry.resolveInstance(targetId);
        const name = tb(res.label) || targetId;
        await MessageAnimator.showMessage(`${name} -${dmg}HP`, 1400);
      }

    } else if (event.type === "enemyAction") {
      // "{enemy_name} {action_message}" or fallback to action label
      const res  = EnemyRegistry.resolveInstance(event.instanceId);
      const name = tb(res.label) || event.instanceId;

      let text;
      if (event.actionMessage) {
        // Author-defined template: {enemy} = enemy name, {action} = action label
        const actionLabel = tb(event.label) || event.label;
        text = interpolateBook(event.actionMessage)
          .replace("{enemy}", name)
          .replace("{action}", actionLabel);
      } else {
        // Fallback: "EnemyName: action label"
        const actionLabel = tb(event.label) || event.label;
        text = `${name}: ${actionLabel}`;
      }
      await MessageAnimator.showMessage(text, 1800);

    } else if (event.type === "message" && event.text) {
      await MessageAnimator.showMessage(interpolateBook(event.text));
    }
  }

  // ── Await HP drain animations (started above in parallel with messages) ──
  await Promise.all(drainPromises);

  // ── End of combat ─────────────────────────────────────────────────
  if (outcome.ended) {
    await _showResult(overlay, outcome.reason, combats, outcome.next ?? null, outcome.xpAwarded ?? 0);
    return;
  }

  // Re-render modal with updated state
  const activeCombats = CombatEngine.getActiveCombatsForChapter(_currentChapterId);

  if (activeCombats.length === 0) {
    // All enemies resolved
    await _showResult(overlay, "victory", combats, null, 0);
    return;
  }

  // Show "enemy turn" briefly, then re-enable
  _render(overlay, activeCombats);

  // Re-enable after render (turn banner already shows via _render timeout)
}

/**
 * Shows a centered fade popup ("Seu turno" / "Turno do inimigo") for 1.5s.
 * Multiple active enemies → "Turno dos inimigos" (plural).
 *
 * @param {"player"|"enemy"} turn
 * @param {string|undefined} instanceId - for enemy turn, identifies which enemy
 */
async function _showTurnPopup(turn, instanceId) {
  // Find or create the popup element inside the modal
  let popup = document.getElementById("combat-turn-popup");
  if (!popup) {
    const modal = document.getElementById("combat-modal");
    if (!modal) return;
    popup = document.createElement("div");
    popup.id = "combat-turn-popup";
    modal.appendChild(popup);
  }

  if (turn === "player") {
    popup.textContent = safeT("combat.yourTurn") ?? "Seu turno";
  } else {
    // Count active enemies to decide singular/plural
    const actives = CombatEngine.getActiveCombatsForChapter(_currentChapterId);
    if (actives.length > 1) {
      popup.textContent = safeT("combat.enemiesTurn") ?? "Turno dos inimigos";
    } else {
      // Show the enemy name in the turn popup
      try {
        const res  = EnemyRegistry.resolveInstance(instanceId ?? actives[0]?.instanceId);
        const name = tb(res.label) || (instanceId ?? "");
        popup.textContent = `${name}: ${safeT("combat.enemyTurn") ?? "turno"}`;
      } catch {
        popup.textContent = safeT("combat.enemyTurn") ?? "Turno do inimigo";
      }
    }
  }

  // Fade in
  popup.classList.add("visible");

  await new Promise(resolve => setTimeout(resolve, 2000));

  // Fade out
  popup.classList.remove("visible");

  // Wait for fade-out transition (250ms)
  await new Promise(resolve => setTimeout(resolve, 260));
}

/**
 * Animates the HP bar for an enemy instance from hpBefore → hpAfter.
 * Shows the pending-damage portion in blue, then drains it smoothly.
 * Total drain time is proportional to damage (max 1500ms for full bar wipe).
 */
async function _animateHpDrain(instanceId, hpBefore, hpAfter) {
  const fill = document.getElementById("enemy-hp");
  if (!fill) return;

  const track   = fill.parentElement;
  const instance = state.bookState[state.currentBookId].progress.combat[instanceId];
  const maxHp   = instance?.maxHp ?? hpBefore;

  const pctBefore  = Math.max(0, (hpBefore / maxHp) * 100);
  const pctAfter   = Math.max(0, (hpAfter  / maxHp) * 100);
  const pctDamage  = pctBefore - pctAfter;

  if (pctDamage <= 0) return;

  // Duration proportional to damage fraction: min 600ms, max 1500ms
  const duration = Math.round(Math.max(600, (pctDamage / 100) * 1500));

  // Green bar snaps immediately to new HP
  fill.style.transition = "none";
  fill.style.width = `${pctAfter}%`;
  const pctFinal = (hpAfter / maxHp) * 100;
  fill.className = `combat-hp-bar-fill ${pctFinal > 60 ? "high" : pctFinal > 25 ? "mid" : "low"}`;

  // Update HP label immediately — value is already committed to state
  const hpLabel = fill.closest(".combat-hp-row")?.querySelector(".combat-hp-label");
  if (hpLabel) hpLabel.textContent = `${hpAfter} / ${maxHp}`;

  // Blue bar drains gradually from pctBefore → pctAfter
  // It always starts where green started, so green covers its left side cleanly
  const pending = document.getElementById(fill.id + "-pending") ?? track.querySelector(".combat-hp-bar-pending");
  if (!pending) { resolve?.(); return; }

  pending.style.width = `${pctBefore}%`;

  return new Promise(resolve => {
    const start = performance.now();

    function step(now) {
      const elapsed  = now - start;
      const progress = Math.min(elapsed / duration, 1);

      // Blue drains from pctBefore down to pctAfter
      pending.style.width = `${pctBefore - pctDamage * progress}%`;

      if (progress < 1) {
        requestAnimationFrame(step);
      } else {
        pending.style.width = `${pctAfter}%`;
        resolve();
      }
    }

    requestAnimationFrame(step);
  });
}

async function _showResult(overlay, reason, combats, fleeNext = null, xpAwarded = 0) {
  const modal = overlay.querySelector("#combat-modal");
  modal.innerHTML = "";

  const labelMap = {
    victory:     safeT("combat.victory") ?? "Victory!",
    defeat:      safeT("combat.defeat") ?? "Defeat...",
    fled_player: safeT("combat.fled") ?? "You fled.",
    fled_enemy:  safeT("combat.enemyFled") ?? "Enemy fled."
  };

  const cssClass =
    reason === "victory"    ? "victory" :
    reason === "defeat"     ? "defeat"  : "fled";

  const banner = document.createElement("div");
  banner.className = `combat-result-banner ${cssClass}`;
  banner.textContent = labelMap[reason] ?? reason;
  modal.appendChild(banner);

  // ── XP and level-up messages (victory only, xpAwarded > 0) ──────
  if (reason === "victory" && xpAwarded > 0) {
    const progress  = state.bookState[state.currentBookId].progress;
    const xpVarId   = progress._playerXpVar;
    const story     = Reader.getCurrentStory();
    const xpVarDef  = story?.variables?.[xpVarId];
    const xpVarName = xpVarDef?.label ? tb(xpVarDef.label) : (xpVarId ?? "XP");

    // Message 1: XP gained
    const xpMsg = document.createElement("div");
    xpMsg.className = "combat-xp-message";
    xpMsg.textContent = `+${xpAwarded} ${xpVarName}`;
    modal.appendChild(xpMsg);

    // Message 2: level-up notifications (one per level gained)
    const pending = progress._pendingLevelUps ?? [];
    progress._pendingLevelUps = []; // consume

    pending.forEach(lu => {
      const lvlMsg = document.createElement("div");
      lvlMsg.className = "combat-levelup-message";
      const levelLabel = lu.label ?? `Level ${lu.level}`;
      lvlMsg.textContent = `⬆ ${levelLabel}!`;
      modal.appendChild(lvlMsg);
    });

    state.save();
  }

  const closeBtn = document.createElement("button");
  closeBtn.className = "combat-result-close";
  closeBtn.textContent = t("ui.continue") || "Continuar";
  closeBtn.onclick = async () => {
    // Navigate to the outcome chapter if defined
    const resolved = EnemyRegistry.resolveInstance(_targetInstanceId);
    const nextChapter =
      reason === "victory"    ? resolved.onVictory?.next :
      reason === "defeat"     ? resolved.onDefeat?.next  :
      reason === "fled_player" ? fleeNext                : null;

    close();

    if (nextChapter) {
      const { renderReader } = await import("./uiManager.js");
      renderReader(nextChapter);
    }
  };
  modal.appendChild(closeBtn);
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function _setActionsEnabled(enabled) {
  document.querySelectorAll(".combat-action-btn").forEach(btn => {
    btn.disabled = !enabled;
  });
}

function _buildHpBar(current, max, id) {
  const pct = max > 0 ? Math.max(0, Math.min(100, (current / max) * 100)) : 0;
  const colorClass = pct > 60 ? "high" : pct > 25 ? "mid" : "low";

  const row = document.createElement("div");
  row.className = "combat-hp-row";

  const track = document.createElement("div");
  track.className = "combat-hp-bar-track";

  // Blue "pending damage" bar — always present, starts at same width as green
  const pending = document.createElement("div");
  pending.className = "combat-hp-bar-pending";
  pending.style.width = `${pct}%`;
  pending.id = id + "-pending";
  track.appendChild(pending);

  const fill = document.createElement("div");
  fill.className = `combat-hp-bar-fill ${colorClass}`;
  fill.style.width = `${pct}%`;
  fill.id = id;
  track.appendChild(fill);

  const label = document.createElement("div");
  label.className = "combat-hp-label";
  label.textContent = `${current} / ${max}`;

  row.appendChild(track);
  row.appendChild(label);

  return row;
}

function _getOrCreateOverlay() {
  let overlay = document.getElementById("combat-overlay");

  if (!overlay) {
    overlay = document.createElement("div");
    overlay.id = "combat-overlay";

    const modal = document.createElement("div");
    modal.id = "combat-modal";

    overlay.appendChild(modal);
    document.body.appendChild(overlay);
  }

  return overlay;
}

// ─────────────────────────────────────────────────────────────────────────────

export const CombatModal = { open, close };
