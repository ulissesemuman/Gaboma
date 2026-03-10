import state from '../core/state.js';
import { Conditions } from './conditions.js';

export function resolveChapter(chapter) {

  if (!chapter?.choices) {
    return {
      ...chapter,
      choices: []
    };
  }

  const bookId = state.currentBookId;
  const bookState = state.bookState[bookId];
  const progress = bookState.progress;

  const context = {
    variables: progress.variables,
    items: progress.items,
    turn: progress.turn,
    chaptersVisited: progress.chaptersVisited
  };  

  const visibleChoices = chapter.choices
    .map(choice => {

      const conditionsMet =
        !choice.conditions ||
        Conditions.evaluate(choice?.conditions, context);


      // Caso normal
      if (conditionsMet) {
        return choice;
      }

      return null;

    })
    .filter(Boolean);

  return {
    ...chapter,
    choices: visibleChoices
  };
}

export const ChapterResolver = {
    resolveChapter
}