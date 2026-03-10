import { FetchUtils } from "../utils/fetchUtils.js";

export async function loadBookStory(bookId) {
  if (!bookId) {
    throw new Error(t("error.invalidBook"));
  }

  const basePath = `books/${bookId}/story`;

  const story = await FetchUtils.fetchJSON(`${basePath}/story.json`);

  const variables = await FetchUtils.fetchJSONOptional(`${basePath}/variables.json`);
  const items = await FetchUtils.fetchJSONOptional(`${basePath}/items.json`);
  const enemies = await FetchUtils.fetchJSONOptional(`${basePath}/enemies.json`);
  const highlights = await FetchUtils.fetchJSONOptional(`${basePath}/highlights.json`);  

  return {
    ...story,
    variables: variables ?? {},
    items: items ?? {},
    enemies: enemies ?? {},
    highlights: highlights ?? {}
  };
}

export const StoryAssembler = {
    loadBookStory
}