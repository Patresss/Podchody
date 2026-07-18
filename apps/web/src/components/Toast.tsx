import { AlertCircle, CheckCircle2, X } from "lucide-react";

export type ToastState = { message: string; kind: "success" | "error" } | null;

export function Toast({ toast, onClose }: { toast: ToastState; onClose: () => void }) {
  if (!toast) return null;
  return (
    <div className={`toast toast-${toast.kind}`} role={toast.kind === "error" ? "alert" : "status"}>
      {toast.kind === "success" ? <CheckCircle2 size={19} /> : <AlertCircle size={19} />}
      <span>{toast.message}</span>
      <button className="icon-button" type="button" onClick={onClose} aria-label="Zamknij komunikat"><X size={16} /></button>
    </div>
  );
}
