import type { PuzzleType } from "../types";

export const PUZZLE_OPTIONS: ReadonlyArray<{ value: PuzzleType; label: string; description: string }> = [
  { value: "counting", label: "Policz kropki", description: "Obrazkowe, bez czytania" },
  { value: "patterns", label: "Dokończ wzór", description: "Narysuj kolejny kształt" },
  { value: "matching", label: "Połącz pary", description: "Połącz takie same kształty" },
  { value: "word-copy", label: "Przepisz słowo", description: "Obrazek, wzór słowa i pola" },
  { value: "missing-letter", label: "Wstaw literę", description: "Obrazek i słowo z luką" },
  { value: "math-10", label: "Dodawanie i odejmowanie do 10", description: "Łatwiejsza matematyka" },
  { value: "math-20", label: "Dodawanie i odejmowanie do 20", description: "Trudniejsza matematyka" },
];

export function puzzleSelectionLabel(values: PuzzleType[]) {
  if (!values.length) return "Bez zagadek";
  if (values.length === 1) return PUZZLE_OPTIONS.find((option) => option.value === values[0])?.label ?? "1 rodzaj";
  return values.length < 5 ? `${values.length} rodzaje zagadek` : `${values.length} rodzajów zagadek`;
}
