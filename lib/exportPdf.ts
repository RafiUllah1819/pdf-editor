/**
 * PDF export — applies saved annotations onto the original PDF using pdf-lib.
 *
 * Coordinate conversion
 * ─────────────────────
 * Annotations are stored in PDF.js coordinate space (scale=1.0):
 *   • Origin: top-left of page
 *   • Y increases downward
 *   • Units: PDF points (identical to pdf-lib's point unit at scale=1.0)
 *
 * pdf-lib coordinate space:
 *   • Origin: bottom-left of page
 *   • Y increases upward
 *   • Units: PDF points
 *
 * Conversion for a rect with top-left at (ann.x, ann.y) and size (ann.width, ann.height):
 *   pdfX = ann.x
 *   pdfY = pageHeight - ann.y - ann.height      ← flip axis, move origin
 *
 * For text the y is the baseline. Baseline ≈ ann.y + fontSize from the top, so:
 *   pdfY = pageHeight - ann.y - ann.fontSize
 *
 * Page order
 * ──────────
 * pageOrder is an array of original 1-based page numbers in display/export order.
 * E.g. [3,1,2] means output page 1 = original PDF page 3, etc.
 * Pages absent from pageOrder are omitted from the output (deleted pages).
 * If pageOrder is empty the full original document order is used.
 */

import { PDFDocument, rgb, StandardFonts } from "pdf-lib";
import type { Annotation } from "@/types";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Parse a 6-digit hex colour to pdf-lib's 0–1 RGB components. */
function hexToRgb(hex: string): { r: number; g: number; b: number } {
  const clean = hex.replace("#", "").padEnd(6, "0");
  return {
    r: parseInt(clean.slice(0, 2), 16) / 255,
    g: parseInt(clean.slice(2, 4), 16) / 255,
    b: parseInt(clean.slice(4, 6), 16) / 255,
  };
}

/** Extract raw bytes from a base64 data URL (data:image/png;base64,…). */
function dataUrlToBytes(dataUrl: string): { bytes: Uint8Array; mime: string } {
  const [prefix, b64] = dataUrl.split(",");
  const mime = prefix.replace("data:", "").replace(";base64", "");
  const bytes = Uint8Array.from(Buffer.from(b64, "base64"));
  return { bytes, mime };
}

// ---------------------------------------------------------------------------
// Per-type annotation writers
// ---------------------------------------------------------------------------

function applyHighlight(
  page: import("pdf-lib").PDFPage,
  ann: Annotation,
  pageHeight: number
) {
  const { r, g, b } = hexToRgb(ann.color ?? "#FFFF00");
  page.drawRectangle({
    x: ann.x,
    y: pageHeight - ann.y - ann.height,
    width: ann.width,
    height: ann.height,
    color: rgb(r, g, b),
    opacity: ann.opacity ?? 0.4,
  });
}

function applyText(
  page: import("pdf-lib").PDFPage,
  ann: Annotation,
  pageHeight: number,
  font: import("pdf-lib").PDFFont
) {
  const fontSize = ann.fontSize ?? 14;
  const { r, g, b } = hexToRgb(ann.color ?? "#111827");
  const lines = (ann.text ?? "").split("\n");
  const lineHeight = fontSize * 1.4;

  lines.forEach((line, i) => {
    if (!line) return;
    page.drawText(line, {
      x: ann.x,
      y: pageHeight - ann.y - fontSize - i * lineHeight,
      size: fontSize,
      font,
      color: rgb(r, g, b),
      opacity: ann.opacity ?? 1,
      maxWidth: ann.width,
    });
  });
}

async function applyImage(
  pdfDoc: PDFDocument,
  page: import("pdf-lib").PDFPage,
  ann: Annotation,
  pageHeight: number
) {
  if (!ann.src) return;
  const { bytes, mime } = dataUrlToBytes(ann.src);

  const image =
    mime === "image/png"
      ? await pdfDoc.embedPng(bytes)
      : await pdfDoc.embedJpg(bytes);

  page.drawImage(image, {
    x: ann.x,
    y: pageHeight - ann.y - ann.height,
    width: ann.width,
    height: ann.height,
    opacity: ann.opacity ?? 1,
  });
}

// ---------------------------------------------------------------------------
// Main export function
// ---------------------------------------------------------------------------

/**
 * Build an annotated PDF from the source bytes.
 *
 * @param sourcePdfBytes  Raw bytes of the original uploaded PDF.
 * @param annotations     Saved annotations (all pages) at scale=1.0.
 * @param pageOrder       1-based original page numbers in desired output order.
 *                        An empty array means "use original order, all pages".
 */
export async function exportPdf(
  sourcePdfBytes: Buffer,
  annotations: Annotation[],
  pageOrder: number[] = []
): Promise<Uint8Array> {
  const sourcePdf = await PDFDocument.load(sourcePdfBytes);
  const totalOriginalPages = sourcePdf.getPageCount();

  // Fall back to natural order when nothing has been customised
  const effectiveOrder =
    pageOrder.length > 0
      ? pageOrder
      : Array.from({ length: totalOriginalPages }, (_, i) => i + 1);

  // Build output document: copy source pages in display order
  const outputPdf = await PDFDocument.create();
  const sourceIndices = effectiveOrder.map((p) => p - 1); // 0-based
  const copiedPages = await outputPdf.copyPages(sourcePdf, sourceIndices);
  copiedPages.forEach((page) => outputPdf.addPage(page));

  const font = await outputPdf.embedFont(StandardFonts.Helvetica);
  const outputPages = outputPdf.getPages();

  // Build a lookup: original page number → index in the output document
  const origToOutputIdx = new Map<number, number>();
  effectiveOrder.forEach((origPage, outputIdx) => {
    origToOutputIdx.set(origPage, outputIdx);
  });

  for (const ann of annotations) {
    const outputIdx = origToOutputIdx.get(ann.page);
    if (outputIdx === undefined) continue; // page was deleted — skip annotation

    const page = outputPages[outputIdx];
    const { height: pageHeight } = page.getSize();

    switch (ann.type) {
      case "highlight":
        applyHighlight(page, ann, pageHeight);
        break;
      case "text":
        applyText(page, ann, pageHeight, font);
        break;
      case "image":
        await applyImage(outputPdf, page, ann, pageHeight);
        break;
      // rect / arrow: not yet implemented — skip gracefully
    }
  }

  return outputPdf.save();
}
