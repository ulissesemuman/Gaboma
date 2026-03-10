export function interpolateVariables(text, extraContext = {}) {
  const bookId = state.currentBookId;
  const variables = state.bookState[bookId].progress.variables;

  return text.replace(/\{([^}]+)\}/g, (_, key) => {
    if (extraContext[key] !== undefined) {
      return extraContext[key];
    }

    if (variables?.[key] !== undefined) {
      return variables[key];
    }

    return `{${key}}`; // mantém caso não exista
  });
}

export const TextManager = {
  interpolateVariables
};