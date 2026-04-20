import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { clamp, cn, generateId } from "@/lib/utils";
import { Spinner } from "@/components/ui";
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

const MIN_SCALE   = 0.5;
const MAX_SCALE   = 3.0;
const SCALE_STEP  = 0.25;
const DEFAULT_SCALE = 1.2;

type ToolDef = { value: EditorTool; label: string; title: string; icon: React.ReactNode };

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
  const {
    saveStatus,
    saveError,
    exportStatus,
    exportError,
    save,
    exportAnnotatedPdf,
  } = useEditorSave(document.id, document.title);

  // ── Active tool ───────────────────────────────────────────────────────────
  const [activeTool, setActiveTool] = useState<EditorTool>("select");

  // ── Zoom ──────────────────────────────────────────────────────────────────
  const [scale, setScale] = useState(DEFAULT_SCALE);
  const zoomIn    = () => setScale((s) => Math.min(+(s + SCALE_STEP).toFixed(2), MAX_SCALE));
  const zoomOut   = () => setScale((s) => Math.max(+(s - SCALE_STEP).toFixed(2), MIN_SCALE));
  const zoomReset = () => setScale(DEFAULT_SCALE);

  // ── Page order ────────────────────────────────────────────────────────────
  const [pageOrder,   setPageOrder]   = useState<number[]>(initialPageOrder);
  const [currentPage, setCurrentPage] = useState(1);

  useEffect(() => {
    if (totalPages > 0 && pageOrder.length === 0) {
      setPageOrder(Array.from({ length: totalPages }, (_, i) => i + 1));
    }
  }, [totalPages, pageOrder.length]);

  const displayCurrentPage = Math.max(1, pageOrder.indexOf(currentPage) + 1);

  function goToDisplayPage(displayIdx: number) {
    if (pageOrder.length === 0) return;
    setCurrentPage(pageOrder[clamp(displayIdx, 1, pageOrder.length) - 1]);
  }

  function handlePageReorder(newOrder: number[]) { setPageOrder(newOrder); }

  function handlePageDelete(originalPageNum: number) {
    if (pageOrder.length <= 1) return;
    const deletedIdx = pageOrder.indexOf(originalPageNum);
    const newOrder   = pageOrder.filter((p) => p !== originalPageNum);
    setPageOrder(newOrder);
    if (currentPage === originalPageNum) {
      setCurrentPage(newOrder[Math.min(deletedIdx, newOrder.length - 1)]);
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
  const [signatureError, setSignatureError] = useState<string | null>(null);

  function showSignatureError(msg: string) {
    setSignatureError(msg);
    setTimeout(() => setSignatureError(null), 4000);
  }

  function handleSignatureUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;

    if (!["image/png", "image/jpeg"].includes(file.type)) {
      showSignatureError("Only PNG and JPG images are supported.");
      return;
    }
    if (file.size > 3 * 1024 * 1024) {
      showSignatureError("Image must be under 3 MB.");
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

      {/* ── Toolbar ─────────────────────────────────────────────────────── */}
      <div className="flex shrink-0 items-center gap-2 border-b border-gray-200 bg-white px-3 py-2 sm:px-4">

        {/* Left: back + title */}
        <div className="flex min-w-0 items-center gap-2 sm:gap-3">
          <Link
            href="/dashboard"
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-700"
            title="Back to dashboard"
          >
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </Link>

          <span
            className="hidden max-w-[120px] truncate text-sm font-semibold text-gray-800 sm:block lg:max-w-[200px]"
            title={document.title}
          >
            {document.title}
          </span>
        </div>

        <div className="hidden h-5 w-px bg-gray-200 sm:block" />

        {/* Centre: annotation tools */}
        <div className="flex items-center gap-1.5">
          <input
            ref={signatureInputRef}
            type="file"
            accept="image/png,image/jpeg"
            className="hidden"
            onChange={handleSignatureUpload}
          />

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
          <div className="relative">
            <button
              onClick={() => signatureInputRef.current?.click()}
              title="Upload signature or image (PNG / JPG, max 3 MB)"
              className="flex h-8 items-center gap-1.5 rounded-md border border-gray-200 bg-white px-2.5 text-xs font-medium text-gray-600 transition-colors hover:bg-gray-50 hover:border-gray-300"
            >
              <svg className="h-3.5 w-3.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                  d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
              <span className="hidden sm:inline">Signature</span>
            </button>

            {/* Inline signature error — appears below the button */}
            {signatureError && (
              <div className="absolute left-0 top-full z-20 mt-1.5 w-56 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700 shadow-sm">
                {signatureError}
              </div>
            )}
          </div>
        </div>

        {/* Right: export + save */}
        <div className="ml-auto flex items-center gap-2">
          <ExportButton status={exportStatus} error={exportError} onClick={exportAnnotatedPdf} />
          <SaveButton   status={saveStatus}   error={saveError}   onClick={() => save(annotations, pageOrder)} />
        </div>
      </div>

      {/* ── Editor body ──────────────────────────────────────────────────── */}
      <div className="flex flex-1 overflow-hidden">

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

          {loadingPdf && <LoadingPane title={document.title} />}
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
// Toolbar action buttons — self-contained state display
// ---------------------------------------------------------------------------

type SaveButtonProps = {
  status: "idle" | "saving" | "saved" | "error";
  error: string | null;
  onClick: () => void;
};

function SaveButton({ status, error, onClick }: SaveButtonProps) {
  return (
    <div className="relative">
      <button
        onClick={onClick}
        disabled={status === "saving"}
        title={error ?? undefined}
        className={cn(
          "flex h-8 items-center gap-1.5 rounded-lg px-3 text-xs font-semibold text-white transition-colors",
          status === "saving" && "cursor-not-allowed bg-indigo-400",
          status === "saved"  && "bg-emerald-500 hover:bg-emerald-600",
          status === "error"  && "bg-red-500 hover:bg-red-600",
          (status === "idle") && "bg-indigo-600 hover:bg-indigo-700",
        )}
      >
        {status === "saving" && <Spinner className="h-3.5 w-3.5 text-white" />}
        {status === "saved"  && <CheckIcon />}
        {status === "error"  && <AlertIcon />}
        <span>
          {status === "saving" ? "Saving…" :
           status === "saved"  ? "Saved"   :
           status === "error"  ? "Save failed" :
           "Save"}
        </span>
      </button>

      {/* Persistent error detail shown below button */}
      {status === "error" && error && (
        <div className="absolute right-0 top-full z-20 mt-1.5 w-64 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700 shadow-sm">
          {error}
        </div>
      )}
    </div>
  );
}

type ExportButtonProps = {
  status: "idle" | "exporting" | "error";
  error: string | null;
  onClick: () => void;
};

function ExportButton({ status, error, onClick }: ExportButtonProps) {
  return (
    <div className="relative">
      <button
        onClick={onClick}
        disabled={status === "exporting"}
        title={error ?? "Export annotated PDF"}
        className={cn(
          "flex h-8 items-center gap-1.5 rounded-lg border px-3 text-xs font-semibold transition-colors",
          status === "exporting" && "cursor-not-allowed border-gray-200 text-gray-400",
          status === "error"     && "border-red-300 bg-red-50 text-red-600 hover:bg-red-100",
          status === "idle"      && "border-gray-200 bg-white text-gray-700 hover:border-gray-300 hover:bg-gray-50",
        )}
      >
        {status === "exporting" ? (
          <Spinner className="h-3.5 w-3.5 text-gray-400" />
        ) : status === "error" ? (
          <AlertIcon />
        ) : (
          <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
              d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
          </svg>
        )}
        <span className="hidden sm:inline">
          {status === "exporting" ? "Exporting…" :
           status === "error"     ? "Export failed" :
           "Export PDF"}
        </span>
      </button>

      {status === "error" && error && (
        <div className="absolute right-0 top-full z-20 mt-1.5 w-64 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700 shadow-sm">
          {error}
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Loading / error states
// ---------------------------------------------------------------------------

function LoadingPane({ title }: { title: string }) {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-5 bg-gray-100">
      <div className="relative flex h-16 w-16 items-center justify-center rounded-2xl bg-white shadow-md">
        {/* PDF icon */}
        <svg className="h-8 w-8 text-indigo-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
            d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
        </svg>
        {/* Spinner in corner */}
        <span className="absolute -right-1.5 -bottom-1.5 flex h-6 w-6 items-center justify-center rounded-full bg-indigo-600 shadow">
          <Spinner className="h-3.5 w-3.5 text-white" />
        </span>
      </div>

      <div className="text-center">
        <p className="text-sm font-semibold text-gray-700">
          Opening <span className="text-indigo-600">{title}</span>
        </p>
        <p className="mt-1 text-xs text-gray-400">Loading pages…</p>
      </div>
    </div>
  );
}

function ErrorPane({ message }: { message: string }) {
  const { heading, detail } = parsePdfError(message);

  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-6 bg-gray-100 px-6">
      <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-red-100">
        <svg className="h-7 w-7 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
            d="M12 9v2m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
        </svg>
      </div>

      <div className="max-w-sm text-center">
        <p className="text-sm font-semibold text-gray-800">{heading}</p>
        <p className="mt-1.5 text-xs leading-relaxed text-gray-500">{detail}</p>
      </div>

      <div className="flex gap-3">
        <Link
          href="/dashboard"
          className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-xs font-semibold text-gray-700 transition-colors hover:bg-gray-50"
        >
          Back to dashboard
        </Link>
        <button
          onClick={() => window.location.reload()}
          className="rounded-lg bg-indigo-600 px-4 py-2 text-xs font-semibold text-white transition-colors hover:bg-indigo-700"
        >
          Reload
        </button>
      </div>
    </div>
  );
}

function parsePdfError(raw: string): { heading: string; detail: string } {
  const lower = raw.toLowerCase();
  if (lower.includes("fetch") || lower.includes("network") || lower.includes("failed to fetch")) {
    return {
      heading: "Could not load the PDF",
      detail: "A network error occurred. Check your connection and try reloading.",
    };
  }
  if (lower.includes("invalidpdf") || lower.includes("invalid pdf") || lower.includes("missing pdf")) {
    return {
      heading: "Invalid PDF file",
      detail: "The file may be corrupted or saved in an unsupported format.",
    };
  }
  if (lower.includes("password") || lower.includes("passwordexception")) {
    return {
      heading: "PDF is password protected",
      detail: "Remove the password in another application, then re-upload.",
    };
  }
  if (lower.includes("404") || lower.includes("not found")) {
    return {
      heading: "File not found",
      detail: "The PDF may have been moved or deleted from storage.",
    };
  }
  return {
    heading: "Could not load the PDF",
    detail: raw.length > 120 ? raw.slice(0, 120) + "…" : raw,
  };
}

// ---------------------------------------------------------------------------
// Tiny icon helpers
// ---------------------------------------------------------------------------

function CheckIcon() {
  return (
    <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
    </svg>
  );
}

function AlertIcon() {
  return (
    <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01" />
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
        d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
    </svg>
  );
}
