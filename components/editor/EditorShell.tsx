import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import type { PDFDocumentProxy } from "pdfjs-dist";
import { loadPdf } from "@/lib/pdfjs";
import { clamp, cn, generateId } from "@/lib/utils";
import type { Annotation, Document, EditorTool } from "@/types";
import PdfViewer from "@/components/pdf/PdfViewer";
import ViewerToolbar from "@/components/pdf/ViewerToolbar";
import ThumbnailSidebar from "@/components/pdf/ThumbnailSidebar";

const MIN_SCALE = 0.5;
const MAX_SCALE = 3.0;
const SCALE_STEP = 0.25;
const DEFAULT_SCALE = 1.2;

const TOOLS: { label: string; value: EditorTool; title: string }[] = [
  { label: "Select",    value: "select",    title: "Select & move annotations (V)" },
  { label: "Text",      value: "text",      title: "Place a text box (T)" },
  { label: "Highlight", value: "highlight", title: "Draw a highlight (H)" },
];

type Props = {
  document: Document;
  fileUrl: string;
  initialAnnotations: Annotation[];
};

export default function EditorShell({ document, fileUrl, initialAnnotations }: Props) {
  // ── PDF state ────────────────────────────────────────────────────────────
  const [pdf, setPdf] = useState<PDFDocumentProxy | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(0);
  const [scale, setScale] = useState(DEFAULT_SCALE);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // ── Annotation state ─────────────────────────────────────────────────────
  const [activeTool, setActiveTool] = useState<EditorTool>("select");
  const [annotations, setAnnotations] = useState<Annotation[]>(initialAnnotations);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  // ── Save state ────────────────────────────────────────────────────────────
  const [saveStatus, setSaveStatus] = useState<"idle" | "saving" | "saved" | "error">("idle");

  // ── Load PDF ──────────────────────────────────────────────────────────────
  useEffect(() => {
    let doc: PDFDocumentProxy | null = null;
    setLoading(true);
    setError(null);
    setPdf(null);

    loadPdf(fileUrl)
      .then((loaded) => {
        doc = loaded;
        setPdf(loaded);
        setTotalPages(loaded.numPages);
        setCurrentPage(1);
        setLoading(false);
      })
      .catch((err: unknown) => {
        setError(err instanceof Error ? err.message : "Failed to load PDF");
        setLoading(false);
      });

    return () => { doc?.destroy(); };
  }, [fileUrl]);

  // ── Keyboard shortcuts ────────────────────────────────────────────────────
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      const tag = (e.target as HTMLElement).tagName;
      if (tag === "INPUT" || tag === "TEXTAREA") return;

      // Tool shortcuts
      if (e.key === "v" || e.key === "V") { setActiveTool("select"); return; }
      if (e.key === "t" || e.key === "T") { setActiveTool("text"); return; }
      if (e.key === "h" || e.key === "H") { setActiveTool("highlight"); return; }

      // Delete selected annotation
      if ((e.key === "Delete" || e.key === "Backspace") && selectedId) {
        deleteAnnotation(selectedId);
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedId]);

  // ── Navigation ────────────────────────────────────────────────────────────
  function goToPage(page: number) { setCurrentPage(clamp(page, 1, totalPages)); }
  function zoomIn()    { setScale((s) => Math.min(+(s + SCALE_STEP).toFixed(2), MAX_SCALE)); }
  function zoomOut()   { setScale((s) => Math.max(+(s - SCALE_STEP).toFixed(2), MIN_SCALE)); }
  function zoomReset() { setScale(DEFAULT_SCALE); }

  // ── Annotation helpers ────────────────────────────────────────────────────
  function addAnnotation(ann: Annotation) {
    setAnnotations((prev) => [...prev, ann]);
  }

  function updateAnnotation(id: string, updates: Partial<Annotation>) {
    setAnnotations((prev) =>
      prev.map((a) => (a.id === id ? { ...a, ...updates } : a))
    );
  }

  const deleteAnnotation = useCallback((id: string) => {
    setAnnotations((prev) => prev.filter((a) => a.id !== id));
    setSelectedId((prev) => (prev === id ? null : prev));
  }, []);

  // ── Save ─────────────────────────────────────────────────────────────────
  async function handleSave() {
    setSaveStatus("saving");
    try {
      const res = await fetch(`/api/editor-state/${document.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ annotations }),
      });
      if (!res.ok) throw new Error(await res.text());
      setSaveStatus("saved");
      setTimeout(() => setSaveStatus("idle"), 2500);
    } catch {
      setSaveStatus("error");
      setTimeout(() => setSaveStatus("idle"), 3000);
    }
  }

  // ── Signature / image upload ──────────────────────────────────────────────
  const signatureInputRef = useRef<HTMLInputElement>(null);

  function handleSignatureUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = ""; // reset so the same file can be re-selected later
    if (!file) return;

    if (!["image/png", "image/jpeg"].includes(file.type)) {
      alert("Only PNG and JPG images are supported.");
      return;
    }
    if (file.size > 3 * 1024 * 1024) {
      alert("Image must be under 3 MB.");
      return;
    }

    const reader = new FileReader();
    reader.onload = (ev) => {
      const src = ev.target?.result as string;
      if (!src) return;

      // Load the image to read its natural dimensions for correct aspect ratio
      const img = new window.Image();
      img.onload = () => {
        const defaultWidth = 200; // normalised (scale=1.0)
        const aspectRatio = img.naturalHeight / img.naturalWidth;

        const ann: Annotation = {
          id: generateId(),
          documentId: "",
          page: currentPage,
          type: "image",
          x: 40,
          y: 40,
          width: defaultWidth,
          height: Math.round(defaultWidth * aspectRatio),
          src,
          opacity: 1,
        };
        addAnnotation(ann);
        setSelectedId(ann.id);
        setActiveTool("select"); // switch to select so the user can reposition immediately
      };
      img.src = src;
    };
    reader.readAsDataURL(file);
  }

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="flex h-[calc(100vh-56px)] flex-col bg-white">

      {/* ── Primary toolbar ──────────────────────────────────────────────── */}
      <div className="flex shrink-0 items-center gap-3 border-b border-gray-200 px-4 py-2">
        <Link
          href="/dashboard"
          className="rounded p-1 text-gray-500 hover:bg-gray-100 hover:text-gray-900"
          title="Back to dashboard"
        >
          <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </Link>

        <span className="max-w-xs truncate text-sm font-semibold text-gray-800" title={document.title}>
          {document.title}
        </span>

        <div className="h-5 w-px bg-gray-200" />

        {/* Hidden file input for signature/image upload */}
        <input
          ref={signatureInputRef}
          type="file"
          accept="image/png,image/jpeg"
          className="hidden"
          onChange={handleSignatureUpload}
        />

        {/* Annotation tool buttons */}
        <div className="flex items-center gap-1">
          {TOOLS.map(({ label, value, title }) => (
            <button
              key={value}
              onClick={() => setActiveTool(value)}
              title={title}
              className={cn(
                "rounded px-2.5 py-1 text-xs font-medium transition-colors",
                activeTool === value
                  ? "bg-indigo-600 text-white"
                  : "text-gray-600 hover:bg-gray-100"
              )}
            >
              {label}
            </button>
          ))}

          {/* Signature is a one-shot action (opens file picker), not a tool mode */}
          <div className="mx-1 h-4 w-px bg-gray-200" />
          <button
            onClick={() => signatureInputRef.current?.click()}
            title="Upload signature or image (PNG / JPG, max 3 MB)"
            className="flex items-center gap-1 rounded px-2.5 py-1 text-xs font-medium text-gray-600 hover:bg-gray-100"
          >
            <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
            Signature
          </button>
        </div>

        <div className="ml-auto flex items-center gap-2">
          <a
            href={`/api/export/${document.id}`}
            download
            title="Download annotated PDF"
            className="rounded-lg border border-gray-200 px-3 py-1.5 text-xs font-semibold text-gray-600 hover:bg-gray-50 hover:border-gray-300 transition-colors"
          >
            Export PDF
          </a>

          {saveStatus === "saved" && (
            <span className="text-xs font-medium text-green-600">Saved!</span>
          )}
          {saveStatus === "error" && (
            <span className="text-xs font-medium text-red-500">Save failed</span>
          )}

          <button
            onClick={handleSave}
            disabled={saveStatus === "saving"}
            className={cn(
              "rounded-lg px-3 py-1.5 text-xs font-semibold text-white transition-colors",
              saveStatus === "saving"
                ? "bg-indigo-300 cursor-not-allowed"
                : "bg-indigo-600 hover:bg-indigo-700"
            )}
          >
            {saveStatus === "saving" ? "Saving…" : "Save"}
          </button>
        </div>
      </div>

      {/* ── Editor body ──────────────────────────────────────────────────── */}
      <div className="flex flex-1 overflow-hidden">

        {/* Left: page thumbnails */}
        {pdf && (
          <ThumbnailSidebar
            pdf={pdf}
            totalPages={totalPages}
            currentPage={currentPage}
            onPageChange={goToPage}
          />
        )}

        {/* Centre: viewer + toolbar */}
        <div className="flex flex-1 flex-col overflow-hidden">
          {pdf && (
            <ViewerToolbar
              currentPage={currentPage}
              totalPages={totalPages}
              scale={scale}
              onPageChange={goToPage}
              onZoomIn={zoomIn}
              onZoomOut={zoomOut}
              onZoomReset={zoomReset}
              minScale={MIN_SCALE}
              maxScale={MAX_SCALE}
            />
          )}

          {loading && <LoadingPane />}

          {!loading && error && <ErrorPane message={error} />}

          {!loading && !error && pdf && (
            <PdfViewer
              pdf={pdf}
              pageNumber={currentPage}
              scale={scale}
              annotations={annotations}
              activeTool={activeTool}
              selectedId={selectedId}
              onAnnotationCreate={addAnnotation}
              onAnnotationUpdate={updateAnnotation}
              onAnnotationSelect={setSelectedId}
            />
          )}
        </div>

        {/* Right: annotation list */}
        <AnnotationsSidebar
          annotations={annotations.filter((a) => a.page === currentPage)}
          selectedId={selectedId}
          onSelect={setSelectedId}
          onDelete={deleteAnnotation}
        />
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Small sub-components used only in this file
// ---------------------------------------------------------------------------

function LoadingPane() {
  return (
    <div className="flex flex-1 items-center justify-center bg-gray-100">
      <div className="flex flex-col items-center gap-3 text-gray-500">
        <svg className="h-8 w-8 animate-spin text-indigo-500" fill="none" viewBox="0 0 24 24">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
        </svg>
        <span className="text-sm">Loading PDF…</span>
      </div>
    </div>
  );
}

function ErrorPane({ message }: { message: string }) {
  return (
    <div className="flex flex-1 items-center justify-center bg-gray-100">
      <div className="flex flex-col items-center gap-2 text-center">
        <svg className="h-8 w-8 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
            d="M12 9v2m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
        </svg>
        <p className="text-sm font-medium text-red-600">{message}</p>
      </div>
    </div>
  );
}

type SidebarProps = {
  annotations: Annotation[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  onDelete: (id: string) => void;
};

function AnnotationsSidebar({ annotations, selectedId, onSelect, onDelete }: SidebarProps) {
  return (
    <aside className="flex w-56 shrink-0 flex-col border-l border-gray-200 bg-white">
      <div className="border-b border-gray-200 px-3 py-2">
        <span className="text-xs font-semibold uppercase tracking-wide text-gray-400">
          Annotations
          {annotations.length > 0 && (
            <span className="ml-1.5 rounded-full bg-indigo-100 px-1.5 py-0.5 text-[10px] font-semibold text-indigo-600">
              {annotations.length}
            </span>
          )}
        </span>
      </div>

      <div className="flex-1 overflow-y-auto p-2">
        {annotations.length === 0 && (
          <p className="mt-4 text-center text-xs text-gray-400">
            No annotations on this page.
          </p>
        )}
        {annotations.map((ann) => (
          <div
            key={ann.id}
            onClick={() => onSelect(ann.id)}
            className={cn(
              "group mb-1 flex cursor-pointer items-start justify-between rounded-lg px-2 py-1.5 text-xs transition-colors",
              selectedId === ann.id
                ? "bg-indigo-50 text-indigo-700"
                : "text-gray-600 hover:bg-gray-50"
            )}
          >
            <div className="min-w-0 flex-1">
              <span className="font-medium capitalize">{ann.type}</span>
              {ann.type === "text" && ann.text && (
                <p className="mt-0.5 truncate text-gray-400">{ann.text}</p>
              )}
            </div>
            <button
              onClick={(e) => { e.stopPropagation(); onDelete(ann.id); }}
              title="Delete annotation"
              className="ml-1 shrink-0 rounded p-0.5 text-gray-300 opacity-0 hover:bg-red-50 hover:text-red-500 group-hover:opacity-100"
            >
              <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        ))}
      </div>

      {annotations.length > 0 && (
        <div className="border-t border-gray-100 px-3 py-2 text-[10px] text-gray-400">
          Delete key removes selected
        </div>
      )}
    </aside>
  );
}
