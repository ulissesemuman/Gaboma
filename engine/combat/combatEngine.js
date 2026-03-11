/**
 * combatEngine.js
 *
 * Orchestrates combat flow by reusing the existing engine pipeline:
 *   Effects.resolveActionEffects() → applyEffects() → registerStateEvent()
 *
 * What this module adds on top:
 *   - _enemyHp alias interception (redirected to progress.combat[instanceId].hp)
 *   - enemy action selection (weighted random + conditions)
 *   - turn order (player first; enemy retaliation per action flag)
 *   - surprise flag (enemy acts first on round 1)
 *   - combat end detection (victory / defeat / fled)
 *   - multi-enemy support (all active enemies in chapter retaliate)
 *   - history recording per combat turn via registerStateEvent()
 */

import state from "../core/state.js";
import { EnemyRegistry } from "./enemyRegistry.js";
import { Effects } from "../flow/effects.js";
import { Reader } from "../core/reader.js";
import { Conditions } from "../flow/conditions.js";

// ─────────────────────────────────────────────────────────────────────────────
// Internal helpers
// ─────────────────────────────────────────────────────────────────────────────

function getBookId() {
  return state.currentBookId;
}

function getCombatMap() {
  return state.bookState[getBookId()].progress.combat;
}

function getProgress() {
  return state.bookState[getBookId()].progress;
}

/**
 * Builds the Expressions context for a given combat instance.
 * Exposes "_enemyHp" as a readable variable so conditions on enemy actions
 * can reference the enemy's current HP directly.
 *
 * @param {string} instanceId
 * @returns {Object} context
 */
function buildContext(instanceId) {
  const progress       = getProgress();
  const combatInstance = getCombatMap()[instanceId];

  return {
    variables: {
      ...progress.variables,
      // Author-facing alias: { var: "_enemyHp" } reads from progress.combat[instanceId].hp
      _enemyHp: combatInstance?.hp ?? 0
    },
    items:           progress.items,
    turn:            progress.turn,
    chaptersVisited: progress.chaptersVisited
  };
}

/**
 * Splits resolved effects into two groups:
 *   - normalEffects  → passed to the standard applyEffects() pipeline
 *   - enemyHpDeltas  → { instanceId, delta } applied directly to combat state
 *
 * This keeps the main effects pipeline completely unaware of combat internals.
 *
 * @param {Array}  effects
 * @param {string} instanceId
 */
function separateEnemyHpEffects(effects, instanceId) {
  const normalEffects = [];
  const enemyHpDeltas = [];

  effects.forEach(effect => {
    if (effect.type === "addVar" && effect.id === "_enemyHp") {
      enemyHpDeltas.push({ instanceId, delta: effect.delta });
    } else {
      normalEffects.push(effect);
    }
  });

  return { normalEffects, enemyHpDeltas };
}

/**
 * Applies _enemyHp deltas to progress.combat[instanceId].hp.
 * Clamps result to [0, maxHp].
 *
 * @param {Array} enemyHpDeltas - [{ instanceId, delta }]
 */
function applyEnemyHpDeltas(enemyHpDeltas) {
  const combatMap = getCombatMap();

  enemyHpDeltas.forEach(({ instanceId, delta }) => {
    const instance = combatMap[instanceId];
    if (!instance) return;

    instance.hp = Math.max(
      0,
      Math.min(instance.maxHp, instance.hp + delta)
    );
  });

  state.save();
}

/**
 * Weighted random selection from an array of items with a .weight property.
 * Items without a weight default to 1.
 *
 * @param {Array} items
 * @returns {*} selected item
 */
function weightedRandom(items) {
  const totalWeight = items.reduce((sum, item) => sum + (item.weight ?? 1), 0);
  let roll = Math.random() * totalWeight;

  for (const item of items) {
    roll -= (item.weight ?? 1);
    if (roll <= 0) return item;
  }

  return items[items.length - 1]; // floating point fallback
}

/**
 * Selects the enemy action for this turn.
 * Filters eligible actions by conditions first, then picks by weight.
 *
 * @param {Object} resolved    - full enemy definition from EnemyRegistry
 * @param {string} instanceId
 * @returns {Object|null} selected action, or null if no action is eligible
 */
function resolveEnemyAction(resolved, instanceId) {
  const context = buildContext(instanceId);

  const eligible = (resolved.actions ?? []).filter(action => {
    if (!action.conditions) return true;

    return Conditions.evaluate(action.conditions, context);
  });

  if (eligible.length === 0) return null;

  return weightedRandom(eligible);
}

/**
 * Checks whether a combat instance should end after an effects batch.
 * Applies onVictory effects if the enemy was defeated.
 *
 * @param {string}   instanceId
 * @param {Object}   resolved       - full enemy definition
 * @param {Function} applyEffectsFn - Engine.applyEffects
 * @returns {"victory"|"defeat"|null}
 */
function checkCombatEnd(instanceId, resolved, applyEffectsFn) {
  const combatMap   = getCombatMap();
  const progress    = getProgress();
  const instance    = combatMap[instanceId];
  const playerHpVar = getProgress()._playerHpVar;

  // ── Enemy defeated ────────────────────────────────────────────────────────
  if (instance.hp <= 0) {
    instance.status = "victory";

    // Accumulate xpReward into the battle XP pool
    const xpReward = resolved.xpReward ?? 0;
    if (xpReward > 0) {
      const progress = getProgress();
      progress._pendingXp = (progress._pendingXp ?? 0) + xpReward;
    }

    if (resolved.onVictory?.effects?.length) {
      const { effects } = Effects.resolveActionEffects(resolved.onVictory.effects);
      applyEffectsFn(effects);
    }

    // Return "instance_victory" — caller checks if all enemies are cleared
    return "instance_victory";
  }

  // ── Player defeated ───────────────────────────────────────────────────────
  // checkFatalVariables() in engine.js sets progress.gameover — we mirror it
  // here so the combat flow can react immediately.
  if (playerHpVar) {
    const playerHp = progress.variables[playerHpVar] ?? 1;
    if (playerHp <= 0) {
      instance.status = "defeat";
      return "defeat";
    }
  }

  return null;
}

// ─────────────────────────────────────────────────────────────────────────────
// Internal turn execution
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Executes a single enemy turn: select action → resolve → apply.
 *
 * @param {string}   instanceId
 * @param {Object}   resolved
 * @param {Function} applyEffectsFn
 * @returns {{ events: Array, effects: Array, actionId: string|null }}
 */
function _executeEnemyTurn(instanceId, resolved, applyEffectsFn) {
  const action = resolveEnemyAction(resolved, instanceId);

  if (!action) {
    return { events: [], effects: [], actionId: null };
  }

  // Enemy action ends combat (e.g. enemy flees)
  if (action.endsCombat) {
    getCombatMap()[instanceId].status = action.endsCombat;
    state.save();
    return {
      events:   [
        { type: "turn", turn: "enemy", instanceId },
        { type: "message", text: action.label, instanceId, actionMessage: action.actionMessage ?? null }
      ],
      effects:  [],
      actionId: action.id
    };
  }

  const { effects: rawResolved, diceEvents } =
    Effects.resolveActionEffects(action.effects ?? []);

  const { normalEffects, enemyHpDeltas } =
    separateEnemyHpEffects(rawResolved, instanceId);

  // normalEffects may include addVar on _playerHpVar — this IS how enemy damages player
  applyEffectsFn(normalEffects);
  applyEnemyHpDeltas(enemyHpDeltas);

  // Build feedback events: turn marker → dice → action message → damage message
  const events = [];

  // 0. Enemy turn marker (shown as a fade popup in UI)
  events.push({ type: "turn", turn: "enemy", instanceId });

  // 1. Dice rolls (immersion)
  events.push(...diceEvents.map(e => ({ ...e, instanceId })));

  // 2. Action message: carries instanceId + optional actionMessage template
  events.push({
    type:          "enemyAction",
    instanceId,
    label:         action.label,
    actionMessage: action.actionMessage ?? null
  });

  // 3. Player damage feedback
  const playerHpVar = getProgress()._playerHpVar;
  if (playerHpVar) {
    const damageEffect = normalEffects.find(
      e => e.type === "addVar" && e.id === playerHpVar && e.delta < 0
    );
    if (damageEffect && action.damageMessage) {
      events.push({ type: "message", text: action.damageMessage, instanceId });
    }
  }

  return { events, effects: rawResolved, actionId: action.id };
}

/**
 * Returns "victory" only if every enemy in the chapter is no longer active.
 * Returns null if at least one enemy is still fighting.
 */
function _checkAllDefeated(chapterId) {
  const combatMap = getCombatMap();
  const allInChapter = Object.values(combatMap).filter(
    i => i.chapterId === chapterId
  );

  const stillActive = allInChapter.some(i => i.status === "active");
  return stillActive ? null : "victory";
}

function _advanceRound(instanceId) {
  const instance = getCombatMap()[instanceId];
  if (instance) instance.round += 1;
}

function _registerCombatTurn(instanceId, chapterId, source, actionId, effects, events, registerEventFn) {
  registerEventFn({
    chapterId,
    source:   `combat:${source}`,  // "combat:player" | "combat:enemy"
    choiceId: actionId,
    events,
    effects
  });
}

function _buildOutcome(ended, reason, events, effects, extra = {}) {
  return { ended, reason, events, effects, ...extra };
}


/**
 * Credits accumulated battle XP to the player XP variable.
 * Resets _pendingXp to 0. Returns the amount credited (0 if none).
 */
function _creditBattleXp(applyEffectsFn) {
  const progress = getProgress();
  const xpVar    = progress._playerXpVar;
  const pending  = progress._pendingXp ?? 0;

  progress._pendingXp = 0;

  if (!xpVar || pending <= 0) return 0;

  applyEffectsFn([{ type: "addVar", id: xpVar, delta: pending }]);

  return pending;
}

// ─────────────────────────────────────────────────────────────────────────────
// Public API
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Initializes a combat instance in progress.combat.
 * Called by applyEffects() when it encounters a { type: "startCombat" } effect.
 *
 * @param {Object} startEffect - { type: "startCombat", instanceId, chapterId }
 */
function startCombat(startEffect) {
  const { instanceId, chapterId } = startEffect;
  const combatMap = getCombatMap();

  // Guard: give a clear error if instanceId is missing or unknown
  if (!instanceId) {
    console.error("[Gaboma] startCombat: missing instanceId in effect", startEffect);
    return;
  }

  let resolved;
  try {
    resolved = EnemyRegistry.resolveInstance(instanceId);
  } catch (e) {
    console.error(`[Gaboma] startCombat: ${e.message}. Check enemies.json and story.json.`);
    return;
  }

  if (!EnemyRegistry.shouldStartCombat(combatMap, instanceId, resolved)) {
    return; // resume existing or skip permanently defeated
  }

  // showHp cascade: startEffect.showHp > instanceDef.showHp > typeDef.showHp > true
  const instanceDef = EnemyRegistry.getInstance(instanceId) ?? {};
  const showHp =
    startEffect.showHp        !== undefined ? startEffect.showHp :
    instanceDef.showHp        !== undefined ? instanceDef.showHp :
    resolved.showHp           !== undefined ? resolved.showHp    :
    true; // default: show HP bar

  combatMap[instanceId] = {
    instanceId,
    chapterId,
    enemyType: resolved.type,
    hp:        resolved.hp,
    maxHp:     resolved.maxHp,
    round:     1,
    status:    "active",
    surprise:  resolved.surprise ?? false,
    showHp
  };

  // Initialise battle XP accumulator for this combat session
  const progress = getProgress();
  if (progress._pendingXp === undefined) progress._pendingXp = 0;

  state.save();
}

/**
 * Returns all active combat instances for a given chapter.
 * Used by the UI to decide whether to show the combat interface.
 *
 * @param {string} chapterId
 * @returns {Object[]}
 */
function getActiveCombatsForChapter(chapterId) {
  const combatMap = getCombatMap();

  return Object.values(combatMap).filter(
    instance =>
      instance.chapterId === chapterId &&
      instance.status === "active"
  );
}

/**
 * Returns player actions available in the current combat context.
 * Filters by conditions so conditional actions (e.g. use potion when
 * player has potions) appear and disappear dynamically.
 *
 * @param {string}   chapterId
 * @param {string}   targetInstanceId - enemy used to build context (for _enemyHp)
 * @param {Object[]} playerActions    - from player.json
 * @returns {Object[]}
 */
function getAvailablePlayerActions(chapterId, targetInstanceId, playerActions) {
  if (!playerActions?.length) return [];

  const active = getActiveCombatsForChapter(chapterId);
  if (!active.length) return [];

  const instanceId = targetInstanceId ?? active[0].instanceId;
  const context    = buildContext(instanceId);

  return playerActions.filter(action => {
    if (!action.conditions) return true;

    return Conditions.evaluate(action.conditions, context);
  });
}

/**
 * Main entry point for a player combat action.
 *
 * Flow:
 *  1. Surprise check: if flag is set, enemy acts first (round 1 only)
 *  2. Resolve + apply player action effects (intercepting _enemyHp)
 *  3. Check combat end for target enemy
 *  4. If action.endsCombat → mark instance status and return
 *  5. If action.retaliation !== false → all active enemies in chapter act
 *  6. Check combat end after each enemy retaliation
 *  7. Advance round counter
 *  8. Register full turn in history via registerStateEvent()
 *
 * @param {Object}   playerAction     - action definition from player.json
 * @param {string}   targetInstanceId - which enemy the player is acting on
 * @param {string}   chapterId
 * @param {Function} applyEffectsFn   - Engine.applyEffects (avoids circular import)
 * @param {Function} registerEventFn  - Engine.registerStateEvent
 * @returns {{ ended: boolean, reason: string|null, events: Array, effects: Array }}
 */
function handlePlayerAction(
  playerAction,
  targetInstanceId,
  chapterId,
  applyEffectsFn,
  registerEventFn
) {
  const combatMap = getCombatMap();
  const instance  = combatMap[targetInstanceId];

  if (!instance || instance.status !== "active") {
    throw new Error(`Combat instance "${targetInstanceId}" is not active.`);
  }

  const resolved  = EnemyRegistry.resolveInstance(targetInstanceId);
  const allEvents = [];
  const allEffects = [];

  // ── 1. Surprise: enemy acts first on round 1 ──────────────────────────────
  if (instance.surprise && instance.round === 1) {
    const surpriseResult = _executeEnemyTurn(targetInstanceId, resolved, applyEffectsFn);

    allEvents.push(...surpriseResult.events);
    allEffects.push(...surpriseResult.effects);

    instance.surprise = false; // consumed — only happens once

    const endReason = checkCombatEnd(targetInstanceId, resolved, applyEffectsFn);
    if (endReason) {
      state.save();
      return _buildOutcome(true, endReason, allEvents, allEffects);
    }
  }

  // ── 2. Player action ───────────────────────────────────────────────────────
  const { effects: rawResolved, diceEvents } =
    Effects.resolveActionEffects(playerAction.effects ?? []);

  const { normalEffects, enemyHpDeltas } =
    separateEnemyHpEffects(rawResolved, targetInstanceId);

  applyEffectsFn(normalEffects);
  applyEnemyHpDeltas(enemyHpDeltas);

  allEffects.push(...rawResolved);

  // Dice events first for immersion
  allEvents.push(...diceEvents.map(e => ({ ...e })));

  // Player damage feedback (look for negative delta on enemy HP)
  const totalEnemyDamage = enemyHpDeltas.reduce((sum, d) => sum + d.delta, 0);
  if (totalEnemyDamage < 0 && playerAction.hitMessage) {
    allEvents.push({ type: "message", text: playerAction.hitMessage });
  }

  // ── 3. Check end after player action ──────────────────────────────────────
  const endAfterPlayer = checkCombatEnd(targetInstanceId, resolved, applyEffectsFn);

  if (endAfterPlayer === "instance_victory") {
    // This enemy is defeated — check if all enemies in the chapter are done
    const fullVictory = _checkAllDefeated(chapterId);

    if (fullVictory) {
      const xpAwarded = _creditBattleXp(applyEffectsFn);

      _advanceRound(targetInstanceId);
      _registerCombatTurn(
        targetInstanceId, chapterId, "player", playerAction.id,
        allEffects, allEvents, registerEventFn
      );
      state.save();
      return _buildOutcome(true, "victory", allEvents, allEffects, { xpAwarded });
    }
    // Still active enemies — continue (skip retaliation from defeated enemy,
    // remaining enemies will retaliate in step 5)
  } else if (endAfterPlayer === "defeat") {
    _advanceRound(targetInstanceId);
    _registerCombatTurn(
      targetInstanceId, chapterId, "player", playerAction.id,
      allEffects, allEvents, registerEventFn
    );
    state.save();
    return _buildOutcome(true, "defeat", allEvents, allEffects);
  }

  // ── 4. Player ends combat explicitly (flee, special action) ───────────────
  if (playerAction.endsCombat) {
    instance.status = playerAction.endsCombat; // e.g. "fled_player"

    // Discard accumulated XP — no reward for fleeing
    getProgress()._pendingXp = 0;

    // Apply onFlee effects if defined
    const onFlee = playerAction.onFlee;
    if (onFlee?.effects?.length) {
      const { effects: fleeEffects } = Effects.resolveActionEffects(onFlee.effects);
      applyEffectsFn(fleeEffects);
      allEffects.push(...fleeEffects);
    }

    _advanceRound(targetInstanceId);
    _registerCombatTurn(
      targetInstanceId, chapterId, "player", playerAction.id,
      allEffects, allEvents, registerEventFn
    );
    state.save();

    // Pass flee destination: explicit next > previous chapter > null (stay)
    const fleeNext = onFlee?.next ?? Reader.getPreviousChapterId() ?? null;
    return _buildOutcome(true, playerAction.endsCombat, allEvents, allEffects, {
      next: fleeNext
    });
  }

  // ── 5. Enemy retaliation (all active enemies in chapter react) ─────────────
  if (playerAction.retaliation !== false) {
    const activeInChapter = getActiveCombatsForChapter(chapterId);

    for (const enemyInstance of activeInChapter) {
      const enemyResolved = EnemyRegistry.resolveInstance(enemyInstance.instanceId);
      const enemyResult   = _executeEnemyTurn(
        enemyInstance.instanceId, enemyResolved, applyEffectsFn
      );

      allEvents.push(...enemyResult.events);
      allEffects.push(...enemyResult.effects);

      // ── 6. Check end after each enemy ──────────────────────────────────────
      const endAfterEnemy = checkCombatEnd(
        enemyInstance.instanceId, enemyResolved, applyEffectsFn
      );

      if (endAfterEnemy === "defeat") {
        // Player died — stop processing further enemies
        _advanceRound(targetInstanceId);
        _registerCombatTurn(
          targetInstanceId, chapterId, "enemy", enemyResult.actionId,
          allEffects, allEvents, registerEventFn
        );
        state.save();
        return _buildOutcome(true, "defeat", allEvents, allEffects);
      }
      // "victory" from enemy self-damage: continue processing remaining enemies
    }
  }

  // ── 7. Advance round ───────────────────────────────────────────────────────
  _advanceRound(targetInstanceId);

  // ── 8. Register turn in history ────────────────────────────────────────────
  _registerCombatTurn(
    targetInstanceId, chapterId, "player", playerAction.id,
    allEffects, allEvents, registerEventFn
  );

  state.save();

  return _buildOutcome(false, null, allEvents, allEffects);
}

// ─────────────────────────────────────────────────────────────────────────────

export const CombatEngine = {
  startCombat,
  handlePlayerAction,
  getActiveCombatsForChapter,
  getAvailablePlayerActions,
  resolveEnemyAction  // exported for debug/testing
};
