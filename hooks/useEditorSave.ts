import { useState } from "react";
import type { Annotation } from "@/types";

type SaveStatus   = "idle" | "saving" | "saved" | "error";
type ExportStatus = "idle" | "exporting" | "error";

type UseEditorSaveReturn = {
  saveStatus:   SaveStatus;
  saveError:    string | null;
  exportStatus: ExportStatus;
  exportError:  string | null;
  save:              (annotations: Annotation[], pageOrder: number[]) => Promise<void>;
  exportAnnotatedPdf: () => Promise<void>;
};

/**
 * Handles the two async operations in the annotation editor:
 *   - save: persists annotations + page order to the server
 *   - exportAnnotatedPdf: fetches the baked PDF and triggers a browser download
 *
 * Errors are returned as strings and stay visible until the next attempt,
 * so the user cannot silently miss a failed save.
 */
export function useEditorSave(
  documentId: string,
  documentTitle: string
): UseEditorSaveReturn {
  const [saveStatus,   setSaveStatus]   = useState<SaveStatus>("idle");
  const [saveError,    setSaveError]    = useState<string | null>(null);
  const [exportStatus, setExportStatus] = useState<ExportStatus>("idle");
  const [exportError,  setExportError]  = useState<string | null>(null);

  async function save(annotations: Annotation[], pageOrder: number[]): Promise<void> {
    setSaveStatus("saving");
    setSaveError(null);
    try {
      const res = await fetch(`/api/editor-state/${documentId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ annotations, pageOrder }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error((data as { error?: string }).error ?? "Save failed");
      }
      setSaveStatus("saved");
      setTimeout(() => setSaveStatus("idle"), 2500);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Save failed";
      setSaveError(msg);
      setSaveStatus("error");
    }
  }

  async function exportAnnotatedPdf(): Promise<void> {
    if (exportStatus === "exporting") return;
    setExportStatus("exporting");
    setExportError(null);
    try {
      const res = await fetch(`/api/export/${documentId}`);
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error((data as { error?: string }).error ?? "Export failed");
      }
      const blob = await res.blob();
      const objectUrl = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = objectUrl;
      link.download = `${documentTitle.replace(/[^a-z0-9_\-]/gi, "_")}_annotated.pdf`;
      link.click();
      URL.revokeObjectURL(objectUrl);
      setExportStatus("idle");
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Export failed";
      setExportError(msg);
      setExportStatus("error");
    }
  }

  return { saveStatus, saveError, exportStatus, exportError, save, exportAnnotatedPdf };
}
