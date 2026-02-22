import { t } from "./i18n.js";

async function fetchJSON(path) {
  const res = await fetch(path);
  if (!res.ok) {
    throw new Error(t("error.failedToLoad", { path }));
  }
  return res.json();
}

export async function fetchJSONOptional(path) {
  const res = await fetch(path);

  if (res.status === 404) {
    return null;
  }

  if (!res.ok) {
    throw new Error(t("error.failedToLoad", { path }));
  }

  return res.json();
}

function mergeStrict(target, source, path = "") {
  for (const key of Object.keys(source)) {
    if (!(key in target)) {
      throw new Error(
        `Propriedade inválida em bookState: ${path}${key}`
      );
    }

    if (
      typeof source[key] === "object" &&
      source[key] !== null &&
      !Array.isArray(source[key])
    ) {
      mergeStrict(target[key], source[key], `${path}${key}.`);
    } else {
      target[key] = source[key];
    }
  }
}

function mergeDynamic(target, source) {
  Object.entries(source).forEach(([key, value]) => {
    target[key] = value;
  });
}

export const Utils = {
  fetchJSON,
  fetchJSONOptional,
  mergeStrict,
  mergeDynamic
};