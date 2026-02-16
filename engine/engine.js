import { BookManager } from "./bookManager.js";
import state from "./state.js";

export function resolveChapter(chapter) {

  if (!chapter?.choices) {
    return {
      ...chapter,
      choices: []
    };
  }

  const visibleChoices = chapter.choices
    .map(choice => {

      const conditionsMet =
        !choice.conditions ||
        evaluateConditions(choice.conditions);

      // Caso normal
      if (conditionsMet) {
        return choice;
      }

      return null;

    })
    .filter(Boolean);

  return {
    ...chapter,
    choices: visibleChoices
  };
}

export function resolveChoice(choice) {
  const bookId = state.currentBookId;
  const currentChapter =
    state.bookState[bookId].progress.currentChapter;

  // Se não for attempt → fluxo simples
  if (!choice.attempt) {
    return choice.next;
  }

  const { effects, success, failure } = choice.attempt;

  // Aplica efeitos
  if (effects) {
    applyEffects(effects);
  }

  // Avalia sucesso
  const successConditions = success?.conditions ?? [];
  const isSuccess = evaluateConditions(successConditions);

  if (isSuccess) {
    return success.next;
  }

  // Falha
  if (failure?.message) {
    showChapterFeedback(failure.message);
  }

  return currentChapter;
}

export function evaluateEffects(effects, { count, sides }) {
  if (effect.type === "rollDice") {
    const result = rollDice({
      count: effect.count ?? manifest.dice.count,
      sides: effect.sides ?? manifest.dice.sides
    });

    

    if (effect.storeIn) {
      state.variables[effect.storeIn] = result;
    }
  }
}

export function evaluateConditions(conditions) {
  if (!conditions) return true;

  const inventory = state.bookState[state.currentBookId].progess.items;

  if (conditions.hasItem) {
    return state.inventory?.[conditions.hasItem] > 0;
  }

  if (conditions.hasNotItem) {
    return !state.inventory?.[conditions.hasNotItem];
  }

  if (conditions.variableEquals) {
    const { name, value } = conditions.variableEquals;
    return state.variables?.[name] === value;
  }

  if (conditions.all) {
    return conditions.all.every(cond =>
      evaluateConditions(cond, state)
    );
  }

  if (conditions.any) {
    return conditions.any.some(cond =>
      evaluateConditions(cond, state)
    );
  }

  if (conditions.dice) {
    const {
      count,
      sides,
      storeIn,
      min,
      max
    } = conditions.dice;

    const result = rollDice({
      count: count ?? manifest.dice.count,
      sides: sides ?? manifest.dice.sides,
      storeIn,
      bookState: state.bookState[currentBookId]
    });

    if (min !== undefined && result < min) return false;
    if (max !== undefined && result > max) return false;

    return true;
  }
}

function resolveDerivedVariables(bookId) {
  const vars = state.bookState[bookId].variables;
  const definitions = story.variables;

  Object.entries(definitions).forEach(([id, config]) => {
    if (config.type === "derived") {
      vars[id] = evaluateFormula(config.formula, vars);
    }
  });
}

export function startCombat(bookId, enemyInstanceId) {
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

  const book = BookManager.getCurrentBook();
  const { manifest, story } = book;

  const progress = bookState.progress;

  if (progress.currentChapter !== manifest.start) {
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

export const Engine = {
  resolveChapter,
  resolveChoice,
  hasRealProgress
};