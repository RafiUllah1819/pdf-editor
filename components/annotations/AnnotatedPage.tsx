import { useCallback, useEffect, useRef, useState } from "react";
import {
  Stage,
  Layer,
  Rect as KonvaRect,
  Text as KonvaText,
  Image as KonvaImage,
  Transformer,
} from "react-konva";
import type Konva from "konva";
import type { PDFDocumentProxy } from "pdfjs-dist";
import PageCanvas from "@/components/pdf/PageCanvas";
import { generateId } from "@/lib/utils";
import type { Annotation, EditorTool } from "@/types";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type CanvasSize = { width: number; height: number };

type Props = {
  pdf: PDFDocumentProxy;
  pageNumber: number;
  scale: number;
  annotations: Annotation[];      // only annotations for this page
  activeTool: EditorTool;
  selectedId: string | null;
  onAnnotationCreate: (ann: Annotation) => void;
  onAnnotationUpdate: (id: string, updates: Partial<Annotation>) => void;
  onAnnotationSelect: (id: string | null) => void;
};

const DEFAULT_FONT_SIZE = 14; // pt at scale=1.0
const HIGHLIGHT_COLOR = "#FFFF00";
const HIGHLIGHT_OPACITY = 0.4;
const MIN_DRAW_SIZE = 8; // px — ignore accidental micro-drags

// ---------------------------------------------------------------------------
// AnnotatedPage
// ---------------------------------------------------------------------------

export default function AnnotatedPage({
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
  const [canvasSize, setCanvasSize] = useState<CanvasSize>({ width: 0, height: 0 });

  // For drawing a highlight rectangle before mouse-up
  const [drawingRect, setDrawingRect] = useState<CanvasSize & { x: number; y: number } | null>(null);
  const drawStartRef = useRef<{ x: number; y: number } | null>(null);

  // For inline text editing
  const [editingId, setEditingId] = useState<string | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Konva refs
  const trRef = useRef<Konva.Transformer>(null);
  const shapeRefs = useRef<Map<string, Konva.Node>>(new Map());

  // HTMLImageElement cache — one entry per image annotation
  const [imageElements, setImageElements] = useState<Map<string, HTMLImageElement>>(new Map());
  // Tracks which annotation IDs we've already started loading (avoids duplicate loads)
  const loadedIdsRef = useRef<Set<string>>(new Set());

  // ── Load HTMLImageElement for each image annotation ──────────────────────
  useEffect(() => {
    annotations.forEach((ann) => {
      if (ann.type !== "image" || !ann.src) return;
      if (loadedIdsRef.current.has(ann.id)) return;

      loadedIdsRef.current.add(ann.id);
      const img = new window.Image();
      img.onload = () =>
        setImageElements((prev) => new Map(prev).set(ann.id, img));
      img.src = ann.src;
    });
  }, [annotations]);

  // ── Compute canvas dimensions from the PDF page ─────────────────────────
  useEffect(() => {
    let active = true;
    pdf.getPage(pageNumber).then((page) => {
      if (!active) return;
      const vp = page.getViewport({ scale });
      setCanvasSize({ width: vp.width, height: vp.height });
    });
    return () => { active = false; };
  }, [pdf, pageNumber, scale]);

  // ── Attach Transformer to the selected shape ─────────────────────────────
  useEffect(() => {
    const tr = trRef.current;
    if (!tr) return;
    const node = selectedId ? shapeRefs.current.get(selectedId) : undefined;
    tr.nodes(node ? [node] : []);
    tr.getLayer()?.batchDraw();
  }, [selectedId, annotations]); // also re-run when annotations change (shape might be new)

  // ── Focus textarea when editing starts ────────────────────────────────────
  useEffect(() => {
    if (editingId) textareaRef.current?.focus();
  }, [editingId]);

  // ── Helpers ───────────────────────────────────────────────────────────────

  const stageCursor =
    activeTool === "text"        ? "text"
    : activeTool === "highlight" ? "crosshair"
    : "default";

  /** Convert Konva (scaled) coordinates → normalised annotation coordinates */
  function toNorm(v: number) { return v / scale; }

  function registerShapeRef(id: string, node: Konva.Node | null) {
    if (node) shapeRefs.current.set(id, node);
    else shapeRefs.current.delete(id);
  }

  function handleTransformEnd(
    e: Konva.KonvaEventObject<Event>,
    ann: Annotation
  ) {
    const node = e.target;
    const newW = Math.max(20, node.width() * node.scaleX());
    const newH = Math.max(20, node.height() * node.scaleY());
    // Reset Konva's internal scale — we manage size via width/height props
    node.scaleX(1);
    node.scaleY(1);
    onAnnotationUpdate(ann.id, {
      x: toNorm(node.x()),
      y: toNorm(node.y()),
      width: toNorm(newW),
      height: toNorm(newH),
    });
  }

  function handleDragEnd(
    e: Konva.KonvaEventObject<DragEvent>,
    ann: Annotation
  ) {
    onAnnotationUpdate(ann.id, {
      x: toNorm(e.target.x()),
      y: toNorm(e.target.y()),
    });
  }

  // ── Drawing (highlight tool) ───────────────────────────────────────────────

  function handleBgMouseDown(e: Konva.KonvaEventObject<MouseEvent>) {
    if (activeTool !== "highlight") return;
    const pos = e.target.getStage()!.getPointerPosition()!;
    drawStartRef.current = pos;
    setDrawingRect({ x: pos.x, y: pos.y, width: 0, height: 0 });
  }

  function handleStageMouseMove(e: Konva.KonvaEventObject<MouseEvent>) {
    if (!drawStartRef.current) return;
    const pos = e.target.getStage()!.getPointerPosition()!;
    const start = drawStartRef.current;
    setDrawingRect({
      x: Math.min(start.x, pos.x),
      y: Math.min(start.y, pos.y),
      width: Math.abs(pos.x - start.x),
      height: Math.abs(pos.y - start.y),
    });
  }

  function handleStageMouseUp() {
    if (!drawingRect || !drawStartRef.current) return;
    drawStartRef.current = null;

    if (drawingRect.width > MIN_DRAW_SIZE && drawingRect.height > MIN_DRAW_SIZE) {
      const ann: Annotation = {
        id: generateId(),
        documentId: "",
        page: pageNumber,
        type: "highlight",
        x: toNorm(drawingRect.x),
        y: toNorm(drawingRect.y),
        width: toNorm(drawingRect.width),
        height: toNorm(drawingRect.height),
        color: HIGHLIGHT_COLOR,
        opacity: HIGHLIGHT_OPACITY,
      };
      onAnnotationCreate(ann);
      onAnnotationSelect(ann.id);
    }
    setDrawingRect(null);
  }

  // ── Background click (text placement / deselect) ──────────────────────────

  function handleBgClick(e: Konva.KonvaEventObject<MouseEvent>) {
    if (activeTool === "select") {
      onAnnotationSelect(null);
      return;
    }
    if (activeTool === "text") {
      const pos = e.target.getStage()!.getPointerPosition()!;
      const ann: Annotation = {
        id: generateId(),
        documentId: "",
        page: pageNumber,
        type: "text",
        x: toNorm(pos.x),
        y: toNorm(pos.y),
        width: toNorm(200),
        height: toNorm(32),
        text: "Text",
        fontSize: DEFAULT_FONT_SIZE,
        color: "#111827",
        opacity: 1,
      };
      onAnnotationCreate(ann);
      onAnnotationSelect(ann.id);
      setEditingId(ann.id);
    }
  }

  // ── Inline text editing ────────────────────────────────────────────────────

  const finishEditing = useCallback(
    (newText: string) => {
      if (editingId) {
        onAnnotationUpdate(editingId, { text: newText });
        setEditingId(null);
      }
    },
    [editingId, onAnnotationUpdate]
  );

  // ── Wait until dimensions are ready ──────────────────────────────────────
  if (canvasSize.width === 0) return null;

  const editingAnnotation =
    editingId ? annotations.find((a) => a.id === editingId) : null;

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div
      className="relative select-none shadow-[0_4px_24px_rgba(0,0,0,0.15)]"
      style={{ width: canvasSize.width, height: canvasSize.height }}
    >
      {/* Layer 1: PDF canvas */}
      <PageCanvas pdf={pdf} pageNumber={pageNumber} scale={scale} />

      {/* Layer 2: Konva annotation stage */}
      <Stage
        width={canvasSize.width}
        height={canvasSize.height}
        className="absolute inset-0"
        style={{ cursor: stageCursor }}
        onMouseMove={handleStageMouseMove}
        onMouseUp={handleStageMouseUp}
      >
        <Layer>
          {/* Transparent background — captures clicks and drag-starts */}
          <KonvaRect
            x={0}
            y={0}
            width={canvasSize.width}
            height={canvasSize.height}
            fill="transparent"
            onClick={handleBgClick}
            onMouseDown={handleBgMouseDown}
          />

          {/* In-progress highlight rectangle */}
          {drawingRect && (
            <KonvaRect
              {...drawingRect}
              fill={HIGHLIGHT_COLOR}
              opacity={HIGHLIGHT_OPACITY}
              listening={false}
            />
          )}

          {/* Rendered annotations */}
          {annotations.map((ann) => {
            const isSelected = ann.id === selectedId;
            const draggable = activeTool === "select";
            const sharedProps = {
              x: ann.x * scale,
              y: ann.y * scale,
              width: ann.width * scale,
              height: ann.height * scale,
              draggable,
              // Pass through to select tool only — drawing tools ignore shapes
              listening: activeTool === "select",
              onClick: () => onAnnotationSelect(ann.id),
              onDragEnd: (e: Konva.KonvaEventObject<DragEvent>) =>
                handleDragEnd(e, ann),
              onTransformEnd: (e: Konva.KonvaEventObject<Event>) =>
                handleTransformEnd(e, ann),
            };

            if (ann.type === "text") {
              return (
                <KonvaText
                  key={ann.id}
                  {...sharedProps}
                  ref={(node) => registerShapeRef(ann.id, node)}
                  text={ann.text ?? ""}
                  fontSize={(ann.fontSize ?? DEFAULT_FONT_SIZE) * scale}
                  fill={ann.color ?? "#111827"}
                  opacity={ann.opacity ?? 1}
                  wrap="word"
                  // Hide while the textarea is open so they don't overlap
                  visible={editingId !== ann.id}
                  onDblClick={() => {
                    onAnnotationSelect(ann.id);
                    setEditingId(ann.id);
                  }}
                  // Show selection outline when not using Transformer
                  stroke={isSelected ? "#4f46e5" : undefined}
                  strokeWidth={isSelected ? 1 / scale : 0}
                />
              );
            }

            if (ann.type === "highlight") {
              return (
                <KonvaRect
                  key={ann.id}
                  {...sharedProps}
                  ref={(node) => registerShapeRef(ann.id, node)}
                  fill={ann.color ?? HIGHLIGHT_COLOR}
                  opacity={ann.opacity ?? HIGHLIGHT_OPACITY}
                />
              );
            }

            if (ann.type === "image") {
              const imgEl = imageElements.get(ann.id);
              // Don't render until the HTMLImageElement has finished loading
              if (!imgEl) return null;
              return (
                <KonvaImage
                  key={ann.id}
                  {...sharedProps}
                  ref={(node) => registerShapeRef(ann.id, node)}
                  image={imgEl}
                  // Preserve aspect ratio by default; Transformer lets the user
                  // override this manually if they want to distort the image.
                  opacity={ann.opacity ?? 1}
                />
              );
            }

            return null;
          })}

          {/* Transformer — attaches to selected shape */}
          <Transformer
            ref={trRef}
            rotateEnabled={false}
            keepRatio={false}
            borderStroke="#4f46e5"
            anchorStroke="#4f46e5"
            anchorFill="#fff"
            anchorSize={8}
            borderDash={[4, 2]}
            boundBoxFunc={(_old, newBox) =>
              newBox.width < 20 || newBox.height < 10 ? _old : newBox
            }
          />
        </Layer>
      </Stage>

      {/* Layer 3: inline textarea for text editing */}
      {editingAnnotation && editingAnnotation.type === "text" && (
        <textarea
          ref={textareaRef}
          defaultValue={editingAnnotation.text ?? ""}
          onBlur={(e) => finishEditing(e.currentTarget.value)}
          onKeyDown={(e) => {
            if (e.key === "Escape") finishEditing(editingAnnotation.text ?? "");
            // Shift+Enter = newline; bare Enter = commit
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              finishEditing(e.currentTarget.value);
            }
          }}
          style={{
            position: "absolute",
            top: editingAnnotation.y * scale,
            left: editingAnnotation.x * scale,
            width: editingAnnotation.width * scale,
            minHeight: editingAnnotation.height * scale,
            fontSize: (editingAnnotation.fontSize ?? DEFAULT_FONT_SIZE) * scale,
            color: editingAnnotation.color ?? "#111827",
            lineHeight: 1.4,
            fontFamily: "sans-serif",
            padding: "2px 4px",
            border: "2px solid #4f46e5",
            borderRadius: 2,
            background: "rgba(255,255,255,0.95)",
            resize: "none",
            outline: "none",
            zIndex: 10,
            overflow: "hidden",
          }}
        />
      )}
    </div>
  );
}
