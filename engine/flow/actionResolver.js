import state from '../core/state.js';
import { Effects } from './effects.js';
import { Conditions } from '../flow/conditions.js';
import { Engine } from '../core/engine.js';
import { FeedbackResolver } from '../ui/feedbackResolver.js';
import { History } from './history.js';
import { tb } from '../i18n.js';
import { Reader } from '../core/reader.js';

export function handleChoiceClick(choice) {
  const bookId = state.currentBookId;
  const bookState = state.bookState[bookId];
  const currentChapterId = bookState.progress.currentChapterId;

  // 1️⃣ Resolve fluxo da choice
  const result = resolveChoice(choice);

  // 4️⃣ Construir events visuais
  const events =
    FeedbackResolver.resolveActionEvents(result.diceEvents, result.resolvedEffects);

  // 5️⃣ Registrar turno
  History.registerStateEvent({
    chapterId: currentChapterId,
    source: "choice",
    choiceId: tb(choice.text),
    events,
    effects: result.resolvedEffects
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
  let diceEvents = [];
  let resolved = null;

  if (choice.effects) {
    rawEffects.push(...choice.effects);
  }

  if (!choice.attempt) {
    // 2️⃣ Resolver effects (AST → delta)
    const resolved =
      Effects.resolveActionEffects(rawEffects);

    // 3️⃣ Aplicar effects
    Engine.applyEffects(resolved.effects);

    return {
      nextChapterId: choice.next,
      resolvedEffects: resolved.effects,
      diceEvents: resolved.diceEvents
    };
  }

  const { effects, success, failure } = choice.attempt;

  if (effects) {
    rawEffects.push(...effects);
  }

  // 2️⃣ Resolver effects (AST → delta)
  resolved =
    Effects.resolveActionEffects(rawEffects);

  // 3️⃣ Aplicar effects
  Engine.applyEffects(resolved.effects);

  diceEvents.push(...resolved.diceEvents);

  const context = {
    variables: progress.variables,
    items: progress.items,
    turn: progress.turn,
    chaptersVisited: progress.chaptersVisited
  };

  const isSuccess = Conditions.normalizedConditions
    ? Conditions.evaluate(success?.conditions, context)
    : false;

  let resultEffects = [];
  let message = null;
  let nextChapterId = currentChapterId;

  if (isSuccess) {
    if (success?.effects) {
      nextChapterId = success?.next;
      resultEffects = success.effects;
      message = success?.message ?? null;
    }
  }
  else {
    if (failure?.effects) {
      resultEffects = failure.effects;
      message = failure?.message ?? null;
    }
  }

  // 2️⃣ Resolver effects (AST → delta)
  resolved =
    Effects.resolveActionEffects(resultEffects);

  // 3️⃣ Aplicar effects
  Engine.applyEffects(resolved.effects);

  diceEvents.push(...resolved.diceEvents);  

  return {
    nextChapterId,
    resolvedEffects: resolved.effects,
    diceEvents,
    message
  };
}

export const ActionResolver = {
  resolveChoice,
  handleChoiceClick
}