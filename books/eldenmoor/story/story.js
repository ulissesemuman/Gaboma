export function onEnterChapter(chapterId, state) {}

export function onLeaveChapter(chapterId, state) {}

export function onChoiceSelected(choiceId, state) {}

export function onChapterFirstVisit(chapterId, state) {}

export function onChapterRevisit(chapterId, state) {}

export function onGameStart(state) {}

export function onGameLoad(state) {}

export function onVariableChange(name, oldValue, newValue, state) {}

export function onItemAdded(itemId, quantity, state) {}

export function onItemRemoved(itemId, quantity, state) {}  

export const storyEvents = {
  onEnterChapter(chapterId, state) {},
  onLeaveChapter(chapterId, state) {},

  onChoiceSelected(choiceId, state) {},

  onChapterFirstVisit(chapterId, state) {},
  onChapterRevisit(chapterId, state) {},

  onGameStart(state) {},
  onGameLoad(state) {},

  onVariableChange(name, oldValue, newValue, state) {},
  onItemAdded(itemId, quantity, state) {},
  onItemRemoved(itemId, quantity, state) {}
};