import { Reader } from "./reader.js";
import state from "./state.js";

export function choose(choiceId) {
/*  const book = BookManager.getCurrentBook();

  if (!book?.story) {
    console.error("Livro sem story carregada.");
    return;
  }

  const choice = book.story.chapters[state.bookState[state.currentBookId].progress.currentChapter].choices[choiceId];

  if (!choice) {
    throw new Error(t("error.invalidChoice", { choiceId }));
  }

  evaluateEffects(1, 6);*/

  const isValid = false;

  const book = BookManager.getCurrentBook();
  const bookid = state.currentBookId;
  const bookState = state.bookState[bookid];
  const story = book.story;
  const currentChapter = bookState.progress.currentChapter;
  const chapter = story.chapters[currentChapter];
  const choice = chapter.choices[choiceId];


  const visibleChoices = choice.choices.filter(choice =>
    isValid = evaluateConditions(choice.conditions)
  );

  const nextChapter = null;

  if (isValid) {
    nextChapter = Reader.goToChapter(choiceId);
  }

  return nextChapter;
}

export function resolveChapter(chapter) {

  if (!chapter?.choices) {
    return {
      ...chapter,
      choices: []
    };
  }

  const visibleChoices = chapter.choices
    .map(choice => {

      const conditionsMet =
        !choice.conditions ||
        evaluateConditions(choice.conditions);

      // Caso normal
      if (conditionsMet) {
        return choice;
      }

      // Caso repeatable
      if (choice.repeatable) {
        return {
          ...choice,
          next: state.bookState[state.currentBookId].progress.currentChapter
        };
      }

      return null;

    })
    .filter(Boolean);

  return {
    ...chapter,
    choices: visibleChoices
  };
}

export function evaluateEffects(effects, { count, sides }) {
  if (effect.type === "rollDice") {
    const result = rollDice({
      count: effect.count ?? manifest.dice.count,
      sides: effect.sides ?? manifest.dice.sides
    });

    

    if (effect.storeIn) {
      state.variables[effect.storeIn] = result;
    }
  }
}

export function evaluateConditions(conditions) {
  if (!conditions) return true;

  const inventory = state.bookState[state.currentBookId].progess.items;

  if (conditions.hasItem) {
    return state.inventory?.[conditions.hasItem] > 0;
  }

  if (conditions.hasNotItem) {
    return !state.inventory?.[conditions.hasNotItem];
  }

  if (conditions.variableEquals) {
    const { name, value } = conditions.variableEquals;
    return state.variables?.[name] === value;
  }

  if (conditions.all) {
    return conditions.all.every(cond =>
      evaluateConditions(cond, state)
    );
  }

  if (conditions.any) {
    return conditions.any.some(cond =>
      evaluateConditions(cond, state)
    );
  }

  if (conditions.dice) {
    const {
      count,
      sides,
      storeIn,
      min,
      max
    } = conditions.dice;

    const result = rollDice({
      count: count ?? manifest.dice.count,
      sides: sides ?? manifest.dice.sides,
      storeIn,
      bookState: state.bookState[currentBookId]
    });

    if (min !== undefined && result < min) return false;
    if (max !== undefined && result > max) return false;

    return true;
  }
}

export const Engine = {
  resolveChapter
};