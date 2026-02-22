export function rollDice({ count, sides }) {
  let total = 0;

  for (let i = 0; i < count; i++) {
    total += Math.floor(Math.random() * sides) + 1;
  }

  return total;
}

export const DiceRoller = {
  rollDice
};