import { Calculator, Check, CircleDotDashed, Pencil, Shapes, Type, Waypoints } from "lucide-react";
import { PUZZLE_OPTIONS } from "../lib/puzzles";
import type { PuzzleType } from "../types";

type PuzzleTypePickerProps = {
  selected: PuzzleType[];
  onChange: (selected: PuzzleType[]) => void;
};

function PuzzleIcon({ type }: { type: PuzzleType }) {
  if (type === "counting") return <CircleDotDashed size={18} />;
  if (type === "patterns") return <Shapes size={18} />;
  if (type === "matching") return <Waypoints size={18} />;
  if (type === "word-copy") return <Type size={18} />;
  if (type === "missing-letter") return <Pencil size={18} />;
  return <Calculator size={18} />;
}

export function PuzzleTypePicker({ selected, onChange }: PuzzleTypePickerProps) {
  const toggle = (type: PuzzleType) => {
    const next = new Set(selected);
    if (next.has(type)) next.delete(type);
    else next.add(type);
    onChange(PUZZLE_OPTIONS.filter((option) => next.has(option.value)).map((option) => option.value));
  };

  return (
    <div className="puzzle-type-options" role="group" aria-label="Rodzaje zagadek">
      {PUZZLE_OPTIONS.map((option) => {
        const active = selected.includes(option.value);
        return (
          <button key={option.value} type="button" className={active ? "is-active" : ""} aria-pressed={active} onClick={() => toggle(option.value)}>
            <PuzzleIcon type={option.value} />
            <span><strong>{option.label}</strong><small>{option.description}</small></span>
            <Check className="puzzle-option-check" size={17} aria-hidden="true" />
          </button>
        );
      })}
    </div>
  );
}
