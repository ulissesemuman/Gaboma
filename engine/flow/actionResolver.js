import state from '../core/state.js';
import { Effects } from './effects.js';
import { Conditions } from './conditions.js';
import { Engine } from '../core/engine.js';
import { FeedbackResolver } from '../ui/feedbackResolver.js';
import { History } from './history.js';
import { tb } from '../i18n/bookI18n.js';
import { Reader } from '../core/reader.js';
import { interpolateBook } from '../utils/i18nUtils.js';
import { enqueueEvents } from '../ui/uiManager.js';
import { SheetModal } from '../ui/sheetModal.js';

export async function handleChoiceClick(choice) {
  const bookId           = state.currentBookId;
  const bookState        = state.bookState[bookId];
  const currentChapterId = bookState.progress.currentChapterId;

  // Resolve choice flow (sync — rolls dice, applies effects, evaluates conditions)
  const result = resolveChoice(choice);

  // 2️⃣ Build visual event queue
  //
  // Order rules:
  //   a) diceEvents ALWAYS first — player sees the roll before anything else
  //   b) startMessage AFTER dice — contextual message follows the roll result
  //   c) effect messages (varDelta, itemDelta, etc.) in the middle
  //   d) endMessage LAST — summary/consequence after all effects are shown
  //
  const diceEventItems = result.diceEvents.map(e => ({ ...e })); // already { type:"dice", … }

  const effectEvents = FeedbackResolver.resolveActionEvents(
    [],               // dice already separated
    result.resolvedEffects
  );

  const startMsg = result.startMessage
    ? [{ type: "message", text: interpolateBook(result.startMessage) }]
    : [];

  const endMsg = result.endMessage
    ? [{ type: "message", text: interpolateBook(result.endMessage) }]
    : [];

  const events = [
    ...diceEventItems,
    ...startMsg,
    ...effectEvents,
    ...endMsg
  ];

  // 3️⃣ Register turn in history
  History.registerStateEvent({
    chapterId: currentChapterId,
    source:    "choice",
    choiceId:  tb(choice.text),
    events,
    effects:   result.resolvedEffects
  });

  // Play visual queue — choices are disabled by renderReader before this call
  await enqueueEvents(events);


  // ── Open sheet modal if requested by any resolved effect ─────────
  const sheetEffect = result.resolvedEffects.find(
    e => e.type === "showCharacterSheet" || e.type === "showConsumableSelector"
  );

  if (sheetEffect) {
    const sheetOpts = {
      readOnly:     sheetEffect.readOnly     ?? false,
      allowSelling: sheetEffect.allowSelling ?? sheetEffect.enableTrading ?? false,
      sellCurrency: sheetEffect.sellCurrency ?? null,
    };

    await new Promise(resolve => {
      const opts = { ...sheetOpts, _onClose: resolve };
      if (sheetEffect.type === "showConsumableSelector") {
        SheetModal.openConsumables(opts);
      } else {
        SheetModal.openFull(opts);
      }
    });
  }

  // Navigate to next chapter (after all feedback finishes)
  return Reader.goToChapter(result.nextChapterId);
}

// ─── resolveChoice ────────────────────────────────────────────────────────────
function resolveChoice(choice) {
  const bookId           = state.currentBookId;
  const bookState        = state.bookState[bookId];
  const progress         = bookState.progress;
  const currentChapterId = progress.currentChapterId;

  let rawEffects = [];
  let diceEvents = [];

  if (choice.effects) rawEffects.push(...choice.effects);

  // ── Simple choice (no attempt) ────────────────────────────────────
  if (!choice.attempt) {
    const resolved = Effects.resolveActionEffects(rawEffects);
    Engine.applyEffects(resolved.effects);

    return {
      nextChapterId:  choice.next,
      resolvedEffects: resolved.effects,
      diceEvents:      resolved.diceEvents,
      startMessage:    null,
      endMessage:      null
    };
  }

  // ── Attempt branch ────────────────────────────────────────────────
  const { effects, success, failure } = choice.attempt;

  if (effects) rawEffects.push(...effects);

  // Resolve + apply shared attempt effects (usually the dice roll itself)
  const resolved = Effects.resolveActionEffects(rawEffects);
  Engine.applyEffects(resolved.effects);
  diceEvents.push(...resolved.diceEvents);

  const context = {
    variables:       progress.variables,
    items:           progress.items,
    turn:            progress.turn,
    chaptersVisited: progress.chaptersVisited
  };

  const isSuccess = Conditions.evaluate(success?.conditions, context) ?? false;

  let resultEffects  = [];
  let startMessage   = null;
  let endMessage     = null;
  let nextChapterId  = currentChapterId; // default: stay on same chapter

  if (isSuccess) {
    resultEffects = success?.effects ?? [];
    nextChapterId = success?.next ?? currentChapterId;
    startMessage  = success?.startMessage ?? null;
    endMessage    = success?.endMessage   ?? null;
  } else {
    resultEffects = failure?.effects ?? [];
    // failure never navigates away (loop until success or player gives up)
    startMessage  = failure?.startMessage ?? null;
    endMessage    = failure?.endMessage   ?? null;
  }

  // Resolve + apply branch-specific effects
  const branchResolved = Effects.resolveActionEffects(resultEffects);
  Engine.applyEffects(branchResolved.effects);
  diceEvents.push(...branchResolved.diceEvents);

  return {
    nextChapterId,
    resolvedEffects: branchResolved.effects,
    diceEvents,
    startMessage,
    endMessage
  };
}

export const ActionResolver = {
  resolveChoice,
  handleChoiceClick
}