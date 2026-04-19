import { useEffect, useState } from "react";
import type { PDFDocumentProxy } from "pdfjs-dist";
import { loadPdf } from "@/lib/pdfjs";

type PdfLoaderState = {
  pdf: PDFDocumentProxy | null;
  totalPages: number;
  loading: boolean;
  error: string | null;
};

/**
 * Loads a PDF from a URL. Automatically destroys the document on cleanup
 * and reloads if the URL changes.
 */
export function usePdfLoader(url: string): PdfLoaderState {
  const [state, setState] = useState<PdfLoaderState>({
    pdf: null,
    totalPages: 0,
    loading: true,
    error: null,
  });

  useEffect(() => {
    let doc: PDFDocumentProxy | null = null;
    setState({ pdf: null, totalPages: 0, loading: true, error: null });

    loadPdf(url)
      .then((loaded) => {
        doc = loaded;
        setState({ pdf: loaded, totalPages: loaded.numPages, loading: false, error: null });
      })
      .catch((err: unknown) => {
        const message = err instanceof Error ? err.message : "Failed to load PDF";
        setState({ pdf: null, totalPages: 0, loading: false, error: message });
      });

    return () => {
      doc?.destroy();
    };
  }, [url]);

  return state;
}
