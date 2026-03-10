import { t } from "../i18n.js";

export function mergeStrict(target, source, path = "") {
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

export function mergeDynamic(target, source) {
  Object.entries(source).forEach(([key, value]) => {
    target[key] = value;
  });
}

export const ObjectUtils = {
  mergeStrict,
  mergeDynamic
};