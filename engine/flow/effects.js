import state from "../core/state.js";
import { Reader } from "../core/reader.js";
import { Expressions } from "./expressions.js";
import { CombatEngine } from "../combat/combatEngine.js";

export function resolveActionEffects(rawEffects = []) {
  const resolvedEffects = [];
  const diceEvents = [];

  const context = {
    variables: state.bookState[state.currentBookId].progress.variables,
    items: state.bookState[state.currentBookId].progress.items,
    turn: state.bookState[state.currentBookId].progress.turn
  };

  rawEffects.forEach(effect => {

    effect = normalize(effect);

    switch (effect.type) {

      case "addVar": {
        // addVar is not valid on boolean variables — use setVar instead
        // Silently skip to avoid arithmetic corruption
        const varDef = state.bookState[state.currentBookId]
          ?.progress?.variables?.[effect.id];
        if (typeof varDef === "boolean") {
          console.warn(`[Gaboma] addVar on boolean variable "${effect.id}" ignored. Use setVar.`);
          break;
        }

        const value = Expressions.evaluate(
          effect.value,
          context,
          { allowDice: true, diceEvents }
        );

        resolvedEffects.push({
          type: "addVar",
          id: effect.id,
          delta: value
        });

        break;
      }

      case "setVar": {
        const current = context.variables?.[effect.id];
        const isBool  = typeof current === "boolean" ||
                        typeof effect.value === "boolean";

        const value = Expressions.evaluate(
          effect.value,
          context,
          { allowDice: true, diceEvents }
        );

        if (isBool) {
          // Boolean setVar: emit a dedicated "setBoolVar" effect
          // so engine.js can assign directly without arithmetic
          resolvedEffects.push({
            type:  "setBoolVar",
            id:    effect.id,
            value: Boolean(value)
          });
        } else {
          resolvedEffects.push({
            type:  "addVar",
            id:    effect.id,
            delta: value - (current ?? 0)
          });
        }

        break;
      }

      case "addItem": {
        const value = Expressions.evaluate(
          effect.value ?? 1,
          context,
          { allowDice: true, diceEvents }
        );

        resolvedEffects.push({
          type: "addItem",
          id: effect.id,
          delta: value
        });
        break;
      }

      case "useItem": {
        const value = Expressions.evaluate(
          effect.value ?? 1,
          context,
          { allowDice: true, diceEvents }
        );

        resolvedEffects.push({
          type: "addItem",
          id: effect.id,
          delta: -value,
          action: "use"
        });
        break;
      }        

      case "dropItem": {
        const value = Expressions.evaluate(
          effect.value ?? 1,
          context,
          { allowDice: true, diceEvents }
        );

        resolvedEffects.push({
          type: "addItem",
          id: effect.id,
          delta: -value,
          action: "drop"
        });
        break;
      }

      case "giveItem": {
        const value = Expressions.evaluate(
          effect.value ?? 1,
          context,
          { allowDice: true, diceEvents }
        );

        resolvedEffects.push({
          type: "addItem",
          id: effect.id,
          delta: -value,
          action: "give"
        });
        break;
      }

      case "lostItem": {
        const value = Expressions.evaluate(
          effect.value ?? 1,
          context,
          { allowDice: true, diceEvents }
        );

        resolvedEffects.push({
          type: "addItem",
          id: effect.id,
          delta: -value,
          action: "lost"
        });
        break;
      }      

      case "rollChance": {
        const chance = Expressions.evaluate(
          effect.value,
          context,
          { allowDice: false }
        );

        const roll = Math.random() * 100;
        const success = roll <= chance;

        resolvedEffects.push({
          type: "rollChance",
          success
        });

        break;
      }

      case "startCombat": {
        // Inject current chapterId transparently — author doesn't need to set it
        const chapterId = Reader.getCurrentChapter()?.id;
        CombatEngine.startCombat({ ...effect, chapterId });
        resolvedEffects.push({ ...effect, chapterId });
        break;
      }

      case "endCombat":
        resolvedEffects.push(effect);
        break;

      case "setVarMax":
      case "addVarMax":
      case "equipItem":
      case "unequipItem":
      case "consumeItem":
      case "buyItem":
        // Pass through — engine.js handles these directly
        resolvedEffects.push({ ...effect });
        break;

      case "showCharacterSheet":
      case "showConsumableSelector":
        // UI effect — passed through so actionResolver can open SheetModal after queue
        resolvedEffects.push({ ...effect });
        break;

      default:
        throw new Error(`Unknown effect type: ${effect.type}`);
    }
  });

  return { effects: resolvedEffects, diceEvents };
}

function normalize(effect) {
  const innerObject = Object.values(effect)[0];
  const id = Object.keys(innerObject)[0];
  const value = innerObject[id];

  if (effect.increment) {
    return {
      ...effect,
      type: "addVar",
      id,
      value
    };
  }

  if (effect.decrement) {
    return {
      ...effect,
      type: "addVar",
      id,
      value: -value
    };
  }

  return effect;
}

export const Effects = {
  resolveActionEffects
};