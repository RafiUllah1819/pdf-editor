// ---------------------------------------------------------------------------
// Domain types — shared across client and server
// All names are camelCase; the repository layer maps from DB snake_case.
// ---------------------------------------------------------------------------

export type Document = {
  id: string;
  title: string;
  originalName: string;
  filePath: string;
  fileSize: number;      // bytes
  pageCount: number;
  createdAt: string;     // ISO string
  updatedAt: string;
};

export type AnnotationType = "text" | "highlight" | "rect" | "arrow" | "image";

export type Annotation = {
  id: string;
  documentId: string;
  page: number;
  type: AnnotationType;
  // Stored at scale=1.0, origin top-left (PDF.js coordinate space).
  // For pdf-lib export: pdfLibY = pageHeight - y - height
  x: number;
  y: number;
  width: number;
  height: number;
  text?: string;         // text annotations
  fontSize?: number;     // pt, at scale=1.0
  color?: string;        // hex
  opacity?: number;      // 0–1
  // Image / signature annotations
  // Stored as a base64 data URL so pdf-lib can embed it directly on export.
  src?: string;
};

export type EditorState = {
  id: string;
  documentId: string;
  annotations: Annotation[];
  pageOrder: number[];
  createdAt: string;
  updatedAt: string;
};

export type PageData = {
  pageNumber: number;
  width: number;
  height: number;
  imageDataUrl: string;
};

export type EditorTool = "select" | "text" | "highlight";

// Client-only editor UI state
export type EditorUIState = {
  documentId: string;
  currentPage: number;
  totalPages: number;
  zoom: number;
  activeTool: EditorTool;
  isDirty: boolean;
};
