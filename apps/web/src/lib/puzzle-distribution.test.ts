import { describe, expect, it } from "vitest";
import type { PuzzleType } from "../types";
import { distributePuzzleTypes } from "./puzzle-distribution";

function counts(values: PuzzleType[]) {
  return values.reduce<Record<string, number>>((result, value) => {
    result[value] = (result[value] ?? 0) + 1;
    return result;
  }, {});
}

describe("distributePuzzleTypes", () => {
  it("dzieli parzystą liczbę kart po równo", () => {
    const result = distributePuzzleTypes(["math-10", "matching"], 10, () => 0.37);
    expect(counts(result)).toEqual({ "math-10": 5, matching: 5 });
  });

  it("przy nieparzystej liczbie różni typy najwyżej o jedną kartę", () => {
    const result = distributePuzzleTypes(["counting", "patterns", "word-copy"], 11, () => 0.61);
    const values = Object.values(counts(result));
    expect(result).toHaveLength(11);
    expect(Math.max(...values) - Math.min(...values)).toBeLessThanOrEqual(1);
  });

  it("zwraca pustą listę, gdy zagadki są wyłączone", () => {
    expect(distributePuzzleTypes([], 8)).toEqual([]);
  });
});
