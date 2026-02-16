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

function deepMergeDefined(target, source) {
  if (!source) return;

  Object.entries(source).forEach(([key, value]) => {
    if (value === undefined) return;

    if (
      typeof value === "object" &&
      value !== null &&
      !Array.isArray(value)
    ) {
      if (!target[key]) {
        target[key] = {};
      }

      deepMergeDefined(target[key], value);
    } else {
      target[key] = value;
    }
  });
}

export const Utils = {
  fetchJSON,
  fetchJSONOptional,
  deepMergeDefined
};