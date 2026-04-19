import { cn } from "@/lib/utils";
import type { Annotation } from "@/types";

type Props = {
  annotations: Annotation[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  onDelete: (id: string) => void;
};

/**
 * Right-hand panel listing all annotations on the current page.
 * Only rendered on large screens (lg:flex).
 */
export default function AnnotationsSidebar({
  annotations,
  selectedId,
  onSelect,
  onDelete,
}: Props) {
  return (
    <aside className="hidden w-52 shrink-0 flex-col border-l border-gray-200 bg-white lg:flex">
      <div className="border-b border-gray-200 px-3 py-2.5">
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
        {annotations.length === 0 ? (
          <p className="mt-6 text-center text-xs text-gray-400">
            No annotations on this page.
          </p>
        ) : (
          annotations.map((ann) => (
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
                <span className="font-medium capitalize">
                  {ann.type === "text-replace" ? "Text Edit" : ann.type}
                </span>
                {(ann.type === "text" || ann.type === "text-replace") && ann.text && (
                  <p className="mt-0.5 truncate text-gray-400">{ann.text}</p>
                )}
              </div>
              <button
                onClick={(e) => { e.stopPropagation(); onDelete(ann.id); }}
                title="Delete annotation"
                className="ml-1 shrink-0 rounded p-0.5 text-gray-300 opacity-0 transition-opacity hover:bg-red-50 hover:text-red-500 group-hover:opacity-100"
              >
                <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          ))
        )}
      </div>

      {annotations.length > 0 && (
        <div className="border-t border-gray-100 px-3 py-2 text-[10px] text-gray-400">
          Delete / Backspace removes selected
        </div>
      )}
    </aside>
  );
}
