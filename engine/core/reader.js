import state from "./state.js";
import { Engine } from "./engine.js";
import { Effects } from "../flow/effects.js";
import { ChapterResolver } from "../flow/chapterResolver.js";
import { FeedbackResolver } from "../ui/feedbackResolver.js";
import { History } from "../flow/history.js";

let currentStory = null;

export function loadStory(story) {
  currentStory = story;
}

export function startStory() {
  return goToChapter(currentStory.start);
}

export function goToChapter(chapterId) {

  const bookId = state.currentBookId;
  const story = getCurrentStory();

  const currentChapterId = getCurrentChapterId();
  let chapter = getCurrentChapter();
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

    chapter = getCurrentChapter();    

    if (chapter.onEnter && chapter.onEnter?.effects) {
      const { effects, diceEvents } =
        Effects.resolveActionEffects(chapter.onEnter.effects);

      Engine.applyEffects(effects);

      const events =
        FeedbackResolver.resolveActionEvents(diceEvents, effects);

      History.registerStateEvent({
        chapterId: chapter.id,
        source: "onEnter",
        events,
        effects
      });
    };
  }

  resolved = ChapterResolver.resolveChapter(chapter);

  return resolved;
}

export function getCurrentChapter() {
  let currentChapterId = getCurrentChapterId();
  currentChapterId = currentChapterId ?? currentStory.startChapterId;

  const chapter = {
    id: currentChapterId,
    ...currentStory.chapters[currentChapterId]
  };  
  
  return chapter;
}

function getCurrentChapterId() {
  return state.bookState[state.currentBookId].progress.currentChapterId;
}

export function getCurrentStory() {
  return currentStory;
}

export const Reader = {
  loadStory,
  startStory,
  goToChapter,
  getCurrentChapter,
  getCurrentStory
};