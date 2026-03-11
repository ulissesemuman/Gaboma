import { dice } from "./dice.js";

export function evaluate(expr, context = {}, options = {}) {
  const { allowDice = false } = options;

  if (expr === null || expr === undefined) return 0;

  if (typeof expr === "number") return expr;
  if (typeof expr === "boolean") return expr;

  // ==============================
  // VARIÁVEIS
  // ==============================

  if (expr.var) {
    const val = context.variables?.[expr.var];
    // Boolean variables return as-is for condition checks
    // Undefined variables default to 0 for numeric operations
    return val !== undefined ? val : 0;
  }

  if (expr.turn !== undefined) {
    return context.turn ?? 0;
  }

  if (expr.itemCount) {
    return context.items?.[expr.itemCount] ?? 0;
  }

  if (expr.visitCount) {
    return context.chaptersVisited?.[expr.visitCount] ?? 0;
  }  

  // ==============================
  // DICE (somente effects)
  // ==============================

  if (expr.dice) {
    if (!allowDice) {
      throw new Error("Dice not allowed here");
    }

    const { count, sides } = expr.dice;
    const results = dice.roll({ count, sides });
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
  // OPERADORES (AST)
  // ==============================

  const operators = [
    "add", "subtract", "multiply",
    "divide", "mod", "power",
    "gte", "lte", "gt", "lt",
    "eq", "neq",
    "min", "max"
  ];

  for (const op of operators) {
    if (expr[op]) {

      if (!Array.isArray(expr[op]) || expr[op].length < 1) {
        throw new Error(`${op} must receive at least 1 argument`);
      }

      const values = expr[op].map(e =>
        evaluate(e, context, options)
      );

      switch (op) {

        // ---------- ARITMÉTICOS N-ÁRIOS ----------

        case "add":
          return values.reduce((acc, v) => acc + v, 0);

        case "subtract":
          return values.slice(1).reduce(
            (acc, v) => acc - v,
            values[0]
          );

        case "multiply":
          return values.reduce((acc, v) => acc * v, 1);

        case "divide":
          return values.slice(1).reduce(
            (acc, v) => v !== 0 ? acc / v : 0,
            values[0]
          );

        case "mod":
          return values.slice(1).reduce(
            (acc, v) => acc % v,
            values[0]
          );

        case "power":
          return values.slice(1).reduce(
            (acc, v) => Math.pow(acc, v),
            values[0]
          );

        case "min":
          return Math.min(...values);

        case "max":
          return Math.max(...values);

        // ---------- COMPARADORES (2 argumentos apenas) ----------

        case "gte":
        case "lte":
        case "gt":
        case "lt":
        case "eq":
        case "neq":

          if (values.length !== 2) {
            throw new Error(`${op} must receive exactly 2 arguments`);
          }

          const [a, b] = values;

          switch (op) {
            case "gte": return a >= b;
            case "lte": return a <= b;
            case "gt":  return a > b;
            case "lt":  return a < b;
            case "eq":  return a === b;
            case "neq": return a !== b;
          }
      }
    }
  }

  // ==============================
  // FUNÇÕES UNÁRIAS
  // ==============================

  if (expr.round !== undefined) {
    return Math.round(
      evaluate(expr.round, context, options)
    );
  }

  if (expr.floor !== undefined) {
    return Math.floor(
      evaluate(expr.floor, context, options)
    );
  }

  if (expr.ceil !== undefined) {
    return Math.ceil(
      evaluate(expr.ceil, context, options)
    );
  }

  if (expr.abs !== undefined) {
    return Math.abs(
      evaluate(expr.abs, context, options)
    );
  }

  if (expr.clamp) {
    if (!Array.isArray(expr.clamp) || expr.clamp.length !== 3) {
      throw new Error("clamp must receive exactly 3 arguments");
    }

    const [x, min, max] = expr.clamp.map(e =>
      evaluate(e, context, options)
    );

    return Math.min(Math.max(x, min), max);
  }

  if (expr.not !== undefined) {
    return !Boolean(
      evaluate(expr.not, context, options)
    );
  }

  throw new Error("Invalid expression structure");
}

export const Expressions = {
    evaluate
}