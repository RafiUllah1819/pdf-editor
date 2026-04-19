import { useEffect, useRef, useState } from "react";
import type { PDFDocumentProxy } from "pdfjs-dist";
import PageCanvas from "./PageCanvas";
import { cn } from "@/lib/utils";

type Props = {
  pdf: PDFDocumentProxy;
  /** Ordered list of original 1-based page numbers in display order. */
  pageOrder: number[];
  /** The original page number of the currently-viewed page. */
  currentPage: number;
  onPageChange: (originalPageNum: number) => void;
  onReorder: (newOrder: number[]) => void;
  onDelete: (originalPageNum: number) => void;
};

export default function ThumbnailSidebar({
  pdf,
  pageOrder,
  currentPage,
  onPageChange,
  onReorder,
  onDelete,
}: Props) {
  const activeRef = useRef<HTMLDivElement>(null);

  // HTML5 drag-and-drop state
  const draggingIdx = useRef<number | null>(null);
  const [dragOverIdx, setDragOverIdx] = useState<number | null>(null);

  // Scroll the active thumbnail into view whenever currentPage changes
  useEffect(() => {
    activeRef.current?.scrollIntoView({ block: "nearest", behavior: "smooth" });
  }, [currentPage]);

  function handleDragStart(displayIdx: number) {
    draggingIdx.current = displayIdx;
  }

  function handleDragOver(e: React.DragEvent, displayIdx: number) {
    e.preventDefault();
    if (draggingIdx.current !== null && draggingIdx.current !== displayIdx) {
      setDragOverIdx(displayIdx);
    }
  }

  function handleDrop(targetIdx: number) {
    const fromIdx = draggingIdx.current;
    if (fromIdx === null || fromIdx === targetIdx) {
      setDragOverIdx(null);
      return;
    }
    const newOrder = [...pageOrder];
    const [moved] = newOrder.splice(fromIdx, 1);
    newOrder.splice(targetIdx, 0, moved);
    onReorder(newOrder);
    setDragOverIdx(null);
    draggingIdx.current = null;
  }

  function handleDragEnd() {
    draggingIdx.current = null;
    setDragOverIdx(null);
  }

  return (
    <aside className="flex w-44 shrink-0 flex-col border-r border-gray-200 bg-gray-50">
      <div className="border-b border-gray-200 px-3 py-2">
        <span className="text-xs font-semibold uppercase tracking-wide text-gray-400">
          Pages
        </span>
      </div>

      <div className="flex-1 overflow-y-auto py-2">
        {pageOrder.map((originalPage, displayIdx) => {
          const isActive = originalPage === currentPage;
          const isDropTarget = dragOverIdx === displayIdx;

          return (
            <div
              key={originalPage}
              ref={isActive ? activeRef : null}
              draggable
              onDragStart={() => handleDragStart(displayIdx)}
              onDragOver={(e) => handleDragOver(e, displayIdx)}
              onDrop={() => handleDrop(displayIdx)}
              onDragEnd={handleDragEnd}
              className={cn(
                "group relative flex w-full flex-col items-center gap-1.5 px-3 py-2 transition-colors cursor-grab active:cursor-grabbing select-none",
                isActive ? "bg-indigo-50" : "hover:bg-gray-100",
                isDropTarget && "border-t-2 border-indigo-400"
              )}
            >
              {/* Page canvas */}
              <div
                onClick={() => onPageChange(originalPage)}
                className={cn(
                  "overflow-hidden rounded border-2 transition-colors w-full",
                  isActive
                    ? "border-indigo-500 shadow-sm"
                    : "border-transparent group-hover:border-gray-300"
                )}
                style={{ maxWidth: 120 }}
              >
                <ThumbnailCanvas pdf={pdf} pageNumber={originalPage} />
              </div>

              {/* Display index label */}
              <span
                className={cn(
                  "text-[11px] font-medium leading-none",
                  isActive ? "text-indigo-600" : "text-gray-400"
                )}
              >
                {displayIdx + 1}
              </span>

              {/* Delete button — fades in on group hover, hidden when only 1 page remains */}
              {pageOrder.length > 1 && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onDelete(originalPage);
                  }}
                  title="Remove this page from the document"
                  className="absolute right-1 top-1 rounded p-0.5 text-gray-400 opacity-0 transition-opacity hover:bg-red-50 hover:text-red-500 group-hover:opacity-100"
                >
                  <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              )}
            </div>
          );
        })}
      </div>
    </aside>
  );
}

// ---------------------------------------------------------------------------
// ThumbnailCanvas — lazy: only renders once the element enters the viewport
// ---------------------------------------------------------------------------

const THUMBNAIL_SCALE = 0.18;

function ThumbnailCanvas({
  pdf,
  pageNumber,
}: {
  pdf: PDFDocumentProxy;
  pageNumber: number;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setVisible(true);
          observer.disconnect();
        }
      },
      { threshold: 0.1 }
    );

    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  return (
    <div ref={containerRef}>
      {visible ? (
        <PageCanvas pdf={pdf} pageNumber={pageNumber} scale={THUMBNAIL_SCALE} />
      ) : (
        <div className="h-24 w-[108px] animate-pulse bg-gray-200" />
      )}
    </div>
  );
}
