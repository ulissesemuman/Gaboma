import { BookManager } from "./bookManager.js";
import state from "./state.js";
import { Reader } from "./reader.js";
import { t, tb } from "./i18n.js";

export function handleChoiceClick(choice) {

  const chapterId = resolveChoice(choice);

  const { effects, diceEvents } =
    resolveActionEffects(choice);

  const events =
    resolveActionEvents(diceEvents, effects);

  applyEffects(effects);

  registerTurn({
    chapterId,
    source: "choice",
    choiceId: choice.id,
    events,
    effects
  });

  return Reader.goToChapter(chapterId);
}

function resolveChoice(choice) {
  const bookId = state.currentBookId;
  const currentChapterId =
    state.bookState[bookId].progress.currentChapterId;

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

  return currentChapterId;
}

function resolveActionEffects(choice) {
  const effects = [];
  const diceEvents = [];

  if (!choice.effects) {
    return { effects, diceEvents };
  }

  choice.effects.forEach(effect => {

    if (effect.type === "addVar") {
      const { value, diceEvents: dice } =
        resolveValueExpression(effect.value, diceEvents);

      const delta = value;

      effects.push({
        type: "addVar",
        id: effect.id,
        delta
      });

      diceEvents.push(...dice);
    }

    if (effect.type === "setVar") {
      const current =
        getVariable(effect.id);

      const { value, diceEvents: dice } =
        resolveValueExpression(effect.value, diceEvents);

      const delta = value - current;

      effects.push({
        type: "addVar",
        id: effect.id,
        delta
      });

      diceEvents.push(...dice);
    }
  });

  return { effects, diceEvents };
}

function resolveActionEvents(diceEvents, effects) {
  const events = [...diceEvents];

  effects.forEach(effect => {
    if (effect.type === "addVar") {
      events.push({
        type: "message",
        text: resolveVarDeltaText(effect)
      });
    }
  });

  return events;
}

function resolveVarDeltaText(effect) {
  const story = BookManager.getCurrentBook().story;  
  const varConfig = story.variables?.[effect.id];

  const varLabel = resolveLabel(
    varConfig?.label,
    effect.id
  );

  const sign = effect.delta > 0 ? "+" : "";

  const params = {
    var: varLabel,
    sign,
    value: effect.delta
  };

  const key = "game.varDelta";

  const template = resolveLabel(
    key,
    "{var} {sign}{value}"
  );  

  return template.replace(
    /\{(var|sign|value)\}/g,
    (_, k) => params[k] ?? ""
  );
}

function resolveLabel(key, fallback) {
  if (!key) return fallback;

  const book = tb(key);
  if (book !== key) return book;

  const engine = t(key);
  if (engine !== key) return engine;

  return fallback;
}

function applyEffects(effects = []) {
  const bookId = state.currentBookId;
  if (!bookId) {
    throw new Error("No current book selected");
  }

  const bookState = state.bookState[bookId];
  const book = BookManager.getCurrentBook();
  const story = book.story;

  effects.forEach(effect => {

    switch (effect.type) {

      case "addVar": {
        const variableConfig = story.variables?.[effect.id];

        if (!variableConfig) {
          throw new Error(`Variable not found: ${effect.id}`);
        }

        const current =
          bookState.progress.variables[effect.id] ?? 0;

        let next = current + effect.delta;

        if (variableConfig.min !== undefined) {
          next = Math.max(variableConfig.min, next);
        }

        if (variableConfig.max !== undefined) {
          next = Math.min(variableConfig.max, next);
        }

        bookState.progress.variables[effect.id] = next;

        break;
      }

      case "addItem": {
        if (!story.items?.[effect.id]) {
          throw new Error(`Item not found: ${effect.id}`);
        }

        const current =
          bookState.progress.items[effect.id] ?? 0;

        bookState.progress.items[effect.id] =
          current + (effect.delta ?? 1);

        break;
      }

      case "removeItem": {
        if (!story.items?.[effect.id]) {
          throw new Error(`Item not found: ${effect.id}`);
        }

        const current =
          bookState.progress.items[effect.id] ?? 0;

        const next =
          Math.max(0, current - (effect.delta ?? 1));

        bookState.progress.items[effect.id] = next;

        break;
      }

      case "startCombat": {
        const enemyInstance =
          story.enemyInstances?.[effect.enemyId];

        if (!enemyInstance) {
          throw new Error(`Enemy instance not found: ${effect.enemyId}`);
        }

        const enemyType =
          story.enemies?.[enemyInstance.type];

        if (!enemyType) {
          throw new Error(`Enemy type not found: ${enemyInstance.type}`);
        }

        bookState.progress.combat = {
          enemyId: effect.enemyId,
          enemyHp: enemyType.hp,
          round: 1
        };

        break;
      }

      case "endCombat": {
        bookState.progress.combat = null;
        break;
      }

      case "goto": {
        // NÃO fazer aqui
        // goToChapter deve ser chamado fora
        break;
      }

      default:
        throw new Error(`Unknown effect type: ${effect.type}`);
    }
  });

  checkFatalVariables(bookState, story);

  state.save();
}

function registerTurn({ chapterId, events = [], effects = [], source = "choice", choiceId = null }) {
  const bookId = state.currentBookId;

  if (!bookId) {
    throw new Error("No current book selected");
  }

  const bookState = state.bookState[bookId];
  const progress = bookState.progress;

  const nextTurn = progress.turn + 1;

  const turnEntry = {
    turn: nextTurn,
    chapter: chapterId,
    source, // choice, onEnter, system, combat, undo, auto
    choiceId,
    timeStamp: Date.now(),
    events,
    effects
  };

  state.persistGameData(bookId, {
    progress: {
      turn: nextTurn,
      addHistory: turnEntry
    },
  metadata: {
      startedAt: bookState.metadata.startedAt ?? Date.now()
    }
  });

  if (!state.hasProgress(bookId)) {
    state.persistGameData(bookId, {
      metadata: {
        started: true
      }
    });
  }  
}

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



function checkFatalVariables(bookState, story) {
  const variables = story.variables;

  if (!variables) return;

  for (const [id, config] of Object.entries(variables)) {

    if (config.fatalAtZero) {
      const value =
        bookState.progress.variables[id] ?? 0;

      if (value <= 0) {
        bookState.progress.gameOver = true;
      }
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
      evaluateConditions(cond)
    );
  }

  if (conditions.any) {
    return conditions.any.some(cond =>
      evaluateConditions(cond)
    );
  }

/*case "chapterVisited":
  return (
    (progress.chaptersVisited[cond.chapter] || 0) >= cond.min
  );  

if (chaptersVisited["floresta"] > 1) {
  mostrarTextoAlternativo();
}

if (chaptersVisited["baú"] === 1) {
  darItem();
}*/


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

  const book = BookManager.getCurrentBook();
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

export function rollDice({ count, sides }) {
  let total = 0;

  for (let i = 0; i < count; i++) {
    total += Math.floor(Math.random() * sides) + 1;
  }

  return total;
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

export const Engine = {
  resolveChapter,
  resolveChoice,
  handleChoiceClick,
  hasRealProgress,
  resolveActionEffects,
  resolveActionEvents,
  applyEffects,
  registerTurn
};