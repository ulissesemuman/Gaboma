import state from "./state.js";
import { Reader } from "./reader.js";

export function applyEffects(effects = []) {
  const bookId = state.currentBookId;
  if (!bookId) {
    throw new Error("No current book selected");
  }

  const bookState = state.bookState[bookId];
  const story = Reader.getCurrentStory();

  effects.forEach(effect => {

    switch (effect.type) {

      case "addVar": {
        const current =
          bookState.progress.variables[effect.id] ?? 0;

        bookState.progress.variables[effect.id] =
          current + effect.delta;
        break;
      }

      case "addItem": {
        const current =
          bookState.progress.items[effect.id] ?? 0;

        bookState.progress.items[effect.id] =
          current + effect.delta;
        break;
      }

      case "startCombat":
        bookState.progress.combat = effect.data;
        break;

      case "endCombat":
        bookState.progress.combat = null;
        break;

      case "rollChance":
        // não altera estado
        break;

      default:
        throw new Error(`Unknown effect: ${effect.type}`);
    }
  });

  checkFatalVariables(bookState, story);

  state.save();
}

function checkFatalVariables(bookState, story) {
  const variables = story.variables;

  if (!variables) return;

  for (const [id, config] of Object.entries(variables)) {

    if (config.fatalAtZero) {
      const value =
        bookState.progress.variables[id] ?? 0;

      if (value <= 0) {
        bookState.progress.gameOver = true;
      }
    }
  }
}

export const Engine = {
  applyEffects
}   