import state from '../core/state.js';
import { Conditions } from './conditions.js';
import { Effects } from './effects.js';
import { Engine } from '../core/engine.js';
import { FeedbackResolver } from '../ui/feedbackResolver.js';
import { History } from './history.js';
import { enqueueEvents } from '../ui/uiManager.js';
import { tb } from '../i18n/bookI18n.js';
import { interpolateBook } from '../utils/i18nUtils.js';

export function resolveChapter(chapter, { triggerShowEvents = true } = {}) {

  if (!chapter?.choices) {
    return { ...chapter, choices: [], narrativeTexts: [] };
  }

  const bookId    = state.currentBookId;
  const bookState = state.bookState[bookId];
  const progress  = bookState.progress;

  const context = {
    variables:       progress.variables,
    items:           progress.items,
    turn:            progress.turn,
    chaptersVisited: progress.chaptersVisited
  };

  const visibleChoices = chapter.choices
    .map(choice => {
      const conditionsMet =
        !choice.conditions ||
        Conditions.evaluate(choice.conditions, context);

      return conditionsMet ? choice : null;
    })
    .filter(Boolean);

  // ── onShow / onFirstShow ──────────────────────────────────────────
  // Only trigger on genuine navigation (not re-renders of the same chapter).
  const showEvents = [];

  if (triggerShowEvents) visibleChoices.forEach(choice => {
    const choiceKey = _choiceShownKey(chapter.id, choice.text);

    const hasBeenShown = progress.variables[choiceKey] === true;

    // onFirstShow: runs only the very first time this choice becomes visible
    if (!hasBeenShown && choice.onFirstShow) {
      progress.variables[choiceKey] = true; // mark as shown

      const events = _resolveChoiceEvents(choice.onFirstShow, chapter.id, "onFirstShow", choice.text);
      showEvents.push(...events);
    }

    // onShow: runs every time this choice is visible
    if (choice.onShow) {
      const events = _resolveChoiceEvents(choice.onShow, chapter.id, "onShow", choice.text);
      showEvents.push(...events);
    }
  });

  if (showEvents.length) {
    enqueueEvents(showEvents);
  }

  // narrativeTexts: per-choice narrative lines (array or string) shown above
  // the buttons, but only when the owning choice is visible.
  // JSON field name: "narrative" (distinct from choice "text" which is the button label)
  const narrativeTexts = visibleChoices
    .filter(c => c.narrative)
    .flatMap(c =>
      Array.isArray(c.narrative)
        ? c.narrative.map(interpolateBook)
        : [interpolateBook(c.narrative)]
    );

  return {
    ...chapter,
    choices: visibleChoices,
    narrativeTexts
  };
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Reserved variable key to track whether a choice has been shown before.
 * Stored in progress.variables to persist across saves.
 */
function _choiceShownKey(chapterId, choiceText) {
  return `_shown:${chapterId}:${choiceText}`;
}

/**
 * Resolves and applies effects from an onShow/onFirstShow block.
 * Supports startMessage and endMessage on those blocks.
 * Returns visual events array.
 */
function _resolveChoiceEvents(block, chapterId, source, choiceText) {
  if (!block) return [];

  const events = [];

  // startMessage first
  if (block.startMessage) {
    events.push({ type: "message", text: interpolateBook(block.startMessage) });
  }

  // Resolve + apply effects
  if (block.effects?.length) {
    const { effects, diceEvents } = Effects.resolveActionEffects(block.effects);
    Engine.applyEffects(effects);

    const feedbackEvents = FeedbackResolver.resolveActionEvents(diceEvents, effects);

    History.registerStateEvent({
      chapterId,
      source,
      choiceId: tb(choiceText),
      events:   feedbackEvents,
      effects
    });

    // Dice first, then effect feedback
    events.unshift(...diceEvents.map(e => ({ ...e })));
    events.push(...feedbackEvents.filter(e => e.type !== "dice"));
  }

  // endMessage last
  if (block.endMessage) {
    events.push({ type: "message", text: interpolateBook(block.endMessage) });
  }

  return events;
}

export const ChapterResolver = {
    resolveChapter
}