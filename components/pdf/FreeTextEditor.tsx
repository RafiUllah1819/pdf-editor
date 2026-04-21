import { useEffect, useRef, useState, useCallback } from "react";
import Link from "next/link";

// ── Types ─────────────────────────────────────────────────────────────────────

type RawItem = {
  str: string;
  transform: number[]; // [sx, kx, ky, sy, tx, ty]
  width: number;
  height: number;
  fontName: string;
};

type Edit = {
  id: string;
  pageNum: number;
  // Screen position (px) — for overlay
  sx: number; sy: number; sw: number; sh: number;
  // PDF position (pt) — for pdf-lib export
  px: number; py: number; pw: number; ph: number;
  fontSize: number; // PDF points
  fontName: string; // raw PDF font name e.g. "ABCDEF+Arial-BoldMT"
  originalText: string;
  text: string;
};

// ── Constants ─────────────────────────────────────────────────────────────────

const SCALE = 1.5;
const HIT_PAD = 6;

// ── Font detection ────────────────────────────────────────────────────────────

// PDF font names look like "ABCDEF+TimesNewRoman-BoldItalic" or "Helvetica"
function normFont(name: string) {
  return name.replace(/^[A-Z]{6}\+/, "").toLowerCase();
}

function isBold(name: string)    { const n = normFont(name); return n.includes("bold") || n.includes("heavy") || n.includes("black"); }
function isItalic(name: string)  { const n = normFont(name); return n.includes("italic") || n.includes("oblique"); }
function isSerif(name: string)   { const n = normFont(name); return n.includes("times") || n.includes("georgia") || n.includes("palatino") || n.includes("garamond") || n.includes("serif"); }
function isMono(name: string)    { const n = normFont(name); return n.includes("courier") || n.includes("mono") || n.includes("consol") || n.includes("code"); }

/** CSS font-family string derived from the PDF font name */
export function cssFontFamily(fontName: string): string {
  if (isMono(fontName))  return "Courier New, Courier, monospace";
  if (isSerif(fontName)) return "Times New Roman, Times, serif";
  return "Arial, Helvetica, sans-serif";
}

/** CSS font-weight */
export function cssFontWeight(fontName: string): string {
  return isBold(fontName) ? "bold" : "normal";
}

/** CSS font-style */
export function cssFontStyle(fontName: string): string {
  return isItalic(fontName) ? "italic" : "normal";
}

/** Closest pdf-lib StandardFont for this PDF font */
async function pdfLibFont(fontName: string, doc: { embedFont: (f: string) => Promise<unknown> }) {
  const { StandardFonts } = await import("pdf-lib");
  const bold   = isBold(fontName);
  const italic = isItalic(fontName);
  const mono   = isMono(fontName);
  const serif  = isSerif(fontName);

  let key: string;
  if (mono)        key = bold ? StandardFonts.CourierBold : italic ? StandardFonts.CourierOblique : StandardFonts.Courier;
  else if (serif)  key = bold ? (italic ? StandardFonts.TimesRomanBoldItalic : StandardFonts.TimesRomanBold)
                               : (italic ? StandardFonts.TimesRomanItalic     : StandardFonts.TimesRoman);
  else             key = bold ? (italic ? StandardFonts.HelveticaBoldOblique  : StandardFonts.HelveticaBold)
                               : (italic ? StandardFonts.HelveticaOblique      : StandardFonts.Helvetica);

  return doc.embedFont(key);
}

// ── Utilities ─────────────────────────────────────────────────────────────────

function uid() {
  return Math.random().toString(36).slice(2, 9);
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function hitTest(cx: number, cy: number, items: RawItem[], vp: any): RawItem | null {
  for (const item of items) {
    if (!item.str.trim()) continue;
    const [sx, sy] = vp.convertToViewportPoint(item.transform[4], item.transform[5]);
    const fs = Math.abs(item.transform[3]) * SCALE;
    // item.width is already in PDF points — multiply by SCALE for screen pixels
    const sw = item.width * SCALE;
    if (
      cx >= sx - HIT_PAD && cx <= sx + sw + HIT_PAD &&
      cy >= sy - fs - HIT_PAD && cy <= sy + fs * 0.3 + HIT_PAD
    ) return item;
  }
  return null;
}

// CSS font-size correction: PDF glyph heights don't map 1-to-1 with CSS font-size
// because CSS includes descender space. 0.88 gives the closest visual match.
const FONT_SCALE = 0.905;
// Vertical offset to align overlay with the rendered PDF text baseline
const OVERLAY_MARGIN_TOP = 6;
// Font size reduction applied when drawing text into the exported PDF (in points)
const PDF_FONT_REDUCE = 1.5;

// ── Auto-growing input ────────────────────────────────────────────────────────

function AutoInput({
  edit,
  onTextChange,
  onBlur,
}: {
  edit: Edit;
  onTextChange: (id: string, text: string) => void;
  onBlur: () => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const measureRef = useRef<HTMLSpanElement>(null);
  const cssFontSize = edit.fontSize * SCALE * FONT_SCALE;

  // Sync input width to measured text width
  const syncWidth = useCallback(() => {
    if (inputRef.current && measureRef.current) {
      const measured = measureRef.current.offsetWidth;
      inputRef.current.style.width = Math.max(measured + 8, edit.sw) + "px";
    }
  }, [edit.sw]);

  useEffect(() => { syncWidth(); }, [edit.text, syncWidth]);

  return (
    <div style={{ position: "relative", display: "inline-block", minWidth: edit.sw }}>
      {/* Hidden span used to measure text width */}
      <span
        ref={measureRef}
        aria-hidden
        style={{
          position: "absolute", visibility: "hidden", whiteSpace: "nowrap",
          fontSize: cssFontSize,
          fontFamily: cssFontFamily(edit.fontName),
          fontWeight: cssFontWeight(edit.fontName),
          fontStyle: cssFontStyle(edit.fontName),
          pointerEvents: "none",
        }}
      >
        {edit.text || " "}
      </span>
      <input
        ref={inputRef}
        autoFocus
        value={edit.text}
        onChange={e => { onTextChange(edit.id, e.target.value); syncWidth(); }}
        onBlur={onBlur}
        onKeyDown={e => { if (e.key === "Escape" || e.key === "Enter") onBlur(); }}
        style={{
          height: cssFontSize * 1.32,
          marginTop: OVERLAY_MARGIN_TOP,
          minWidth: edit.sw,
          padding: "0 2px",
          fontSize: cssFontSize,
          fontFamily: cssFontFamily(edit.fontName),
          fontWeight: cssFontWeight(edit.fontName),
          fontStyle: cssFontStyle(edit.fontName),
          background: "white",
          border: "2px solid #6366f1",
          outline: "none",
          lineHeight: 1,
          boxSizing: "border-box",
          whiteSpace: "nowrap",
          display: "block",
        }}
      />
    </div>
  );
}

// ── Per-page component ────────────────────────────────────────────────────────

type PageProps = {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  pdfDoc: any;
  pageNum: number;
  edits: Edit[];
  activeId: string | null;
  onPageClick: (e: React.MouseEvent<HTMLDivElement>, pageNum: number, vp: unknown, items: RawItem[]) => void;
  onTextChange: (id: string, text: string) => void;
  onBlur: () => void;
  onFocus: (id: string) => void;
};

function PdfPage({ pdfDoc, pageNum, edits, activeId, onPageClick, onTextChange, onBlur, onFocus }: PageProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [viewport, setViewport] = useState<any>(null);
  const [items, setItems] = useState<RawItem[]>([]);
  const [size, setSize] = useState({ w: 0, h: 0 });

  useEffect(() => {
    let cancelled = false;
    async function render() {
      const page = await pdfDoc.getPage(pageNum);
      const vp = page.getViewport({ scale: SCALE });
      const tc = await page.getTextContent();
      if (cancelled) return;
      setViewport(vp);
      setItems(tc.items as RawItem[]);
      setSize({ w: Math.floor(vp.width), h: Math.floor(vp.height) });
      if (canvasRef.current) {
        canvasRef.current.width = vp.width;
        canvasRef.current.height = vp.height;
        const ctx = canvasRef.current.getContext("2d")!;
        await page.render({ canvasContext: ctx, viewport: vp }).promise;
      }
    }
    render().catch(console.error);
    return () => { cancelled = true; };
  }, [pdfDoc, pageNum]);

  const pageEdits = edits.filter(e => e.pageNum === pageNum);

  return (
    <div
      className="relative mx-auto mb-6 shadow-lg bg-white"
      style={{ width: size.w || "auto", height: size.h || "auto" }}
    >
      <canvas ref={canvasRef} className="absolute inset-0 block" />

      {/* Invisible click layer */}
      {viewport && (
        <div
          className="absolute inset-0 cursor-text"
          onClick={(e) => onPageClick(e, pageNum, viewport, items)}
        />
      )}

      {/* Edit overlays */}
      {pageEdits.map(edit => (
        <div
          key={edit.id}
          style={{ position: "absolute", left: edit.sx, top: edit.sy, width: Math.max(edit.sw, 60), height: edit.sh, zIndex: 10 }}
        >
          {activeId === edit.id ? (
            // Active: auto-growing input covers original text
            <AutoInput edit={edit} onTextChange={onTextChange} onBlur={onBlur} />
          ) : edit.text !== edit.originalText ? (
            // Changed: white box with new text covers the original PDF text
            <div
              onClick={e => { e.stopPropagation(); onFocus(edit.id); }}
              style={{
                height: edit.fontSize * SCALE * FONT_SCALE * 1.32,
                marginTop: OVERLAY_MARGIN_TOP,
                minWidth: edit.sw,
                fontSize: edit.fontSize * SCALE * FONT_SCALE,
                fontFamily: cssFontFamily(edit.fontName),
                fontWeight: cssFontWeight(edit.fontName),
                fontStyle: cssFontStyle(edit.fontName),
                background: "white",
                border: "1px solid #a5b4fc",
                cursor: "text",
                lineHeight: 1,
                whiteSpace: "nowrap",
                padding: "0 2px",
                display: "inline-block",
                boxSizing: "border-box",
              }}
            >
              {edit.text}
            </div>
          ) : (
            // Unchanged: transparent click target — PDF text shows through
            <div
              onClick={e => { e.stopPropagation(); onFocus(edit.id); }}
              style={{ width: "100%", height: "100%", background: "transparent", cursor: "text" }}
            />
          )}
        </div>
      ))}
    </div>
  );
}

// ── Main editor ───────────────────────────────────────────────────────────────

type Props = { documentId: string; pdfUrl: string; title: string };

export default function FreeTextEditor({ documentId, pdfUrl, title }: Props) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [pdfDoc, setPdfDoc] = useState<any>(null);
  const [numPages, setNumPages] = useState(0);
  const [edits, setEdits] = useState<Edit[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [saveStatus, setSaveStatus] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [downloading, setDownloading] = useState(false);
  const pdfBytesRef = useRef<ArrayBuffer | null>(null);

  // ── Load PDF.js + fetch bytes ──────────────────────────────────────────────

  useEffect(() => {
    let cancelled = false;
    async function load() {
      const pdfjs = await import("pdfjs-dist");
      pdfjs.GlobalWorkerOptions.workerSrc = "/pdf.worker.min.mjs";
      const res = await fetch(pdfUrl);
      const bytes = await res.arrayBuffer();
      if (cancelled) return;
      pdfBytesRef.current = bytes;
      const doc = await pdfjs.getDocument({ data: bytes.slice(0) }).promise;
      if (cancelled) return;
      setPdfDoc(doc);
      setNumPages(doc.numPages);
    }
    load().catch(console.error);
    return () => { cancelled = true; };
  }, [pdfUrl]);

  // ── Click handler ─────────────────────────────────────────────────────────

  const handlePageClick = useCallback((
    e: React.MouseEvent<HTMLDivElement>,
    pageNum: number,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    viewport: any,
    items: RawItem[],
  ) => {
    setActiveId(null);
    const rect = e.currentTarget.getBoundingClientRect();
    const cx = e.clientX - rect.left;
    const cy = e.clientY - rect.top;
    const item = hitTest(cx, cy, items, viewport);
    if (!item?.str.trim()) return;

    const [sx, sy] = viewport.convertToViewportPoint(item.transform[4], item.transform[5]);
    const fontSize = Math.abs(item.transform[3]);
    const screenFs = fontSize * SCALE;
    // item.width is in PDF points; screen width = item.width * SCALE
    const sw = item.width * SCALE;

    const id = uid();
    const edit: Edit = {
      id, pageNum,
      sx, sy: sy - screenFs, sw, sh: screenFs * 1.3,
      px: item.transform[4], py: item.transform[5],
      pw: item.width,
      ph: fontSize * 1.2,
      fontSize,
      fontName: item.fontName ?? "",
      originalText: item.str,
      text: item.str,
    };

    setEdits(prev => {
      // Remove any existing edit for the same text position
      const filtered = prev.filter(ed => !(ed.pageNum === pageNum && Math.abs(ed.px - edit.px) < 1 && Math.abs(ed.py - edit.py) < 1));
      return [...filtered, edit];
    });
    setActiveId(id);
  }, []);

  const handleTextChange = useCallback((id: string, text: string) => {
    setEdits(prev => prev.map(e => e.id === id ? { ...e, text } : e));
  }, []);

  // ── Build modified PDF ────────────────────────────────────────────────────

  const buildPdf = useCallback(async (): Promise<Uint8Array> => {
    const { PDFDocument, rgb } = await import("pdf-lib");
    const src = pdfBytesRef.current!;
    const doc = await PDFDocument.load(src);

    // Cache embedded fonts by font-key to avoid re-embedding the same font
    const fontCache = new Map<string, Awaited<ReturnType<typeof doc.embedFont>>>();
    const getFont = async (fontName: string) => {
      const key = normFont(fontName) + (isBold(fontName) ? "-b" : "") + (isItalic(fontName) ? "-i" : "") + (isMono(fontName) ? "-m" : "") + (isSerif(fontName) ? "-s" : "");
      if (!fontCache.has(key)) fontCache.set(key, await pdfLibFont(fontName, doc) as Awaited<ReturnType<typeof doc.embedFont>>);
      return fontCache.get(key)!;
    };

    const changed = edits.filter(e => e.text !== e.originalText);
    for (const edit of changed) {
      const page = doc.getPages()[edit.pageNum - 1];
      const font = await getFont(edit.fontName);
      const drawSize = edit.fontSize - PDF_FONT_REDUCE;
      const textW = Math.max(edit.pw, font.widthOfTextAtSize(edit.text, drawSize) + 4);

      // Cover original text with white box
      page.drawRectangle({
        x: edit.px - 1,
        y: edit.py - edit.fontSize * 0.25,
        width: textW + 4,
        height: edit.fontSize * 1.3,
        color: rgb(1, 1, 1),
        borderWidth: 0,
      });

      // Draw new text with matched font
      page.drawText(edit.text, {
        x: edit.px,
        y: edit.py - edit.fontSize * 0.05,
        size: drawSize,
        font,
        color: rgb(0, 0, 0),
      });
    }

    return doc.save();
  }, [edits]);

  // ── Save & Download ───────────────────────────────────────────────────────

  const handleDownload = useCallback(async () => {
    if (downloading) return;
    setDownloading(true);
    try {
      const bytes = await buildPdf();
      const blob = new Blob([bytes.buffer as ArrayBuffer], { type: "application/pdf" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${title || "document"}.pdf`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error("Download failed:", err);
    } finally {
      setDownloading(false);
    }
  }, [downloading, buildPdf, title]);

  const handleSave = useCallback(async () => {
    setSaveStatus("saving");
    try {
      const bytes = await buildPdf();
      const res = await fetch(`/api/save-edit/${documentId}`, {
        method: "POST",
        headers: { "Content-Type": "application/pdf" },
        body: bytes.buffer as ArrayBuffer,
      });
      if (!res.ok) throw new Error("Save failed");
      setSaveStatus("saved");
      setTimeout(() => setSaveStatus("idle"), 3000);
    } catch {
      setSaveStatus("error");
    }
  }, [buildPdf, documentId]);

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="flex flex-col h-full">
      {/* Toolbar */}
      <div className="flex items-center gap-2 px-4 py-2 border-b bg-white shrink-0">
        <Link href="/dashboard" title="Back"
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-gray-500 hover:bg-gray-100 transition-colors">
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </Link>

        <span className="hidden sm:block max-w-[200px] truncate text-sm font-semibold text-gray-800" title={title}>
          {title}
        </span>

        {pdfDoc ? (
          <span className="text-xs text-green-600 font-medium">✓ Click any text to edit</span>
        ) : (
          <span className="text-xs text-gray-400">Loading…</span>
        )}

        <div className="ml-auto flex items-center gap-2">
          <button
            onClick={handleDownload}
            disabled={!pdfDoc || downloading}
            className="flex items-center gap-1.5 rounded-md border border-gray-200 bg-white px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
            </svg>
            {downloading ? "Downloading…" : "Download"}
          </button>

          <button
            onClick={handleSave}
            disabled={!pdfDoc || saveStatus === "saving"}
            className={`px-4 py-1.5 text-sm font-medium rounded-md transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${
              saveStatus === "saving" ? "bg-indigo-600 text-white cursor-wait" :
              saveStatus === "saved"  ? "bg-green-600 text-white" :
              saveStatus === "error"  ? "bg-red-600 text-white" :
                                       "bg-indigo-600 text-white hover:bg-indigo-700"
            }`}
          >
            {saveStatus === "saving" ? "Saving…" : saveStatus === "saved" ? "Saved ✓" : saveStatus === "error" ? "Error" : "Save"}
          </button>
        </div>
      </div>

      {/* Pages */}
      <div className="flex-1 overflow-auto bg-gray-200 py-6 px-4">
        {!pdfDoc && (
          <div className="flex items-center justify-center h-full">
            <p className="text-sm text-gray-400 animate-pulse">Loading PDF…</p>
          </div>
        )}
        {pdfDoc && Array.from({ length: numPages }, (_, i) => i + 1).map(pageNum => (
          <PdfPage
            key={pageNum}
            pdfDoc={pdfDoc}
            pageNum={pageNum}
            edits={edits}
            activeId={activeId}
            onPageClick={handlePageClick}
            onTextChange={handleTextChange}
            onBlur={() => setActiveId(null)}
            onFocus={setActiveId}
          />
        ))}
      </div>
    </div>
  );
}
