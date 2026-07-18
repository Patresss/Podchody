import { useState } from "react";
import { puzzleSelectionLabel } from "../lib/puzzles";
import type { PuzzleType } from "../types";
import { Modal } from "./Modal";
import { PuzzleTypePicker } from "./PuzzleTypePicker";

type PuzzleSettingsModalProps = {
  selected: PuzzleType[];
  onClose: () => void;
  onSave: (selected: PuzzleType[]) => Promise<void>;
};

export function PuzzleSettingsModal({ selected, onClose, onSave }: PuzzleSettingsModalProps) {
  const [value, setValue] = useState<PuzzleType[]>(selected);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  return (
    <Modal title="Zagadki na kartach" onClose={onClose}>
      <form className="form-stack" onSubmit={async (event) => {
        event.preventDefault();
        setSaving(true);
        setError("");
        try { await onSave(value); }
        catch (reason) { setError(reason instanceof Error ? reason.message : "Nie udało się zapisać zagadek."); }
        finally { setSaving(false); }
      }}>
        <p className="form-note puzzle-settings-intro">Wybierz dowolną liczbę rodzajów. Aplikacja podzieli karty możliwie równo i losowo je przetasuje.</p>
        <PuzzleTypePicker selected={value} onChange={setValue} />
        <div className="puzzle-balance-note"><strong>{puzzleSelectionLabel(value)}</strong><small>{value.length ? "Każdy wybrany rodzaj pojawi się podobną liczbę razy." : "Po zapisaniu karty nie będą zawierały zagadek."}</small></div>
        {error && <div className="form-error" role="alert">{error}</div>}
        <div className="modal-actions"><button className="button button-secondary" type="button" onClick={onClose}>Anuluj</button><button className="button button-primary" disabled={saving} type="submit">{saving ? "Zapisuję…" : value.length ? "Zapisz zagadki" : "Wyłącz zagadki"}</button></div>
      </form>
    </Modal>
  );
}
