"use client";
import { useSyncExternalStore } from "react";
import { undoBus } from "@/lib/undo";

/** O aviso "Feito · Desfazer" do app. Um só, montado uma vez em GaduApp; as telas chamam `showUndo()` de `@/lib/undo`. */
export function UndoToast() {
  const view = useSyncExternalStore(undoBus.subscribe, undoBus.getView, () => null);
  if (!view) return null;
  return (
    <div className="undo-toast" role="status" aria-live="polite">
      <span>{view.text}</span>
      {view.undoable && <button className="btn btn-sm" onClick={() => void undoBus.undo()}>Desfazer</button>}
    </div>
  );
}
