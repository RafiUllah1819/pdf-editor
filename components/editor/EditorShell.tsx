import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { clamp, cn, generateId } from "@/lib/utils";
import { Spinner, StatusMessage } from "@/components/ui";
import type { Annotation, Document, EditorTool } from "@/types";
import PdfViewer from "@/components/pdf/PdfViewer";
import ViewerToolbar from "@/components/pdf/ViewerToolbar";
import ThumbnailSidebar from "@/components/pdf/ThumbnailSidebar";
import AnnotationsSidebar from "@/components/editor/AnnotationsSidebar";
import { usePdfLoader } from "@/hooks/usePdfLoader";
import { useAnnotations } from "@/hooks/useAnnotations";
import { useEditorSave } from "@/hooks/useEditorSave";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const MIN_SCALE  = 0.5;
const MAX_SCALE  = 3.0;
const SCALE_STEP = 0.25;
const DEFAULT_SCALE = 1.2;

type ToolDef = {
  value: EditorTool;
  label: string;
  title: string;
  icon: React.ReactNode;
};

const TOOLS: ToolDef[] = [
  {
    value: "select",
    label: "Select",
    title: "Select & move annotations (V)",
    icon: (
      <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
          d="M15 15l-7-7m0 0l7 0m-7 0l0 7" />
      </svg>
    ),
  },
  {
    value: "text",
    label: "Text",
    title: "Place a text box (T)",
    icon: (
      <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
          d="M4 6h16M12 6v12m-4 0h8" />
      </svg>
    ),
  },
  {
    value: "highlight",
    label: "Highlight",
    title: "Draw a highlight rectangle (H)",
    icon: (
      <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
          d="M15.232 5.232l3.536 3.536M9 13l6.586-6.586a2 2 0 012.828 2.828L11.828 15.828a2 2 0 01-1.414.586H8v-2.414A2 2 0 019 13z" />
      </svg>
    ),
  },
  {
    value: "draw",
    label: "Draw",
    title: "Freehand draw (D)",
    icon: (
      <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
          d="M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25zM20.71 7.04a1 1 0 000-1.41l-2.34-2.34a1 1 0 00-1.41 0l-1.83 1.83 3.75 3.75 1.83-1.83z" />
      </svg>
    ),
  },
];

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

type Props = {
  document: Document;
  fileUrl: string;
  initialAnnotations: Annotation[];
  initialPageOrder: number[];
};

export default function EditorShell({
  document,
  fileUrl,
  initialAnnotations,
  initialPageOrder,
}: Props) {
  // ── PDF ───────────────────────────────────────────────────────────────────
  const { pdf, totalPages, loading: loadingPdf, error: pdfError } = usePdfLoader(fileUrl);

  // ── Annotations ──────────────────────────────────────────────────────────
  const {
    annotations,
    selectedId,
    setSelectedId,
    addAnnotation,
    updateAnnotation,
    deleteAnnotation,
  } = useAnnotations(initialAnnotations);

  // ── Save / export ─────────────────────────────────────────────────────────
  const { saveStatus, exportStatus, save, exportAnnotatedPdf } = useEditorSave(
    document.id,
    document.title
  );

  // ── Active tool ───────────────────────────────────────────────────────────
  const [activeTool, setActiveTool] = useState<EditorTool>("select");

  // ── Zoom ──────────────────────────────────────────────────────────────────
  const [scale, setScale] = useState(DEFAULT_SCALE);
  const zoomIn    = () => setScale((s) => Math.min(+(s + SCALE_STEP).toFixed(2), MAX_SCALE));
  const zoomOut   = () => setScale((s) => Math.max(+(s - SCALE_STEP).toFixed(2), MIN_SCALE));
  const zoomReset = () => setScale(DEFAULT_SCALE);

  // ── Page order ────────────────────────────────────────────────────────────
  // pageOrder: 1-based original page numbers in display order.
  // currentPage: the original page number currently shown.
  const [pageOrder, setPageOrder] = useState<number[]>(initialPageOrder);
  const [currentPage, setCurrentPage] = useState(1);

  // Seed pageOrder once totalPages is known (new documents start with empty array)
  useEffect(() => {
    if (totalPages > 0 && pageOrder.length === 0) {
      setPageOrder(Array.from({ length: totalPages }, (_, i) => i + 1));
    }
  }, [totalPages, pageOrder.length]);

  // 1-based display position of currentPage within pageOrder (for ViewerToolbar)
  const displayCurrentPage = Math.max(1, pageOrder.indexOf(currentPage) + 1);

  function goToDisplayPage(displayIdx: number) {
    if (pageOrder.length === 0) return;
    setCurrentPage(pageOrder[clamp(displayIdx, 1, pageOrder.length) - 1]);
  }

  function handlePageReorder(newOrder: number[]) {
    setPageOrder(newOrder);
  }

  function handlePageDelete(originalPageNum: number) {
    if (pageOrder.length <= 1) return;
    const deletedDisplayIdx = pageOrder.indexOf(originalPageNum);
    const newOrder = pageOrder.filter((p) => p !== originalPageNum);
    setPageOrder(newOrder);
    if (currentPage === originalPageNum) {
      setCurrentPage(newOrder[Math.min(deletedDisplayIdx, newOrder.length - 1)]);
    }
  }

  // ── Keyboard shortcuts ────────────────────────────────────────────────────
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      const tag = (e.target as HTMLElement).tagName;
      if (tag === "INPUT" || tag === "TEXTAREA") return;

      const key = e.key.toLowerCase();
      if (key === "v") { setActiveTool("select");    return; }
      if (key === "t") { setActiveTool("text");      return; }
      if (key === "h") { setActiveTool("highlight"); return; }
      if (key === "d") { setActiveTool("draw");      return; }
      if ((e.key === "Delete" || e.key === "Backspace") && selectedId) {
        deleteAnnotation(selectedId);
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [selectedId, deleteAnnotation]);

  // ── Signature / image upload ──────────────────────────────────────────────
  const signatureInputRef = useRef<HTMLInputElement>(null);

  function handleSignatureUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
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
      const img = new window.Image();
      img.onload = () => {
        const defaultWidth = 200;
        const ann: Annotation = {
          id: generateId(),
          documentId: "",
          page: currentPage,
          type: "image",
          x: 40,
          y: 40,
          width: defaultWidth,
          height: Math.round(defaultWidth * (img.naturalHeight / img.naturalWidth)),
          src,
          opacity: 1,
        };
        addAnnotation(ann);
        setSelectedId(ann.id);
        setActiveTool("select");
      };
      img.src = src;
    };
    reader.readAsDataURL(file);
  }

  // ── Render ────────────────────────────────────────────────────────────────
  const ready = !loadingPdf && !pdfError && pdf !== null && pageOrder.length > 0;

  return (
    <div className="flex h-[calc(100vh-56px)] flex-col bg-white">

      {/* Toolbar */}
      <div className="flex shrink-0 items-center gap-2 border-b border-gray-200 bg-white px-3 py-2 sm:gap-3 sm:px-4">

        <Link
          href="/dashboard"
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-gray-500 hover:bg-gray-100 hover:text-gray-900"
          title="Back to dashboard"
        >
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </Link>

        <span
          className="hidden max-w-[140px] truncate text-sm font-semibold text-gray-800 sm:block sm:max-w-xs"
          title={document.title}
        >
          {document.title}
        </span>

        <div className="hidden h-5 w-px bg-gray-200 sm:block" />

        {/* Hidden file input for image/signature */}
        <input
          ref={signatureInputRef}
          type="file"
          accept="image/png,image/jpeg"
          className="hidden"
          onChange={handleSignatureUpload}
        />

        {/* Annotation tools */}
        <div className="flex items-center gap-0.5 rounded-lg border border-gray-200 bg-gray-50 p-0.5">
          {TOOLS.map(({ value, label, title, icon }) => (
            <button
              key={value}
              onClick={() => setActiveTool(value)}
              title={title}
              className={cn(
                "flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs font-medium transition-colors",
                activeTool === value
                  ? "bg-white text-indigo-700 shadow-sm ring-1 ring-gray-200"
                  : "text-gray-500 hover:bg-white hover:text-gray-700"
              )}
            >
              {icon}
              <span className="hidden sm:inline">{label}</span>
            </button>
          ))}
        </div>

        {/* Signature upload */}
        <button
          onClick={() => signatureInputRef.current?.click()}
          title="Upload signature or image (PNG / JPG, max 3 MB)"
          className="flex h-8 items-center gap-1.5 rounded-md border border-gray-200 px-2.5 text-xs font-medium text-gray-600 hover:bg-gray-50 transition-colors"
        >
          <svg className="h-3.5 w-3.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
              d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
          </svg>
          <span className="hidden sm:inline">Signature</span>
        </button>

        {/* Right: status feedback + export + save */}
        <div className="ml-auto flex items-center gap-2">
          <StatusMessage status={saveStatus} savedText="Saved!" errorText="Save failed" />
          <StatusMessage
            status={exportStatus === "error" ? "error" : "idle"}
            errorText="Export failed"
          />

          <button
            onClick={exportAnnotatedPdf}
            disabled={exportStatus === "exporting"}
            title="Export annotated PDF"
            className={cn(
              "flex h-8 items-center gap-1.5 rounded-lg border px-3 text-xs font-semibold transition-colors",
              exportStatus === "exporting"
                ? "border-gray-200 text-gray-400 cursor-not-allowed"
                : "border-gray-200 text-gray-700 hover:border-gray-300 hover:bg-gray-50"
            )}
          >
            {exportStatus === "exporting" ? (
              <>
                <Spinner className="h-3.5 w-3.5 text-gray-400" />
                <span className="hidden sm:inline">Exporting…</span>
              </>
            ) : (
              <>
                <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                    d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                </svg>
                <span className="hidden sm:inline">Export PDF</span>
              </>
            )}
          </button>

          <button
            onClick={() => save(annotations, pageOrder)}
            disabled={saveStatus === "saving"}
            className={cn(
              "flex h-8 items-center gap-1.5 rounded-lg px-3 text-xs font-semibold text-white transition-colors",
              saveStatus === "saving"
                ? "bg-indigo-400 cursor-not-allowed"
                : "bg-indigo-600 hover:bg-indigo-700"
            )}
          >
            {saveStatus === "saving" ? (
              <>
                <Spinner className="h-3.5 w-3.5 text-white" />
                <span className="hidden sm:inline">Saving…</span>
              </>
            ) : (
              "Save"
            )}
          </button>
        </div>
      </div>

      {/* Editor body */}
      <div className="flex flex-1 overflow-hidden">

        {/* Left: page thumbnails */}
        {ready && (
          <ThumbnailSidebar
            pdf={pdf}
            pageOrder={pageOrder}
            currentPage={currentPage}
            onPageChange={setCurrentPage}
            onReorder={handlePageReorder}
            onDelete={handlePageDelete}
          />
        )}

        {/* Centre: PDF canvas + viewer toolbar */}
        <div className="flex flex-1 flex-col overflow-hidden">
          {ready && (
            <ViewerToolbar
              currentPage={displayCurrentPage}
              totalPages={pageOrder.length}
              scale={scale}
              onPageChange={goToDisplayPage}
              onZoomIn={zoomIn}
              onZoomOut={zoomOut}
              onZoomReset={zoomReset}
              minScale={MIN_SCALE}
              maxScale={MAX_SCALE}
            />
          )}

          {loadingPdf && <LoadingPane />}
          {!loadingPdf && pdfError && <ErrorPane message={pdfError} />}
          {ready && (
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

        {/* Right: annotation list for current page */}
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
// Loading / error states
// ---------------------------------------------------------------------------

function LoadingPane() {
  return (
    <div className="flex flex-1 items-center justify-center bg-gray-100">
      <div className="flex flex-col items-center gap-3 text-gray-500">
        <Spinner className="h-8 w-8 text-indigo-500" />
        <span className="text-sm font-medium">Loading PDF…</span>
      </div>
    </div>
  );
}

function ErrorPane({ message }: { message: string }) {
  return (
    <div className="flex flex-1 items-center justify-center bg-gray-100 px-6">
      <div className="flex max-w-sm flex-col items-center gap-3 text-center">
        <div className="flex h-12 w-12 items-center justify-center rounded-full bg-red-100 text-red-500">
          <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
              d="M12 9v2m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
          </svg>
        </div>
        <div>
          <p className="text-sm font-semibold text-gray-800">Could not load PDF</p>
          <p className="mt-1 text-xs text-gray-500">{message}</p>
        </div>
      </div>
    </div>
  );
}
