import state from "../core/state.js";
import { Expressions} from "./expressions.js";

export function resolveActionEffects(rawEffects = []) {
  const resolvedEffects = [];
  const diceEvents = [];

  const context = {
    variables: state.bookState[state.currentBookId].progress.variables,
    items: state.bookState[state.currentBookId].progress.items,
    turn: state.bookState[state.currentBookId].progress.turn
  };

  rawEffects.forEach(effect => {

    switch (effect.type) {

      case "addVar": {
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
        const current = context.variables?.[effect.id] ?? 0;

        const value = Expressions.evaluate(
          effect.value,
          context,
          { allowDice: true, diceEvents }
        );

        resolvedEffects.push({
          type: "addVar",
          id: effect.id,
          delta: value - current
        });

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

      case "startCombat":
      case "endCombat":
        resolvedEffects.push(effect);
        break;

      default:
        throw new Error(`Unknown effect type: ${effect.type}`);
    }
  });

  return { effects: resolvedEffects, diceEvents };
}

export const Effects = {
  resolveActionEffects
};