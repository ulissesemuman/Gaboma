export function resolveChapter(chapterId, story, state) {
  const chapter = story.chapters[chapterId];

  const visibleChoices = chapter.choices.filter(choice =>
    evaluateConditions(choice.conditions, state)
  );

  return {
    ...chapter,
    choices: visibleChoices
  };
}

export function evaluateConditions(conditions, state) {
  if (!conditions) return true;

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

export async function restartBook(bookId) {
  const manifest = await loadBookManifest(bookId);
  const gameData = await loadGameData(bookId);

  state.ensureBookState(bookId);

  state.bookState[bookId].currentChapter = manifest.start;
  state.bookState[bookId].inventory = structuredClone(gameData.initialInventory || {});
  state.bookState[bookId].variables = structuredClone(gameData.initialVariables || {});
  state.bookState[bookId].flags = {};

  state.save();
}

export function checkFatalVariables(bookState, gameData) {
  const vars = bookState.variables;

  for (const [name, config] of Object.entries(gameData.variables)) {
    if (config.fatalAtZero && vars[name] <= 0) {
      return true;
    }
  }

  return false;
}

export function rollDice({ count, sides }) {
  let total = 0;

  for (let i = 0; i < count; i++) {
    total += Math.floor(Math.random() * sides) + 1;
  }

  return total;
}

export function evaluateEffects({ count, sides }) {
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

