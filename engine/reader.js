import state from "./state.js";

let currentStory = null;

export function loadStory(story) {
  currentStory = story;
}

export function startStory() {
  goToChapter(currentStory.start);
  return getCurrentChapter();
}

export function goToChapter(chapterId) {

  const bookState = state.bookState[state.currentBookId];

  if (chapterId !== bookState.progress.currentChapter) {
    bookState.metadata.started = true;


    bookState.progress.history = [];
    bookState.progress.variables = {};
    bookState.progress.items = {};
    bookState.progress.combat = null;
  }  

  bookState.progress.currentChapter = chapterId;
  bookState.progress.turn ++;  
  state.save();

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