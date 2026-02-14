let currentStory = null;
let currentChapterId = null;

export function loadStory(story) {
  currentStory = story;
}

export function startStory() {
  currentChapterId = currentStory.start;
  return getCurrentChapter();
}

export function goToChapter(chapterId) {
  currentChapterId = chapterId;
  return getCurrentChapter();
}

export function getCurrentChapter() {
  return currentStory.chapters[currentChapterId];
}

export function getCurrentChapterId() {
  return currentChapterId;
}

export const Reader = {
  loadStory,
  startStory,
  goToChapter,
  getCurrentChapter,
  getCurrentChapterId
};