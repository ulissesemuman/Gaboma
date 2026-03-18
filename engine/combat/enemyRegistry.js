/**
 * enemyRegistry.js
 *
 * Resolves an enemy instance into a complete, merged enemy definition.
 * Resolution chain: instanceId → instance → baseType → merge(base, overrides)
 *
 * The registry is populated once per book load via setEnemyData().
 */

let enemyData = null; // { enemies: {}, enemyInstances: {} }

/**
 * Called by bookManager after loading enemies.json.
 * @param {Object} data - parsed enemies.json content
 */
function setEnemyData(data) {
  enemyData = data ?? { enemies: {}, enemyInstances: {} };
}

/**
 * Resolves a full enemy definition from an instanceId.
 * Instance attributes override base type attributes.
 * onVictory / onDefeat on the instance override the base type's.
 *
 * @param {string} instanceId
 * @returns {Object} resolved enemy definition
 */
function resolveInstance(instanceId) {
  if (!enemyData) {
    throw new Error("EnemyRegistry not initialized. Call setEnemyData() first.");
  }

  const instance = enemyData.enemyInstances?.[instanceId];
  if (!instance) {
    throw new Error(`Enemy instance not found: "${instanceId}"`);
  }

  const baseType = enemyData.enemies?.[instance.type];
  if (!baseType) {
    throw new Error(`Enemy type not found: "${instance.type}" (referenced by instance "${instanceId}")`);
  }

  // Deep-merge: base type is the foundation, instance overrides on top.
  // Scalar overrides (hp, label, etc.) replace directly.
  // onVictory / onDefeat replace entirely if present on the instance.
  const resolved = {
    // ── identity ──────────────────────────────────────────────────
    instanceId,
    type: instance.type,

    // ── base attributes (overridable) ─────────────────────────────
    label:       instance.label       ?? baseType.label,
    description: instance.description ?? baseType.description ?? null,
    hp:          instance.overrides?.hp ?? baseType.hp,
    maxHp:       instance.overrides?.hp ?? baseType.hp,
    xpReward:    instance.overrides?.xpReward ?? baseType.xpReward,

    // ── combat behaviour (always from base type) ───────────────────
    actions: baseType.actions ?? [],

    // ── outcomes (instance overrides base entirely if present) ─────
    // Ensure "next" always exists even if author omitted it
    onVictory: _normalizeOutcome(instance.onVictory ?? baseType.onVictory),
    onDefeat:  _normalizeOutcome(instance.onDefeat  ?? baseType.onDefeat),

    // ── instance-level flags ───────────────────────────────────────
    // respawn: true  → enemy reappears after being defeated (hp resets on chapter re-entry)
    // respawn: false → enemy stays defeated permanently (default)
    respawn:  instance.respawn  ?? false,
    surprise: instance.surprise ?? false,

    // ── optional loot (item granted on victory, shorthand) ─────────
    loot: instance.loot ?? null
  };

  // If the instance has a loot shorthand, inject it into onVictory.effects
  if (resolved.loot && !instance.onVictory) {
    resolved.onVictory = {
      ...resolved.onVictory,
      effects: [
        ...resolved.onVictory.effects,
        { type: "addItem", id: resolved.loot, value: 1 }
      ]
    };
  }

  return resolved;
}

/**
 * Returns all instanceIds associated with a given chapterId
 * from the current progress.combat map.
 *
 * @param {Object} combatMap - progress.combat
 * @param {string} chapterId
 * @returns {string[]} list of instanceIds active in that chapter
 */
function getInstancesForChapter(combatMap, chapterId) {
  return Object.keys(combatMap).filter(
    id => combatMap[id].chapterId === chapterId
  );
}

/**
 * Returns true if the enemy instance should start (or restart) combat
 * when its chapter is entered.
 *
 * @param {Object} combatMap - progress.combat
 * @param {string} instanceId
 * @param {Object} resolved - resolved enemy definition
 * @returns {boolean}
 */
function shouldStartCombat(combatMap, instanceId, resolved) {
  const existing = combatMap[instanceId];

  // No record yet → always start
  if (!existing) return true;

  // Already active (paused mid-fight) → resume, don't restart
  if (existing.status === "active") return false;

  // Defeated: respawn true → always restart; false → never restart
  if (existing.status === "victory") return resolved.respawn === true;

  // Player fled: respawn "if_fled" or true → restart so player can retry
  //              respawn false → don't restart (enemy also disappears after flee)
  if (existing.status === "fled_player") {
    return resolved.respawn === true || resolved.respawn === "if_fled";
  }

  // Enemy fled: don't restart
  return false;
}

/**
 * Returns the raw instance definition (not merged with base type).
 * Used to check instance-level overrides like showHp.
 * @param {string} instanceId
 * @returns {Object|null}
 */
function _normalizeOutcome(outcome) {
  if (!outcome) return { next: null, effects: [] };
  return {
    next:    outcome.next    ?? null,
    effects: outcome.effects ?? []
  };
}

/**
 * Returns the raw instance definition (not merged with base type).
 * Used to check instance-level overrides like showHp.
 * @param {string} instanceId
 * @returns {Object|null}
 */
function getInstance(instanceId) {
  return enemyData?.enemyInstances?.[instanceId] ?? null;
}

export const EnemyRegistry = {
  setEnemyData,
  resolveInstance,
  getInstance,
  getInstancesForChapter,
  shouldStartCombat
};
