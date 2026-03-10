import { BookLoader } from "./data/bookLoader.js";
import state from "./core/state.js";
import { Reader } from "./core/reader.js";
import { t, tb } from "./i18n.js";

function resolveValueExpression(expr, diceEvents = []) {
  if (typeof expr === "number") {
    return { value: expr, diceEvents };
  }

  if (expr.dice) {
    const results = [];
    let total = 0;

    for (let i = 0; i < expr.dice.count; i++) {
      const roll =
        Math.floor(Math.random() * expr.dice.sides) + 1;

      results.push(roll);
      total += roll;
    }

    diceEvents.push({
      type: "dice",
      dice: expr.dice,
      results,
      total
    });

    return { value: total, diceEvents };
  }

  if (expr.var) {
    return {
      value: getVariable(expr.var),
      diceEvents
    };
  }

  if (expr.op) {
    const left = resolveValueExpression(expr.left, diceEvents);
    const right = resolveValueExpression(expr.right, left.diceEvents);

    let result;

    switch (expr.op) {
      case "add":
        result = left.value + right.value;
        break;
      case "subtract":
        result = left.value - right.value;
        break;
    }

    return {
      value: result,
      diceEvents: right.diceEvents
    };
  }

  return { value: 0, diceEvents };
}

function resolveDerivedVariables(bookId) {
  const vars = state.bookState[bookId].variables;
  const story = Reader.getCurrentStory();
  const definitions = story.variables;

  Object.entries(definitions).forEach(([id, config]) => {
    if (config.type === "derived") {
      vars[id] = evaluateFormula(config.formula, vars);
    }
  });
}

export function startCombat(bookId, enemyInstanceId) {
  //Verificar se já está em combate
  //Verificar se há inimigos
  //Escolher um inimigo
  //Iniciar combate


  const story = getCurrentBook().story;
  const instance = story.enemyInstances[enemyInstanceId];

  if (!instance) {
    throw new Error("Enemy instance not found");
  }

  const baseEnemy = story.enemies[instance.type];

  state.bookState[bookId].combat = {
    activeEnemyId: enemyInstanceId,
    baseType: instance.type,
    hp: baseEnemy.hp,
    round: 1
  };

  state.save();
}

export function shouldStartCombat(bookId, enemyInstanceId) {
  const story = getCurrentBook().story;
  const instance = story.enemyInstances[enemyInstanceId];

  if (!instance.persistent) {
    return true;
  }

  return !state.bookState[bookId].enemies.defeated[enemyInstanceId];
}

export function hasRealProgress(bookId) {
  if (!bookId) return false;

  const bookState = state.bookState?.[bookId];
  if (!bookState) return false;

  const book = BookLoader.getCurrentBook();
  const story = book.story;

  const progress = bookState.progress;

  if (progress.currentChapterId !== book.story.startChapterId) {
    return true;
  }

  if (story.variables) {
    for (const [id, config] of Object.entries(story.variables)) {
      const initial = config.initial ?? 0;
      const current = progress.variables?.[id] ?? initial;

      if (current !== initial) {
        return true;
      }
    }
  }

  if (story.items) {
    for (const [id, config] of Object.entries(story.items)) {
      const initial = config.initial ?? 0;
      const current = progress.items?.[id] ?? initial;

      if (current !== initial) {
        return true;
      }
    }
  }

  if (progress.combat?.enemyId) {
    return true;
  }

  return false;
}

function startNewGame() {
  //Resetar history
  //Resetar combat
  //Resetar metadata
  //Resetar variáveis
}

function endGame() {
  //Ver o que deve ser feito, tomar cuidado com o histórico
}

function endCombat() {

}

export const EngineOld = {
  hasRealProgress
};