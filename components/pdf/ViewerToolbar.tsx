import { cn } from "@/lib/utils";

type Props = {
  currentPage: number;
  totalPages: number;
  scale: number;
  onPageChange: (page: number) => void;
  onZoomIn: () => void;
  onZoomOut: () => void;
  onZoomReset: () => void;
  minScale: number;
  maxScale: number;
};

export default function ViewerToolbar({
  currentPage,
  totalPages,
  scale,
  onPageChange,
  onZoomIn,
  onZoomOut,
  onZoomReset,
  minScale,
  maxScale,
}: Props) {
  return (
    <div className="flex shrink-0 items-center justify-between border-b border-gray-200 bg-white px-3 py-1.5 text-gray-700">

      {/* Page navigation */}
      <div className="flex items-center gap-0.5">
        <IconButton
          onClick={() => onPageChange(currentPage - 1)}
          disabled={currentPage <= 1}
          title="Previous page"
        >
          <ChevronLeft />
        </IconButton>

        <div className="flex items-center gap-1.5 px-1 text-xs">
          <input
            type="number"
            min={1}
            max={totalPages}
            value={currentPage}
            onChange={(e) => {
              const v = parseInt(e.target.value, 10);
              if (!isNaN(v)) onPageChange(v);
            }}
            className="w-9 rounded border border-gray-200 px-1 py-0.5 text-center text-xs focus:border-indigo-400 focus:outline-none"
          />
          <span className="text-gray-400">/</span>
          <span className="tabular-nums text-gray-600">{totalPages}</span>
        </div>

        <IconButton
          onClick={() => onPageChange(currentPage + 1)}
          disabled={currentPage >= totalPages}
          title="Next page"
        >
          <ChevronRight />
        </IconButton>
      </div>

      {/* Zoom controls */}
      <div className="flex items-center gap-0.5">
        <IconButton onClick={onZoomOut} disabled={scale <= minScale} title="Zoom out (−)">
          <ZoomOut />
        </IconButton>

        <button
          onClick={onZoomReset}
          title="Reset zoom"
          className="min-w-[52px] rounded px-2 py-1 text-center text-xs font-medium text-gray-600 hover:bg-gray-100 transition-colors"
        >
          {Math.round(scale * 100)}%
        </button>

        <IconButton onClick={onZoomIn} disabled={scale >= maxScale} title="Zoom in (+)">
          <ZoomIn />
        </IconButton>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Local helpers
// ---------------------------------------------------------------------------

function IconButton({
  onClick,
  disabled,
  title,
  children,
}: {
  onClick: () => void;
  disabled?: boolean;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      title={title}
      className={cn(
        "flex h-7 w-7 items-center justify-center rounded text-gray-600 transition-colors",
        "hover:bg-gray-100 disabled:cursor-not-allowed disabled:opacity-30"
      )}
    >
      {children}
    </button>
  );
}

function ChevronLeft() {
  return (
    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
    </svg>
  );
}

function ChevronRight() {
  return (
    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
    </svg>
  );
}

function ZoomOut() {
  return (
    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
        d="M21 21l-4.35-4.35M17 11A6 6 0 115 11a6 6 0 0112 0zm-6 0H8" />
    </svg>
  );
}

function ZoomIn() {
  return (
    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
        d="M21 21l-4.35-4.35M17 11A6 6 0 115 11a6 6 0 0112 0zm-6-3v6m-3-3h6" />
    </svg>
  );
}
