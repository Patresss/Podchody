import { Check, MapPinOff, Star } from "lucide-react";
import { versionedPhotoUrl } from "../lib/photo-url";
import type { Point } from "../types";
import { PointSymbolIcon } from "./PointSymbol";

export function PhotoGallery({
  points,
  selectedIds,
  coverPointId,
  settingCoverId,
  onToggle,
  onOpen,
  onSetCover,
}: {
  points: Point[];
  selectedIds: Set<string>;
  coverPointId: string | null;
  settingCoverId: string | null;
  onToggle: (id: string, range: boolean) => void;
  onOpen: (point: Point) => void;
  onSetCover: (point: Point) => void;
}) {
  return (
    <div className="photo-grid">
      {points.map((point) => {
        const selected = selectedIds.has(point.id);
        const isCover = coverPointId === point.id;
        return (
          <article className={`photo-card${selected ? " is-selected" : ""}${isCover ? " is-cover" : ""}`} key={point.id}>
            <button type="button" className="photo-open" onClick={(event) => {
              if (event.shiftKey) onToggle(point.id, true);
              else onOpen(point);
            }} aria-label={`Edytuj ${point.originalFilename}. Shift i kliknięcie zaznacza zakres.`}>
              <img src={versionedPhotoUrl(point.previewUrl, point.createdAt)} alt="" />
              {point.latitude == null && <span className="no-location"><MapPinOff size={15} /> Brak GPS</span>}
              {point.markerX != null && point.markerY != null && <span className="mini-target" style={{ left: `${point.markerX * 100}%`, top: `${point.markerY * 100}%` }} />}
            </button>
            <button
              type="button"
              className="photo-cover-action"
              aria-pressed={isCover}
              aria-label={isCover ? "Zdjęcie główne projektu" : `Ustaw ${point.displayName || point.originalFilename} jako zdjęcie główne projektu`}
              title={isCover ? "Zdjęcie główne projektu" : "Ustaw jako zdjęcie główne"}
              disabled={settingCoverId != null}
              onClick={() => onSetCover(point)}
            >
              <Star size={14} fill={isCover ? "currentColor" : "none"} />
              {isCover && <span>Główne</span>}
            </button>
            <div className="photo-card-footer">
              <button type="button" className="photo-select" aria-pressed={selected} title="Shift + kliknięcie zaznacza zakres" onClick={(event) => onToggle(point.id, event.shiftKey)}>
                <span className="check-box">{selected && <Check size={14} />}</span>
                {point.symbol && <span className="photo-symbol"><PointSymbolIcon symbol={point.symbol} size={14} /></span>}
                <span>{point.displayName || point.originalFilename}</span>
              </button>
            </div>
          </article>
        );
      })}
    </div>
  );
}
