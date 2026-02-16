import state from "./state.js";

let currentStory = null;

export function loadStory(story) {
  currentStory = story;
}

export function startStory() {
  return goToChapter(currentStory.start);
}

export function goToChapter(chapterId) {

  const bookId = state.currentBookId;
  const bookState = state.bookState[bookId];

  const previousChapter = bookState.progress.currentChapter;

  state.persistGameData(bookId, {
    progress: {
      currentChapter: chapterId,
      turn: state.bookState[bookId].progress.turn + 1,
      history: [...(bookState.progress.history ?? []), previousChapter]
    }
  });

  return getCurrentChapter();
}

export function getCurrentChapter() {
  const currentChapterId = state.bookState[state.currentBookId].progress.currentChapter;
  
  return currentStory.chapters[currentChapterId];
}

export function getCurrentChapterId() {
  return state.bookState[state.currentBookId].progress.currentChapter;
}

export const Reader = {
  loadStory,
  startStory,
  goToChapter,
  getCurrentChapter,
  getCurrentChapterId
};