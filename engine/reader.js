import state from "./state.js";
import { BookManager } from "./bookManager.js";
import { Engine } from "./engine.js";

let currentStory = null;

export function loadStory(story) {
  currentStory = story;
}

export function startStory() {
  return goToChapter(currentStory.start);
}

export function goToChapter(chapterId) {

  const bookId = state.currentBookId;

  const book = BookManager.getCurrentBook();
  const story = book.story;

  const currentChapterId = getcurrentChapterId();
  const chapter = getcurrentChapter();
  let resolved =  {
      ...chapter,
      choices: []
    };
  
  if (!chapterId || currentChapterId !== chapterId) {
    const bookState = state.bookState[bookId];
    const visited = bookState.progress.chaptersVisited || {};
    
    chapterId = chapterId ?? story.startChapterId;
    const currentCount = visited[chapterId] || 0;

    state.persistGameData(bookId, {
      progress: {
        currentChapterId: chapterId,
        chaptersVisited: {
          ...visited,
          [chapterId]: currentCount + 1
        }
      },
      stats: {
        totalChaptersVisited: bookState.stats.totalChaptersVisited + 1
      }
    });

    if (chapter.onEnter && chapter.onEnter?.effects) {
      const { effects, diceEvents } =
        Engine.resolveActionEffects(chapter.onEnter);

      const events =
        Engine.resolveActionEvents(diceEvents, effects);

      Engine.applyEffects(effects);

      Engine.registerTurn({
        chapterId: chapter.id,
        source: "onEnter",
        events,
        effects
      });
    };

    resolved = Engine.resolveChapter(chapter);
  }

  return resolved;
}

export function getcurrentChapter() {
  let currentChapterId = state.bookState[state.currentBookId].progress.currentChapterId;
  currentChapterId = currentChapterId ?? currentStory.startChapterId;

  const chapter = {
    id: currentChapterId,
    ...currentStory.chapters[currentChapterId]
  };  
  
  return chapter;
}

export function getcurrentChapterId() {
  return state.bookState[state.currentBookId].progress.currentChapterId;
}

export function getCurrentStory() {
  return currentStory;
}

export const Reader = {
  loadStory,
  startStory,
  goToChapter,
  getcurrentChapter,
  getcurrentChapterId,
  getCurrentStory
};