import state from "./state.js";
import { Engine } from "./engine.js";
import { Effects } from "../flow/effects.js";
import { ChapterResolver } from "../flow/chapterResolver.js";
import { FeedbackResolver } from "../ui/feedbackResolver.js";
import { History } from "../flow/history.js";
import { enqueueEvents } from "../ui/uiManager.js";
import { interpolateBook } from "../utils/i18nUtils.js";

let currentStory = null;

export function loadStory(story) {
  currentStory = story;
}

export function startStory() {
  return goToChapter(currentStory.startChapterId);
}

// ─── Shared: resolve effects → apply → build events → register ────────────────
// Supports startMessage and endMessage on any block (onEnter, onFirstEnter).
// Returns the full visual events array ready for enqueueEvents.
function resolveAndApplyEffects(block, chapterId, source) {
  if (!block) return [];

  const events = [];

  // startMessage enqueued first (but after dice — dice are injected below)
  const startMsg = block.startMessage
    ? [{ type: "message", text: interpolateBook(block.startMessage) }]
    : [];

  const endMsg = block.endMessage
    ? [{ type: "message", text: interpolateBook(block.endMessage) }]
    : [];

  if (block.effects?.length) {
    const { effects, diceEvents } = Effects.resolveActionEffects(block.effects);

    Engine.applyEffects(effects);

    const feedbackEvents = FeedbackResolver.resolveActionEvents(diceEvents, effects);

    History.registerStateEvent({ chapterId, source, events: feedbackEvents, effects });

    // Order: dice → startMessage → effect feedback → endMessage
    events.push(
      ...diceEvents.map(e => ({ ...e })),
      ...startMsg,
      ...feedbackEvents.filter(e => e.type !== "dice"),
      ...endMsg
    );
  } else {
    // No effects — just messages if present
    events.push(...startMsg, ...endMsg);
  }

  return events;
}

// ─── onFirstEnter handler (first visit only) ──────────────────────────────────
function handleOnFirstEnter(chapter, isFirstVisit) {
  if (!isFirstVisit || !chapter.onFirstEnter) return [];
  return resolveAndApplyEffects(chapter.onFirstEnter, chapter.id, "onFirstEnter");
}

// ─── onEnter handler (every visit) ───────────────────────────────────────────
function handleOnEnter(chapter) {
  if (!chapter.onEnter) return [];
  return resolveAndApplyEffects(chapter.onEnter, chapter.id, "onEnter");
}

// ─── Main navigation ──────────────────────────────────────────────────────────
export function goToChapter(chapterId) {
  const bookId = state.currentBookId;
  const story  = getCurrentStory();

  const currentChapterId = getCurrentChapterId();

  // Already on this chapter — re-resolve choices but suppress onShow/onFirstShow
  // (they only trigger on genuine navigation, not re-renders)
  if (chapterId && currentChapterId === chapterId) {
    return ChapterResolver.resolveChapter(getCurrentChapter(), { triggerShowEvents: false });
  }

  // Navigate to new chapter
  const bookState = state.bookState[bookId];
  const visited   = bookState.progress.chaptersVisited || {};

  chapterId = chapterId ?? story.startChapterId;

  const currentCount = visited[chapterId] || 0;
  // ── onFirstEnter: runs only on the first visit ────────────
  const isFirstVisit = currentCount === 0;

  state.persistGameData(bookId, {
    progress: {
      previousChapterId: currentChapterId ?? null,
      currentChapterId: chapterId,
      chaptersVisited: { ...visited, [chapterId]: currentCount + 1 }
    },
    stats: {
      totalChaptersVisited: bookState.stats.totalChaptersVisited + 1
    }
  });

  const chapter = getCurrentChapter();

  const firstEnterEvents = handleOnFirstEnter(chapter, isFirstVisit);
  const enterEvents      = handleOnEnter(chapter);

  // Enqueue all events — fire and forget (caller handles await if needed)
  const allEvents = [...firstEnterEvents, ...enterEvents];
  if (allEvents.length) enqueueEvents(allEvents);

  return ChapterResolver.resolveChapter(chapter, { triggerShowEvents: true });
}

export function getCurrentChapter() {
  let id = getCurrentChapterId() ?? currentStory.startChapterId;
  return { id, ...currentStory.chapters[id] };
}

function getCurrentChapterId() {
  return state.bookState[state.currentBookId].progress.currentChapterId;
}

function getPreviousChapterId() {
  return state.bookState[state.currentBookId]?.progress?.previousChapterId ?? null;
}

export function getCurrentStory() {
  return currentStory;
}

export const Reader = {
  loadStory,
  startStory,
  goToChapter,
  getCurrentChapter,
  getCurrentStory,
  getPreviousChapterId
};
