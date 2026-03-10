import { t } from "../i18n.js";

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

export const FetchUtils = {
  fetchJSON,
  fetchJSONOptional
};