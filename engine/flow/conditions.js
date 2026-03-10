import { Expressions } from "./expressions.js";

export function evaluate(condition, context) {
  if (!condition) return true;

  const normalizedCondition = normalize(condition);

  if (normalizedCondition.all) {
    return normalizedCondition.all.every(cond =>
      evaluate(cond, context)
    );
  }

  if (normalizedCondition.any) {
    return normalizedCondition.any.some(cond =>
      evaluate(cond, context)
    );
  }

  if (normalizedCondition.not) {
    return !evaluate(normalizedCondition.not, context);
  }

  // expressão booleana pura
  return Boolean(
    Expressions.evaluate(normalizedCondition, context, { allowDice: false })
  );
}

function normalize(condition) {
  if (!condition) return null;

  const keys = Object.keys(condition);
  if (keys.length === 0) return null;

  if (condition.all || condition.and) {
    return {
      all: (condition.all ?? condition.and).map(normalize)
    };
  }

  if (condition.any || condition.or) {
    return {
      any: (condition.any ?? condition.or).map(normalize)
    };
  }

  if (condition.not) {
    return {
      not: normalize(condition.not)
    };
  }  

  if (keys.length > 1) {
    return {
      all: keys.map(key => normalize({ [key]: conditions[key] }))
    };
  }  

  if (condition.variables) {
    return normalizeGroup(condition.variables, "var");
  }

  if (condition.items) {
    return normalizeGroup(condition.items, "itemCount");
  }

  if (condition.enemies) {
    return normalizeGroup(condition.enemies, "enemyHealth");
  }

  if (condition.visited) {
    return normalizeGroup(condition.visited, "visitCount");
  }

  if (condition.hasItem) {
    return {
      gt: [
        { itemCount: condition.hasItem },
        0
      ]
    };
  }

  if (condition.hasNoItem) {
    return {
      eq: [
        { itemCount: condition.hasNoItem },
        0
      ]
    };
  }

/*  if (condition.itemCount) {
    return {
      gte: [
        { itemCount: condition.itemCount.id },
        condition.itemCount.min ?? 1
      ]
    };
  }*/

  if (condition.hasVisited) {
    return {
      gt: [
        { visitCount: condition.hasVisited },
        0
      ]
    };
  }

  if (condition.notVisited) {
    return {
      eq: [
        { visitCount: condition.notVisited },
        0
      ]
    };
  }

  if (condition.isEnemyDefeated) {
    return {
      gt: [
        { visitCount: condition.isEnemyDefeated },
        0
      ]
    };
  }

  if (condition.isEnemyAlive) {
    return {
      eq: [
        { visitCount: condition.isEnemyAlive },
        0
      ]
    };
  }  

  return condition;
}

const operatorMap = {
  "and": "all",
  "or": "any"
};

function normalizeGroup(data, internalKey) {
  return {
    all: Object.entries(data).map(([id, opObj]) => {
      const authorOp = Object.keys(opObj)[0];
      const realOp = operatorMap[authorOp] || authorOp;
      
      return {
        [realOp]: [{ [internalKey]: id }, opObj[authorOp]]
      };
    })
  };
}

export const Conditions = {
    evaluate
}