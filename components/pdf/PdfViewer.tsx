import type { PDFDocumentProxy } from "pdfjs-dist";
import AnnotatedPage from "@/components/annotations/AnnotatedPage";
import type { Annotation, EditorTool } from "@/types";

type Props = {
  pdf: PDFDocumentProxy;
  pageNumber: number;
  scale: number;
  annotations: Annotation[];
  activeTool: EditorTool;
  selectedId: string | null;
  onAnnotationCreate: (ann: Annotation) => void;
  onAnnotationUpdate: (id: string, updates: Partial<Annotation>) => void;
  onAnnotationSelect: (id: string | null) => void;
};

/**
 * Scrollable canvas viewport.
 * State is owned by EditorShell; this component is purely presentational.
 */
export default function PdfViewer({
  pdf,
  pageNumber,
  scale,
  annotations,
  activeTool,
  selectedId,
  onAnnotationCreate,
  onAnnotationUpdate,
  onAnnotationSelect,
}: Props) {
  // Filter to only show annotations belonging to the current page
  const pageAnnotations = annotations.filter((a) => a.page === pageNumber);

  return (
    <div className="h-full overflow-auto bg-gray-200">
      <div className="flex min-h-full items-start justify-center p-8">
        <AnnotatedPage
          pdf={pdf}
          pageNumber={pageNumber}
          scale={scale}
          annotations={pageAnnotations}
          activeTool={activeTool}
          selectedId={selectedId}
          onAnnotationCreate={onAnnotationCreate}
          onAnnotationUpdate={onAnnotationUpdate}
          onAnnotationSelect={onAnnotationSelect}
        />
      </div>
    </div>
  );
}
