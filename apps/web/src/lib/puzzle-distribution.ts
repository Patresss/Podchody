import type { PuzzleType } from "../types";

export function distributePuzzleTypes(selected: PuzzleType[], cardCount: number, random: () => number = Math.random) {
  if (!selected.length || cardCount <= 0) return [];
  const result = Array.from({ length: cardCount }, (_, index) => selected[index % selected.length]!);
  for (let index = result.length - 1; index > 0; index -= 1) {
    const target = Math.floor(random() * (index + 1));
    [result[index], result[target]] = [result[target]!, result[index]!];
  }
  return result;
}
