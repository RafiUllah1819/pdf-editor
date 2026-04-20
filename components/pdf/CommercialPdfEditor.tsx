import { useEffect, useRef, useState, useCallback } from "react";
import Link from "next/link";
import type { WebViewerInstance } from "@/lib/apryse";
import { createViewer } from "@/lib/apryse";
import { buildViewerOptions } from "@/lib/pdf/sdk-config";
import { getDocumentBytes } from "@/lib/pdf/sdk-helpers";

type SaveStatus = "idle" | "saving" | "saved" | "error";
type EditStatus = "loading" | "ready" | "no-text" | "failed";

type Props = {
  documentId: string;
  pdfUrl: string;
  title: string;
  versionNum: number;
  onSaveSuccess?: () => void;
};

export default function CommercialPdfEditor({
  documentId,
  pdfUrl,
  title,
  versionNum,
  onSaveSuccess,
}: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const instanceRef  = useRef<WebViewerInstance | null>(null);
  const initStarted  = useRef(false);

  const [editStatus,    setEditStatus]    = useState<EditStatus>("loading");
  const [saveStatus,    setSaveStatus]    = useState<SaveStatus>("idle");
  const [saveError,     setSaveError]     = useState<string | null>(null);
  const [editingBox,    setEditingBox]    = useState(false);
  const [downloading,   setDownloading]   = useState(false);

  useEffect(() => {
    if (initStarted.current || !containerRef.current) return;
    initStarted.current = true;

    createViewer({
      container: containerRef.current,
      extra: buildViewerOptions(pdfUrl),
    }).then((instance) => {
      instanceRef.current = instance;
      const { UI, Core } = instance;

      UI.enableFeatures([UI.Feature.ContentEdit, UI.Feature.FilledSign]);
      UI.setToolbarGroup("toolbarGroup-Edit");
      UI.disableElements([
        "toolbarGroup-Annotate","toolbarGroup-Shapes","toolbarGroup-Insert",
        "toolbarGroup-Measure","toolbarGroup-Redact","toolbarGroup-View",
      ]);

      const initContentEdit = async () => {
        try {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          await (Core as any).PDFNet.initialize();
          const cem = Core.documentViewer.getContentEditManager();
          await cem.startContentEditMode();

          // Disable text reflow so text stays on one line instead of wrapping
          try {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            await (Core as any).ContentEdit.setLongTextReflow(cem, false);
          } catch {
            // not available in this build — fall back to manual expand
          }

          // Track when a text box is actively being edited
          cem.addEventListener("contentBoxEditStarted", () => setEditingBox(true));
          cem.addEventListener("contentBoxEditEnded",   () => setEditingBox(false));

          setEditStatus(cem.isInContentEditMode() ? "ready" : "no-text");
        } catch (err) {
          console.error("[CE] init failed:", err);
          setEditStatus("failed");
        }
      };

      if (Core.documentViewer.getDocument()) {
        initContentEdit();
      } else {
        Core.documentViewer.addEventListener("documentLoaded", initContentEdit, { once: true });
      }
    }).catch((err: unknown) => {
      setEditStatus("failed");
      console.error("[CE] createViewer failed:", err);
    });

    return () => {
      instanceRef.current?.UI.dispose();
      instanceRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Expand the width of the currently active / selected text box
  const handleExpandBox = useCallback(() => {
    const instance = instanceRef.current;
    if (!instance) return;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { Core } = instance as any;

    // Content-edit placeholders are normal annotations — grab the selected ones first,
    // fall back to all on the current page so there's always something to act on.
    const selected: any[] = Core.annotationManager.getSelectedAnnotations();
    const all: any[]      = Core.annotationManager.getAnnotationsList();
    const page: number    = Core.documentViewer.getCurrentPage();

    const targets: any[] = (
      selected.filter((a: any) => a.isContentEditPlaceholder?.()) .length
        ? selected.filter((a: any) => a.isContentEditPlaceholder?.())
        : all.filter((a: any) => a.isContentEditPlaceholder?.() && a.getPageNumber() === page)
    );

    if (!targets.length) return;

    targets.forEach((annot: any) => {
      const rect = annot.getRect(); // { x1, y1, x2, y2 }
      // Expand right edge by 60 PDF points (~21 mm)
      annot.setRect(new Core.Math.Rect(rect.x1, rect.y1, rect.x2 + 60, rect.y2));
      Core.annotationManager.redrawAnnotation(annot);
    });
  }, []);

  // Commit any in-progress text-box edit before reading PDF bytes.
  // ContentEdit holds changes in a live HTML element until the box is
  // deselected — endContentEditMode() flushes them to the PDF document.
  const commitEdits = useCallback(async (): Promise<Uint8Array> => {
    const instance = instanceRef.current!;
    const { Core } = instance;
    const cem = Core.documentViewer.getContentEditManager();
    if (cem.isInContentEditMode()) {
      cem.endContentEditMode();
      await new Promise(r => setTimeout(r, 150));
    }
    const bytes = await getDocumentBytes(instance);
    // Re-enter edit mode so the user can keep editing after save/download
    if (!cem.isInContentEditMode()) {
      await cem.startContentEditMode().catch(() => {});
    }
    return bytes;
  }, []);

  const handleDownload = useCallback(async () => {
    const instance = instanceRef.current;
    if (!instance || downloading) return;
    setDownloading(true);
    try {
      const bytes = await commitEdits();
      const blob = new Blob([bytes.buffer as ArrayBuffer], { type: "application/pdf" });
      const url  = URL.createObjectURL(blob);
      const a    = document.createElement("a");
      a.href     = url;
      a.download = `${title || "document"}.pdf`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error("Download failed:", err);
    } finally {
      setDownloading(false);
    }
  }, [title, downloading, commitEdits]);

  const handleSave = useCallback(async () => {
    const instance = instanceRef.current;
    if (!instance) return;
    setSaveStatus("saving");
    setSaveError(null);
    try {
      const bytes = await commitEdits();
      const res = await fetch(`/api/save-edit/${documentId}`, {
        method: "POST",
        headers: { "Content-Type": "application/pdf" },
        body: bytes.buffer as ArrayBuffer,
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error((body as { error?: string }).error ?? `HTTP ${res.status}`);
      }
      setSaveStatus("saved");
      onSaveSuccess?.();
      setTimeout(() => setSaveStatus("idle"), 3000);
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : "Save failed");
      setSaveStatus("error");
    }
  }, [documentId, onSaveSuccess]);

  return (
    <div className="flex flex-col h-full">
      {/* Toolbar */}
      <div className="flex items-center gap-2 px-4 py-2 border-b bg-white shrink-0 flex-wrap">
        <Link href="/dashboard" title="Back"
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-gray-500 hover:bg-gray-100 transition-colors">
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </Link>

        <span className="hidden sm:block max-w-[180px] truncate text-sm font-semibold text-gray-800" title={title}>
          {title}
        </span>

        {/* Expand text box width button — always visible in ready state */}
        {editStatus === "ready" && (
          <button
            onClick={handleExpandBox}
            title="Expand the width of the selected text block so text has more room"
            className="flex items-center gap-1.5 rounded-md border border-gray-200 bg-white px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-indigo-50 hover:border-indigo-300 hover:text-indigo-700 transition-colors"
          >
            <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M4 12h16M15 6l6 6-6 6M9 6l-6 6 6 6" />
            </svg>
            Expand text box
          </button>
        )}

        {/* Status badge */}
        <div className="hidden sm:flex items-center">
          {editStatus === "loading" && <span className="text-xs text-gray-400">Loading…</span>}
          {editStatus === "ready"   && <span className="text-xs text-green-600 font-medium">✓ Click any text to edit</span>}
          {editStatus === "no-text" && <span className="text-xs text-yellow-600 font-medium">⚠ No editable text found</span>}
          {editStatus === "failed"  && <span className="text-xs text-red-600 font-medium">✗ Editor failed</span>}
        </div>

        <div className="ml-auto flex items-center gap-2">
          {/* Download current PDF */}
          <button
            onClick={handleDownload}
            disabled={editStatus === "loading" || downloading}
            title="Download PDF"
            className="flex items-center gap-1.5 rounded-md border border-gray-200 bg-white px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50 hover:border-gray-300 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
            </svg>
            {downloading ? "Downloading…" : "Download"}
          </button>

          <SaveButton
            status={saveStatus}
            errorMsg={saveError}
            disabled={editStatus === "loading"}
            onClick={handleSave}
          />
        </div>
      </div>

      <div className="relative flex-1 min-h-0">
        <div ref={containerRef} className="h-full w-full" />
        {editStatus === "loading" && (
          <div className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-4 bg-gray-50">
            <svg className="h-12 w-12 text-gray-300 animate-pulse" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
            </svg>
            <p className="text-sm font-medium text-gray-500">Opening editor…</p>
          </div>
        )}
      </div>
    </div>
  );
}

function SaveButton({ status, errorMsg, disabled, onClick }: {
  status: SaveStatus; errorMsg: string | null; disabled: boolean; onClick: () => void;
}) {
  const base = "px-4 py-1.5 text-sm font-medium rounded-md transition-colors disabled:opacity-50 disabled:cursor-not-allowed";
  const cls  =
    status === "saving" ? `${base} bg-indigo-600 text-white cursor-wait` :
    status === "saved"  ? `${base} bg-green-600 text-white` :
    status === "error"  ? `${base} bg-red-600 text-white` :
                          `${base} bg-indigo-600 text-white hover:bg-indigo-700`;
  const label = status === "saving" ? "Saving…" : status === "saved" ? "Saved ✓" : status === "error" ? "Retry" : "Save";
  return (
    <div className="relative">
      <button onClick={onClick} disabled={disabled || status === "saving"} className={cls}>{label}</button>
      {status === "error" && errorMsg && (
        <div className="absolute right-0 top-full mt-1.5 z-20 w-56 rounded-md border border-red-200 bg-white px-3 py-2 shadow-md">
          <p className="text-xs font-medium text-red-700">Save failed</p>
          <p className="mt-0.5 text-xs text-gray-500">{errorMsg}</p>
        </div>
      )}
    </div>
  );
}
