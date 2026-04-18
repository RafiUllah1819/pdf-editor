// PDF rendering (PDF.js) and modification (pdf-lib) utilities.
// All heavy imports are done inside functions so they are only loaded client-side
// or in the relevant API route — never at module initialisation time.

import type { PageData } from "@/types";

/**
 * Render a single PDF page to a base64 PNG data URL via PDF.js.
 * Must be called in a browser context (window must exist).
 */
export async function renderPageToDataUrl(
  pdfUrl: string,
  pageNumber: number,
  scale = 1.5
): Promise<PageData> {
  // Dynamic import keeps PDF.js out of the server bundle
  const pdfjsLib = await import("pdfjs-dist");
  pdfjsLib.GlobalWorkerOptions.workerSrc = "/pdf.worker.min.mjs";

  const pdf = await pdfjsLib.getDocument(pdfUrl).promise;
  const page = await pdf.getPage(pageNumber);
  const viewport = page.getViewport({ scale });

  const canvas = document.createElement("canvas");
  canvas.width = viewport.width;
  canvas.height = viewport.height;

  await page.render({
    canvasContext: canvas.getContext("2d") as CanvasRenderingContext2D,
    viewport,
    canvas,
  }).promise;

  return {
    pageNumber,
    width: viewport.width,
    height: viewport.height,
    imageDataUrl: canvas.toDataURL("image/png"),
  };
}

/**
 * Returns the total page count for a PDF accessible at pdfUrl.
 * Must be called in a browser context.
 */
export async function getPdfPageCount(pdfUrl: string): Promise<number> {
  const pdfjsLib = await import("pdfjs-dist");
  pdfjsLib.GlobalWorkerOptions.workerSrc = "/pdf.worker.min.mjs";
  const pdf = await pdfjsLib.getDocument(pdfUrl).promise;
  return pdf.numPages;
}

/** Returns the filename without the .pdf extension. */
export function stripPdfExtension(filename: string): string {
  return filename.replace(/\.pdf$/i, "");
}
