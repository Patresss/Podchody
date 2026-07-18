import { Crosshair, MapPin, RotateCcw, Tag, Trash2, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { versionedPhotoUrl } from "../lib/photo-url";
import type { Point, PointSymbol } from "../types";
import { POINT_SYMBOLS } from "./PointSymbol";

type PointInspectorProps = {
  point: Point;
  onSave: (body: Partial<Pick<Point, "latitude" | "longitude" | "markerX" | "markerY" | "displayName" | "symbol">>) => Promise<void>;
  onDelete: () => Promise<void>;
  onPlaceOnMap?: () => void;
};

export function PointInspector({ point, onSave, onDelete, onPlaceOnMap }: PointInspectorProps) {
  const [latitude, setLatitude] = useState(point.latitude?.toFixed(7) ?? "");
  const [longitude, setLongitude] = useState(point.longitude?.toFixed(7) ?? "");
  const [displayName, setDisplayName] = useState(point.displayName ?? "");
  const [symbol, setSymbol] = useState<PointSymbol | null>(point.symbol);
  const [saving, setSaving] = useState(false);
  const [detailsSaving, setDetailsSaving] = useState(false);
  const photoRef = useRef<HTMLDivElement>(null);
  const imageRef = useRef<HTMLImageElement>(null);
  const [photoLayout, setPhotoLayout] = useState({ left: 0, top: 0, width: 0, height: 0 });

  useEffect(() => {
    setLatitude(point.latitude?.toFixed(7) ?? "");
    setLongitude(point.longitude?.toFixed(7) ?? "");
    setDisplayName(point.displayName ?? "");
    setSymbol(point.symbol);
  }, [point.id, point.latitude, point.longitude, point.displayName, point.symbol]);

  useEffect(() => {
    const container = photoRef.current;
    const image = imageRef.current;
    if (!container || !image) return;
    const updateLayout = () => {
      if (!image.naturalWidth || !image.naturalHeight) return;
      const scale = Math.min(container.clientWidth / image.naturalWidth, container.clientHeight / image.naturalHeight);
      const width = image.naturalWidth * scale;
      const height = image.naturalHeight * scale;
      setPhotoLayout({ left: (container.clientWidth - width) / 2, top: (container.clientHeight - height) / 2, width, height });
    };
    updateLayout();
    const observer = new ResizeObserver(updateLayout);
    observer.observe(container);
    return () => observer.disconnect();
  }, [point.id]);

  const saveCoordinates = async () => {
    const parsedLatitude = latitude.trim() ? Number(latitude.replace(",", ".")) : null;
    const parsedLongitude = longitude.trim() ? Number(longitude.replace(",", ".")) : null;
    setSaving(true);
    try {
      await onSave({ latitude: parsedLatitude, longitude: parsedLongitude });
    } finally {
      setSaving(false);
    }
  };

  const setMarker = (event: React.MouseEvent<HTMLDivElement>) => {
    const rect = event.currentTarget.getBoundingClientRect();
    const x = event.clientX - rect.left - photoLayout.left;
    const y = event.clientY - rect.top - photoLayout.top;
    if (x < 0 || y < 0 || x > photoLayout.width || y > photoLayout.height) return;
    void onSave({
      markerX: Math.max(0, Math.min(1, x / photoLayout.width)),
      markerY: Math.max(0, Math.min(1, y / photoLayout.height)),
    });
  };

  return (
    <div className="inspector-content">
      <div ref={photoRef} className="inspector-photo" onClick={setMarker} role="button" aria-label="Kliknij zdjęcie, aby wskazać dokładne miejsce schowania">
        <img ref={imageRef} src={versionedPhotoUrl(point.previewUrl, point.createdAt)} alt={point.originalFilename} onLoad={() => {
          const container = photoRef.current;
          const image = imageRef.current;
          if (!container || !image || !image.naturalWidth || !image.naturalHeight) return;
          const scale = Math.min(container.clientWidth / image.naturalWidth, container.clientHeight / image.naturalHeight);
          const width = image.naturalWidth * scale;
          const height = image.naturalHeight * scale;
          setPhotoLayout({ left: (container.clientWidth - width) / 2, top: (container.clientHeight - height) / 2, width, height });
        }} />
        {point.markerX != null && point.markerY != null && (
          <span className="hide-target" style={{ left: photoLayout.left + point.markerX * photoLayout.width, top: photoLayout.top + point.markerY * photoLayout.height }}><Crosshair /></span>
        )}
        <div className="photo-hint"><Crosshair size={15} /> Kliknij, aby wskazać schowek</div>
      </div>
      {point.markerX != null && (
        <button className="text-button" type="button" onClick={() => onSave({ markerX: null, markerY: null })}>Usuń oznaczenie schowka</button>
      )}

      <div className="inspector-meta">
        <div><span>Plik</span><strong>{point.originalFilename}</strong></div>
        <div><span>Wykonano</span><strong>{point.capturedAt ? new Intl.DateTimeFormat("pl-PL", { dateStyle: "medium", timeStyle: "short" }).format(new Date(point.capturedAt)) : "Brak danych"}</strong></div>
      </div>

      <section className="organizer-point-editor">
        <div className="section-heading compact"><div><span className="eyebrow"><Tag size={14} /> Dla organizatora</span><h3>Nazwa i symbol miejsca</h3></div></div>
        <label><span>Przyjazna nazwa <em>opcjonalnie</em></span><input value={displayName} maxLength={40} onChange={(event) => setDisplayName(event.target.value)} placeholder="Np. ławka przy zjeżdżalni" /></label>
        <div className="point-symbol-options" role="group" aria-label="Symbol miejsca">
          <button type="button" className={symbol == null ? "is-active" : ""} aria-pressed={symbol == null} onClick={() => setSymbol(null)} title="Bez symbolu"><X size={17} /><span>Bez</span></button>
          {POINT_SYMBOLS.map(({ value, label, Icon }) => <button type="button" key={value} className={symbol === value ? "is-active" : ""} aria-pressed={symbol === value} onClick={() => setSymbol(value)} title={label}><Icon size={18} /><span>{label}</span></button>)}
        </div>
        <button className="button button-secondary" type="button" disabled={detailsSaving} onClick={async () => {
          setDetailsSaving(true);
          try { await onSave({ displayName: displayName.trim() || null, symbol }); }
          finally { setDetailsSaving(false); }
        }}>{detailsSaving ? "Zapisuję…" : "Zapisz nazwę i symbol"}</button>
      </section>

      <section className="coordinate-editor">
        <div className="section-heading compact"><div><span className="eyebrow"><MapPin size={14} /> Pozycja</span><h3>Współrzędne punktu</h3></div></div>
        <div className="field-row">
          <label><span>Szerokość</span><input inputMode="decimal" value={latitude} onChange={(event) => setLatitude(event.target.value)} placeholder="50.0000000" /></label>
          <label><span>Długość</span><input inputMode="decimal" value={longitude} onChange={(event) => setLongitude(event.target.value)} placeholder="19.0000000" /></label>
        </div>
        <div className="button-row">
          <button className="button button-primary" type="button" disabled={saving} onClick={saveCoordinates}>{saving ? "Zapisuję…" : "Zapisz pozycję"}</button>
          {point.latitude == null && onPlaceOnMap && <button className="button button-secondary" type="button" onClick={onPlaceOnMap}><MapPin size={16} /> Wskaż na mapie</button>}
          {point.exifLatitude != null && point.exifLongitude != null && (
            <button className="button button-secondary" type="button" onClick={() => onSave({ latitude: point.exifLatitude, longitude: point.exifLongitude })}><RotateCcw size={16} /> Przywróć EXIF</button>
          )}
        </div>
      </section>

      <div className="danger-row">
        <button className="button button-danger-ghost" type="button" onClick={() => window.confirm("Usunąć to zdjęcie z projektu?") && onDelete()}><Trash2 size={16} /> Usuń zdjęcie</button>
      </div>
    </div>
  );
}
