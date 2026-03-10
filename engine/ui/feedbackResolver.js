import { Reader } from '../core/reader.js';
import { t, tb } from '../i18n.js';

export function resolveActionEvents(diceEvents = [], effects = []) {
  const events = [...diceEvents];
  const story = Reader.getCurrentStory();

  effects.forEach(effect => {

    switch (effect.type) {

      case "addVar": {
        const varConfig =
          story.variables?.[effect.id];

        // só exibe se permitido
        if (varConfig?.showInSheet !== false &&
            effect.delta !== 0) {

          events.push({
            type: "message",
            text: resolveVarDeltaText(effect)
          });
        }
        break;
      }

      case "addItem": {
        if (effect.delta !== 0) {
          events.push({
            type: "message",
            text: resolveItemDeltaText(effect)
          });
        }
        break;
      }

      case "rollChance": {
        events.push({
          type: "message",
          text: effect.success
            ? tb("game.rollChanceSuccess")
            : tb("game.rollChanceFail")
        });
        break;
      }

      case "startCombat": {
        events.push({
          type: "animation",
          id: "enter_combat"
        });
        break;
      }

      case "endCombat": {
        events.push({
          type: "animation",
          id: "exit_combat"
        });
        break;
      }
    }
  });

  return events;
}

export function resolveVarDeltaText(effect) {
  const story = Reader.getCurrentStory();  
  const varConfig = story.variables?.[effect.id];

  const varLabel = resolveLabel(
    varConfig?.label,
    effect.id
  );

  const sign = effect.delta > 0 ? "+" : "";

  const params = {
    var: varLabel,
    sign,
    value: effect.delta
  };

  const key = "game.varDelta";

  const template = resolveLabel(
    key,
    "{var} {sign}{value}"
  );  

  return template.replace(
    /\{(var|sign|value)\}/g,
    (_, k) => params[k] ?? ""
  );
}

export function resolveItemDeltaText(effect) {
  const story = Reader.getCurrentStory();
  const itemConfig = story.items?.[effect.id];

  const itemLabel = resolveLabel(
    itemConfig?.label,
    effect.id
  );

  const delta = effect.delta ?? 0;
  const absValue = Math.abs(delta);

  const params = {
    item: itemLabel,
    value: absValue
  };

  let key;
  let fallback;

  if (delta > 0) {
    key = "game.itemGain";
    fallback = "Você recebeu {value} {item}.";
  } else if (delta < 0) {
    switch (effect.action) {

      case "use":
        key = "game.itemUse";
        fallback = "Você usou {value} {item}.";
        break;

        case "drop":
        key = "game.itemDrop";
        fallback = "Você descartou {value} {item}.";
        break;

        case "give":
        key = "game.itemGive";
        fallback = "Você deu {value} {item}.";
        break;

        case "lost":
        key = "game.itemLost";
        fallback = "Você perdeu {value} {item}.";
        break;
    }
  } else {
    return ""; // não exibe nada se delta 0
  }

  const template = resolveLabel(
    key,
    fallback
  );

  return template.replace(
    /\{(item|value)\}/g,
    (_, k) => params[k] ?? ""
  );
}

function resolveLabel(key, fallback) {
  if (!key) return fallback;

  const book = tb(key);
  if (book !== key) return book;

  const engine = t(key);
  if (engine !== key) return engine;

  return fallback;
}

export const FeedbackResolver = {
  resolveActionEvents
};