import { BookManager } from "./bookManager.js";
import state from "./core/state.js";
import { Reader } from "./reader.js";
import { t, tb } from "./i18n.js";
import { ExpressionEvaluator } from "./flow/expressionsEvaluator.js";
import { Effects } from "./flow/effects.js";

export function handleChoiceClick(choice) {
  const bookId = state.currentBookId;
  const bookState = state.bookState[bookId];
  const currentChapterId = bookState.progress.currentChapterId;

  // 1️⃣ Resolve fluxo da choice
  const result = resolveChoice(choice);

  // 2️⃣ Resolver effects (AST → delta)
  const { effects, diceEvents } =
    Effects.resolveActionEffects(result.rawEffects);

  // 3️⃣ Aplicar effects
  applyEffects(effects);

  // 4️⃣ Construir events visuais
  const events =
    resolveActionEvents(diceEvents, effects);

  // 5️⃣ Registrar turno
  registerStateEvent({
    chapterId: currentChapterId,
    source: "choice",
    choiceId: tb(choice.text),
    events,
    effects
  });

  // 6️⃣ Ir para próximo capítulo
  return Reader.goToChapter(result.nextChapterId);
}

function resolveChoice(choice) {
  const bookId = state.currentBookId;
  const bookState = state.bookState[bookId];
  const progress = bookState.progress;
  const currentChapterId = progress.currentChapterId;

  let rawEffects = [];

  if (choice.effects) {
    rawEffects.push(...choice.effects);
  }

  if (!choice.attempt) {
    return {
      nextChapterId: choice.next,
      rawEffects
    };
  }

  const { effects, success, failure } = choice.attempt;

  if (effects) {
    rawEffects.push(...effects);
  }

  const context = {
    variables: progress.variables,
    items: progress.items,
    turn: progress.turn,
    chaptersVisited: progress.chaptersVisited
  };

  const normalizedConditions = ExpressionEvaluator.normalizeCondition(success?.conditions);

  const isSuccess = normalizedConditions
    ? ExpressionEvaluator.evaluateCondition(normalizedConditions, context)
    : false;

  if (isSuccess) {
    if (success?.effects) {
      rawEffects.push(...success.effects);
    }

    return {
      nextChapterId: success?.next,
      rawEffects
    };
  }

  if (failure?.effects) {
    rawEffects.push(...failure.effects);
  }

  return {
    nextChapterId: currentChapterId,
    rawEffects,
    message: failure?.message ?? null
  };
}

function resolveActionEvents(diceEvents = [], effects = []) {
  const events = [...diceEvents];

  effects.forEach(effect => {

    switch (effect.type) {

      case "addVar": {
        const varConfig =
          story.variables?.[effect.id];

        // só exibe se permitido
        if (varConfig?.showInSheet !== false &&
            effect.delta !== 0) {

          events.push({
            type: "message",
            text: resolveVarDeltaText(effect)
          });
        }
        break;
      }

      case "addItem": {
        if (effect.delta !== 0) {
          events.push({
            type: "message",
            text: resolveItemDeltaText(effect)
          });
        }
        break;
      }

      case "rollChance": {
        events.push({
          type: "message",
          text: effect.success
            ? tb("game.rollChanceSuccess")
            : tb("game.rollChanceFail")
        });
        break;
      }

      case "startCombat": {
        events.push({
          type: "animation",
          id: "enter_combat"
        });
        break;
      }

      case "endCombat": {
        events.push({
          type: "animation",
          id: "exit_combat"
        });
        break;
      }
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
        const current =
          bookState.progress.variables[effect.id] ?? 0;

        bookState.progress.variables[effect.id] =
          current + effect.delta;
        break;
      }

      case "addItem": {
        const current =
          bookState.progress.items[effect.id] ?? 0;

        bookState.progress.items[effect.id] =
          current + effect.delta;
        break;
      }

      case "startCombat":
        bookState.progress.combat = effect.data;
        break;

      case "endCombat":
        bookState.progress.combat = null;
        break;

      case "rollChance":
        // não altera estado
        break;

      default:
        throw new Error(`Unknown effect: ${effect.type}`);
    }
  });

  checkFatalVariables(bookState, story);

  state.save();
}

function registerStateEvent({
  chapterId,
  events = [],
  effects = [],
  source = "choice", // choice | onEnter | system | combat | undo | auto
  choiceId = null
}) {
  const bookId = state.currentBookId;

  if (!bookId) {
    throw new Error("No current book selected");
  }

  const bookState = state.bookState[bookId];
  const progress = bookState.progress;
  const metadata = bookState.metadata;

  // 🔹 sequence sempre incrementa
  const nextSequence = (progress.sequence ?? 0) + 1;

  // 🔹 turn só incrementa se for escolha do jogador
  const nextTurn =
    source === "choice"
      ? progress.turn + 1
      : progress.turn;

  const entry = {
    sequence: nextSequence,
    turn: nextTurn,
    chapter: chapterId,
    source,
    choiceId,
    timeStamp: Date.now(),
    events,
    effects
  };

  state.persistGameData(bookId, {
    progress: {
      sequence: nextSequence,
      turn: nextTurn,
      addHistory: entry
    },
    metadata: {
      started: true,
      startedAt: metadata.startedAt ?? Date.now(),
      lastPlayedAt: Date.now()
    }
  });
}

export function resolveChapter(chapter) {

  if (!chapter?.choices) {
    return {
      ...chapter,
      choices: []
    };
  }

  const bookId = state.currentBookId;
  const bookState = state.bookState[bookId];
  const progress = bookState.progress;

  const context = {
    variables: progress.variables,
    items: progress.items,
    turn: progress.turn,
    chaptersVisited: progress.chaptersVisited
  };  

  const visibleChoices = chapter.choices
    .map(choice => {

      const normalizedConditions = ExpressionEvaluator.normalizeCondition(choice?.conditions);      

      const conditionsMet =
        !choice.conditions ||
        ExpressionEvaluator.evaluateCondition(normalizedConditions, context);


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
  resolveActionEvents,
  applyEffects,
  registerStateEvent,    
};