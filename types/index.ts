// ---------------------------------------------------------------------------
// Domain types — shared across client and server
// All names are camelCase; the repository layer maps from DB snake_case.
// ---------------------------------------------------------------------------

export type Document = {
  id: string;
  title: string;
  originalName: string;
  filePath: string;         // storage key of the original upload; never changes
  fileSize: number;         // bytes
  pageCount: number;
  latestVersionNum: number; // mirrors max(document_versions.version_num); 1 = only original
  createdAt: string;        // ISO string
  updatedAt: string;
};

export type DocumentVersion = {
  id: string;
  documentId: string;
  versionNum: number;
  filePath: string;
  fileSize: number;
  label?: string;
  createdAt: string;
};

export type AnnotationType = "text" | "highlight" | "rect" | "arrow" | "image" | "draw" | "text-replace";

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
  originalText?: string; // original PDF text (text-replace annotations)
  fontSize?: number;     // pt, at scale=1.0
  color?: string;        // hex
  opacity?: number;      // 0–1
  // Image / signature annotations
  // Stored as a base64 data URL so pdf-lib can embed it directly on export.
  src?: string;
  // Freehand draw annotations — flat [x1,y1,x2,y2,...] at scale=1.0
  points?: number[];
  strokeWidth?: number; // pt at scale=1.0
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

export type EditorTool = "select" | "text" | "highlight" | "draw";
