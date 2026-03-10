export function roll({ count, sides }) {
  const results = []; // Criamos um array para guardar cada dado

  for (let i = 0; i < count; i++) {
    // Adicionamos o valor individual ao array
    results.push(Math.floor(Math.random() * sides) + 1);
  }

  return results; // Retornamos o ARRAY de resultados
}

export const dice = {
  roll
};