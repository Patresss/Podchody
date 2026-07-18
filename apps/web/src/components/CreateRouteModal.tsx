import { Brain, CheckSquare, Footprints, Gauge, Minus, Plus, Sparkles } from "lucide-react";
import { useState } from "react";
import type { PuzzleType, RouteDistanceMode } from "../types";
import { Modal } from "./Modal";
import { PuzzleTypePicker } from "./PuzzleTypePicker";

export type RouteCreationChoice =
  | { mode: "automatic"; count: number; distanceMode: RouteDistanceMode; puzzleTypes: PuzzleType[] }
  | { mode: "manual"; distanceMode: RouteDistanceMode; puzzleTypes: PuzzleType[] };

type CreateRouteModalProps = {
  availableCount: number;
  selectedCount: number;
  manualAvailable: boolean;
  onClose: () => void;
  onCreate: (name: string, choice: RouteCreationChoice) => Promise<void>;
};

export function CreateRouteModal({ availableCount, selectedCount, manualAvailable, onClose, onCreate }: CreateRouteModalProps) {
  const [mode, setMode] = useState<"automatic" | "manual">(selectedCount >= 2 && manualAvailable ? "manual" : "automatic");
  const [count, setCount] = useState(Math.min(10, availableCount));
  const [distanceMode, setDistanceMode] = useState<RouteDistanceMode>("maximum");
  const [puzzlesEnabled, setPuzzlesEnabled] = useState(false);
  const [puzzleTypes, setPuzzleTypes] = useState<PuzzleType[]>(["counting"]);
  const [name, setName] = useState(`Trasa ${new Intl.DateTimeFormat("pl-PL", { day: "numeric", month: "long" }).format(new Date())}`);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const changeCount = (next: number) => setCount(Math.max(2, Math.min(availableCount, Math.round(next))));

  return (
    <Modal title="Nowa trasa" onClose={onClose}>
      <form className="form-stack" onSubmit={async (event) => {
        event.preventDefault();
        setSaving(true);
        setError("");
        try { await onCreate(name, mode === "automatic" ? { mode, count, distanceMode, puzzleTypes: puzzlesEnabled ? puzzleTypes : [] } : { mode, distanceMode, puzzleTypes: puzzlesEnabled ? puzzleTypes : [] }); }
        catch (reason) { setError(reason instanceof Error ? reason.message : "Nie udało się utworzyć trasy."); }
        finally { setSaving(false); }
      }}>
        <div className="route-mode-grid" role="group" aria-label="Sposób wyboru zdjęć">
          <button className={`route-mode-card${mode === "automatic" ? " is-active" : ""}`} type="button" aria-pressed={mode === "automatic"} onClick={() => setMode("automatic")}>
            <span><Sparkles size={20} /></span><strong>Wylosuj automatycznie</strong><small>Wybierz liczbę, a aplikacja znajdzie odległe miejsca.</small>
          </button>
          <button className={`route-mode-card${mode === "manual" ? " is-active" : ""}`} type="button" aria-pressed={mode === "manual"} disabled={!manualAvailable} onClick={() => setMode("manual")}>
            <span><CheckSquare size={20} /></span><strong>Użyj zaznaczonych</strong><small>{selectedCount} zaznaczonych zdjęć{!manualAvailable && selectedCount >= 2 ? " · uzupełnij GPS" : ""}</small>
          </button>
        </div>

        {mode === "automatic" && (
          <div className="route-count-section">
            <div><strong>Ile zdjęć ma mieć trasa?</strong><small>Dostępnych z GPS: {availableCount}</small></div>
            <div className="route-count-control">
              <button type="button" aria-label="Zmniejsz liczbę zdjęć" disabled={count <= 2} onClick={() => changeCount(count - 1)}><Minus size={18} /></button>
              <input aria-label="Liczba zdjęć w trasie" type="number" inputMode="numeric" min={2} max={availableCount} value={count} onChange={(event) => changeCount(Number(event.target.value))} />
              <button type="button" aria-label="Zwiększ liczbę zdjęć" disabled={count >= availableCount} onClick={() => changeCount(count + 1)}><Plus size={18} /></button>
            </div>
          </div>
        )}

        <fieldset className="route-distance-fieldset">
          <legend>Styl przejść między punktami</legend>
          <div className="route-distance-options">
            <button type="button" className={distanceMode === "maximum" ? "is-active" : ""} aria-pressed={distanceMode === "maximum"} onClick={() => setDistanceMode("maximum")}><Footprints size={18} /><strong>Dużo biegania</strong><small>Najdłuższe odcinki</small></button>
            <button type="button" className={distanceMode === "balanced" ? "is-active" : ""} aria-pressed={distanceMode === "balanced"} onClick={() => setDistanceMode("balanced")}><Gauge size={18} /><strong>Zrównoważona</strong><small>Długie i średnie</small></button>
            <button type="button" className={distanceMode === "compact" ? "is-active" : ""} aria-pressed={distanceMode === "compact"} onClick={() => setDistanceMode("compact")}><Sparkles size={18} /><strong>Krótsze przejścia</strong><small>Punkty bliżej siebie</small></button>
          </div>
        </fieldset>

        <fieldset className="route-puzzle-fieldset">
          <legend>Dodatkowa zabawa</legend>
          <button className={`puzzle-toggle${puzzlesEnabled ? " is-active" : ""}`} type="button" role="switch" aria-checked={puzzlesEnabled} onClick={() => setPuzzlesEnabled((value) => !value)}>
            <span><Brain size={20} /></span>
            <span><strong>Zagadki na kartach</strong><small>Na dole każdej karty pojawi się inne, losowe zadanie.</small></span>
            <i aria-hidden="true" />
          </button>
          {puzzlesEnabled && <>
            <PuzzleTypePicker selected={puzzleTypes} onChange={setPuzzleTypes} />
            <p className="puzzle-selection-hint">{puzzleTypes.length ? "Możesz zaznaczyć kilka rodzajów. Karty zostaną podzielone między nie możliwie równo." : "Wybierz co najmniej jeden rodzaj zagadek."}</p>
          </>}
        </fieldset>

        <label><span>Nazwa trasy</span><input value={name} maxLength={80} onChange={(event) => setName(event.target.value)} required /></label>
        <p className="form-note">{distanceMode === "maximum" ? "Algorytm będzie przeplatał odległe części mapy, aby dzieci miały dużo biegania." : distanceMode === "balanced" ? "Trasa połączy dłuższe odcinki z kilkoma spokojniejszymi przejściami." : "Algorytm wybierze sąsiadujące miejsca i ograniczy długość kolejnych przejść."}</p>
        {error && <div className="form-error" role="alert">{error}</div>}
        <div className="modal-actions"><button className="button button-secondary" type="button" onClick={onClose}>Anuluj</button><button className="button button-primary" disabled={saving || (puzzlesEnabled && puzzleTypes.length === 0)} type="submit">{saving ? "Szukam najlepszej trasy…" : mode === "automatic" ? `Wylosuj ${count} punktów` : `Utwórz z ${selectedCount} punktów`}</button></div>
      </form>
    </Modal>
  );
}
