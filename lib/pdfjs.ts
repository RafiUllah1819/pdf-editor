/**
 * PDF.js initialisation helper.
 * All pdfjs-dist usage goes through this file so the worker is configured
 * exactly once and only ever in the browser.
 */

import type { PDFDocumentProxy } from "pdfjs-dist";

let workerConfigured = false;

async function getPdfjsLib() {
  const pdfjsLib = await import("pdfjs-dist");
  if (!workerConfigured) {
    pdfjsLib.GlobalWorkerOptions.workerSrc = "/pdf.worker.min.mjs";
    workerConfigured = true;
  }
  return pdfjsLib;
}

/**
 * Load a PDF from a URL and return the PDFDocumentProxy.
 * Must be called in a browser context.
 * Caller is responsible for calling doc.destroy() on cleanup.
 */
export async function loadPdf(url: string): Promise<PDFDocumentProxy> {
  const pdfjsLib = await getPdfjsLib();
  return pdfjsLib.getDocument(url).promise;
}
