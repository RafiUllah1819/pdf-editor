import { useEffect, useRef } from "react";
import type { PDFDocumentProxy, RenderTask } from "pdfjs-dist";

type Props = {
  pdf: PDFDocumentProxy;
  pageNumber: number;
  scale: number;
};

/**
 * Renders a single PDF page onto an HTML canvas.
 * Automatically cancels in-flight renders when props change or on unmount,
 * preventing race conditions when the user pages quickly.
 */
export default function PageCanvas({ pdf, pageNumber, scale }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const renderTaskRef = useRef<RenderTask | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function render() {
      // Cancel any render that is already in progress
      if (renderTaskRef.current) {
        renderTaskRef.current.cancel();
        renderTaskRef.current = null;
      }

      const canvas = canvasRef.current;
      if (!canvas) return;

      try {
        const page = await pdf.getPage(pageNumber);
        if (cancelled) return;

        const viewport = page.getViewport({ scale });

        // Set physical canvas dimensions to match the viewport
        canvas.width = viewport.width;
        canvas.height = viewport.height;

        const context = canvas.getContext("2d");
        if (!context) return;

        const task = page.render({ canvasContext: context, viewport, canvas });
        renderTaskRef.current = task;

        await task.promise;
        renderTaskRef.current = null;

        // Free page resources now that rendering is done
        page.cleanup();
      } catch (err: unknown) {
        // RenderingCancelledException is expected — not a real error
        if ((err as { name?: string }).name === "RenderingCancelledException") return;
        if (!cancelled) {
          console.error("[PageCanvas] render error:", err);
        }
      }
    }

    render();

    return () => {
      cancelled = true;
      if (renderTaskRef.current) {
        renderTaskRef.current.cancel();
        renderTaskRef.current = null;
      }
    };
  }, [pdf, pageNumber, scale]);

  return (
    <canvas
      ref={canvasRef}
      className="block shadow-[0_4px_24px_rgba(0,0,0,0.15)]"
    />
  );
}
