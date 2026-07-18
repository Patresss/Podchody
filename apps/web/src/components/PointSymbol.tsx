import { Armchair, Baby, Building2, CircleDot, DoorOpen, Flag, Leaf, Lightbulb, MapPin, TreePine, type LucideIcon } from "lucide-react";
import type { PointSymbol } from "../types";

export const POINT_SYMBOLS: Array<{ value: PointSymbol; label: string; Icon: LucideIcon }> = [
  { value: "pin", label: "Inne miejsce", Icon: MapPin },
  { value: "tree", label: "Drzewo", Icon: TreePine },
  { value: "bench", label: "Ławka", Icon: Armchair },
  { value: "playground", label: "Plac zabaw", Icon: Baby },
  { value: "building", label: "Budynek", Icon: Building2 },
  { value: "ball", label: "Boisko", Icon: CircleDot },
  { value: "entrance", label: "Wejście", Icon: DoorOpen },
  { value: "lamp", label: "Latarnia", Icon: Lightbulb },
  { value: "nature", label: "Krzew lub trawa", Icon: Leaf },
  { value: "flag", label: "Ważny punkt", Icon: Flag },
];

export function PointSymbolIcon({ symbol, size = 16 }: { symbol: PointSymbol | null; size?: number }) {
  const Icon = POINT_SYMBOLS.find((item) => item.value === symbol)?.Icon ?? MapPin;
  return <Icon size={size} aria-hidden="true" />;
}
