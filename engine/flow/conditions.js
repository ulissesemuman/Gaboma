import { Expressions } from "./expressions.js";

export function evaluate(condition, context) {
  if (!condition) return true;

  const normalized = normalize(condition);
  if (!normalized) return true;

  if (normalized.all) {
    return normalized.all.every(cond => evaluate(cond, context));
  }

  if (normalized.any) {
    return normalized.any.some(cond => evaluate(cond, context));
  }

  if (normalized.not) {
    return !evaluate(normalized.not, context);
  }

  // Leaf: boolean expression evaluated by Expressions
  return Boolean(
    Expressions.evaluate(normalized, context, { allowDice: false })
  );
}

function normalize(condition) {
  if (!condition) return null;

  const keys = Object.keys(condition);
  if (keys.length === 0) return null;

  // ── Logical combinators ────────────────────────────────────────────
  if (condition.all || condition.and || condition.every) {
    return { all: (condition.all ?? condition.and ?? condition.every).map(normalize) };
  }

  if (condition.any || condition.or || condition.some) {
    return { any: (condition.any ?? condition.or ?? condition.some).map(normalize) };
  }

  if (condition.not) {
    return { not: normalize(condition.not) };
  }

  // ── Multiple keys at root → implicit AND ───────────────────────────
  if (keys.length > 1) {
    return { all: keys.map(key => normalize({ [key]: condition[key] })) };
  }

  // ── Author-friendly group shorthands ──────────────────────────────
  if (condition.variables) return normalizeGroup(condition.variables, "var");
  if (condition.items)     return normalizeGroup(condition.items,     "itemCount");
  if (condition.enemies)   return normalizeGroup(condition.enemies,   "enemyHealth");
  if (condition.visited)   return normalizeGroup(condition.visited,   "visitCount");

  // ── Metric + operator shorthand (visitCount, itemCount, var…) ─────
  if (
    condition.visitCount ||
    condition.itemCount  ||
    condition.enemyHealth ||
    condition.var
  ) {
    const [metric, data] = Object.entries(condition)[0];
    const operatorKey    = Object.keys(data).find(k => operatorMap[k]);

    return {
      [operatorMap[operatorKey]]: [
        { [metric]: data.id },
        data[operatorKey] ?? 1
      ]
    };
  }

  // ── Boolean shorthands ────────────────────────────────────────────
  if (condition.hasItem)   return { gt:  [{ itemCount:  condition.hasItem   }, 0] };
  if (condition.hasNoItem) return { eq:  [{ itemCount:  condition.hasNoItem }, 0] };
  if (condition.hasVisited)return { gt:  [{ visitCount: condition.hasVisited}, 0] };
  if (condition.notVisited)return { eq:  [{ visitCount: condition.notVisited}, 0] };

  // ── Enemy status shorthands ───────────────────────────────────────
  // These check progress.combat[instanceId].status via enemyStatus accessor
  if (condition.isEnemyDefeated) {
    return { eq: [{ enemyStatus: condition.isEnemyDefeated }, "victory"] };
  }
  if (condition.isEnemyAlive) {
    return { eq: [{ enemyStatus: condition.isEnemyAlive }, "active"] };
  }

  // ── Already a leaf expression (gte, lte, eq, etc.) ───────────────
  return condition;
}

const operatorMap = {
  min:      "gte",
  max:      "lte",
  exactly:  "eq",
  is:       "eq",
  moreThan: "gt",
  lessThan: "lt"
};

function normalizeGroup(data, internalKey) {
  return {
    all: Object.entries(data).map(([id, opObj]) => {
      const authorOp = Object.keys(opObj)[0];
      const realOp   = operatorMap[authorOp] || authorOp;
      return { [realOp]: [{ [internalKey]: id }, opObj[authorOp]] };
    })
  };
}

export const Conditions = {
    evaluate
}