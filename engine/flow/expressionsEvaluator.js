import { DiceRoller } from "../diceRoller.js";

export function evaluateExpression(expr, context = {}, options = {}) {
  const { allowDice = false } = options;

  if (expr === null || expr === undefined) return 0;

  if (typeof expr === "number") return expr;
  if (typeof expr === "boolean") return expr;

  // ==============================
  // VARIÁVEIS
  // ==============================

  if (expr.var) {
    return context.variables?.[expr.var] ?? 0;
  }

  if (expr.turn !== undefined) {
    return context.turn ?? 0;
  }

  if (expr.itemQuantity) {
    return context.items?.[expr.itemQuantity] ?? 0;
  }

  if (expr.chapterVisited) {
    return context.chaptersVisited?.[expr.chapterVisited] ?? 0;
  }  

  // ==============================
  // DICE (somente effects)
  // ==============================

  if (expr.dice) {
    if (!allowDice) {
      throw new Error("Dice not allowed here");
    }

    const { count, sides } = expr.dice;
    const results = DiceRoller.rollDice({ count, sides });
    const total = results.reduce((a, b) => a + b, 0);

    if (options.diceEvents) {
      options.diceEvents.push({
      type: "dice",
      dice: { count, sides },
      results,
      total
      });
    }

    return total;
  }

  // ==============================
  // OPERADORES BINÁRIOS (AST)
  // ==============================

  const binaryOps = [
    "add", "subtract", "multiply",
    "divide", "mod", "power",
    "gte", "lte", "gt", "lt",
    "eq", "neq",
    "min", "max"
  ];

  for (const op of binaryOps) {
    if (expr[op]) {

      if (!Array.isArray(expr[op]) || expr[op].length !== 2) {
        throw new Error(`${op} must receive exactly 2 arguments`);
      }

      const [a, b] = expr[op].map(e =>
        evaluateExpression(e, context, options)
      );

      switch (op) {
        case "add": return a + b;
        case "subtract": return a - b;
        case "multiply": return a * b;
        case "divide": return b !== 0 ? a / b : 0;
        case "mod": return a % b;
        case "power": return Math.pow(a, b);

        case "gte": return a >= b;
        case "lte": return a <= b;
        case "gt": return a > b;
        case "lt": return a < b;
        case "eq": return a === b;
        case "neq": return a !== b;

        case "min": return Math.min(a, b);
        case "max": return Math.max(a, b);
      }
    }
  }

  // ==============================
  // FUNÇÕES UNÁRIAS
  // ==============================

  if (expr.round !== undefined) {
    return Math.round(
      evaluateExpression(expr.round, context, options)
    );
  }

  if (expr.floor !== undefined) {
    return Math.floor(
      evaluateExpression(expr.floor, context, options)
    );
  }

  if (expr.ceil !== undefined) {
    return Math.ceil(
      evaluateExpression(expr.ceil, context, options)
    );
  }

  if (expr.abs !== undefined) {
    return Math.abs(
      evaluateExpression(expr.abs, context, options)
    );
  }

  if (expr.clamp) {
    if (!Array.isArray(expr.clamp) || expr.clamp.length !== 3) {
      throw new Error("clamp must receive exactly 3 arguments");
    }

    const [x, min, max] = expr.clamp.map(e =>
      evaluateExpression(e, context, options)
    );

    return Math.min(Math.max(x, min), max);
  }

  if (expr.not !== undefined) {
    return !Boolean(
      evaluateExpression(expr.not, context, options)
    );
  }

  throw new Error("Invalid expression structure");
}

export function evaluateCondition(condition, context) {
  if (!condition) return true;

  if (condition.all) {
    return condition.all.every(cond =>
      evaluateCondition(cond, context)
    );
  }

  if (condition.any) {
    return condition.any.some(cond =>
      evaluateCondition(cond, context)
    );
  }

  if (condition.not) {
    return !evaluateCondition(condition.not, context);
  }

  // expressão booleana pura
  return Boolean(
    evaluateExpression(condition, context, { allowDice: false })
  );
}

 /*     "conditions": {
        "all": [
          { "hasItem": "key" },
          { "variableAtLeast": { "name": "strength", "value": 5 } },
          { "type": "chapterVisited", "chapter": "caverna", "min": 3 },
          { "type": "firstVisit", "chapter": "torre" }
        ]
      },


*/

export function normalizeCondition(condition) {
  if (!condition) return null;

  if (condition.hasItem) {
    return {
      gt: [
        { itemQuantity: condition.hasItem },
        0
      ]
    };
  }

  if (condition.hasNotItem) {
    return {
      eq: [
        { itemQuantity: condition.hasNotItem },
        0
      ]
    };
  }

  if (condition.chapterVisited) {
    return {
      gte: [
        { chapterVisited: condition.chapterVisited.id },
        condition.chapterVisited.min ?? 1
      ]
    };
  }  

  if (condition.variables) {
    const key = Object.keys(condition.variables)[0];
    const operatorObj = condition.variables[key];

    const operator = Object.keys(operatorObj)[0];
    const value = operatorObj[operator];

    return {
      [operator]: [
        { var: key },
        value
      ]
    };
  }

  if (condition.all) {
    return {
      all: condition.all.map(normalizeCondition)
    };
  }

  if (condition.any) {
    return {
      any: condition.any.map(normalizeCondition)
    };
  }

  if (condition.not) {
    return {
      not: normalizeCondition(condition.not)
    };
  }  

  return condition;
}

export const ExpressionEvaluator = {
  evaluateExpression,
  evaluateCondition,
  normalizeCondition
};