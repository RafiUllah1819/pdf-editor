import { useEffect, useRef, useState, useCallback } from "react";
import Link from "next/link";
import type { WebViewerInstance } from "@/lib/apryse";
import { createViewer } from "@/lib/apryse";
import {
  DEFAULT_VIEWER_SETTINGS,
  buildViewerOptions,
} from "@/lib/pdf/sdk-config";
import {
  applyViewerSettings,
  waitForDocumentLoaded,
  getDocumentBytes,
} from "@/lib/pdf/sdk-helpers";

type SaveStatus = "idle" | "saving" | "saved" | "error";

type Props = {
  documentId: string;
  pdfUrl: string;
  title: string;
  versionNum: number;
  onSaveSuccess?: () => void;
};

export default function CommercialPdfEditor({
  documentId,
  pdfUrl,
  title,
  versionNum,
  onSaveSuccess,
}: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const instanceRef = useRef<WebViewerInstance | null>(null);

  const [ready, setReady] = useState(false);
  const [saveStatus, setSaveStatus] = useState<SaveStatus>("idle");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    if (!containerRef.current || instanceRef.current) return;

    createViewer({
      container: containerRef.current,
      extra: buildViewerOptions(pdfUrl),
    })
      .then(async (instance) => {
        instanceRef.current = instance;
        applyViewerSettings(instance, DEFAULT_VIEWER_SETTINGS);
        await waitForDocumentLoaded(instance);
        setReady(true);
      })
      .catch((err: unknown) => {
        setErrorMsg(err instanceof Error ? err.message : String(err));
      });

    return () => {
      instanceRef.current?.UI.dispose();
      instanceRef.current = null;
    };
    // pdfUrl intentionally excluded — viewer reloads are expensive; treat URL as stable
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleSave = useCallback(async () => {
    const instance = instanceRef.current;
    if (!instance) return;

    setSaveStatus("saving");
    setErrorMsg(null);

    try {
      const bytes = await getDocumentBytes(instance);

      const res = await fetch(`/api/save-edit/${documentId}`, {
        method: "POST",
        headers: { "Content-Type": "application/pdf" },
        body: bytes.buffer as ArrayBuffer,
      });

      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error((body as { error?: string }).error ?? `HTTP ${res.status}`);
      }

      setSaveStatus("saved");
      onSaveSuccess?.();

      // Reset "saved" badge after 3 s
      setTimeout(() => setSaveStatus("idle"), 3000);
    } catch (err: unknown) {
      setErrorMsg(err instanceof Error ? err.message : String(err));
      setSaveStatus("error");
    }
  }, [documentId, onSaveSuccess]);

  return (
    <div className="flex flex-col h-full">
      {/* Toolbar */}
      <div className="flex items-center gap-3 px-4 py-2 border-b bg-white shrink-0">
        {/* Back to dashboard */}
        <Link
          href="/dashboard"
          title="Back to dashboard"
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-gray-500 hover:bg-gray-100 hover:text-gray-900 transition-colors"
        >
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </Link>

        {/* Document title */}
        <span className="hidden sm:block max-w-xs truncate text-sm font-semibold text-gray-800" title={title}>
          {title}
        </span>

        {/* Version badge */}
        {versionNum > 1 && (
          <span className="hidden sm:inline-flex items-center rounded-full bg-indigo-50 px-2 py-0.5 text-xs font-medium text-indigo-600 ring-1 ring-inset ring-indigo-200">
            v{versionNum}
          </span>
        )}

        {!ready && (
          <span className="text-xs text-gray-400 ml-1">Loading…</span>
        )}

        {/* Right: error + save */}
        <div className="ml-auto flex items-center gap-3">
          {errorMsg && (
            <span className="text-xs text-red-600 max-w-xs truncate">
              {errorMsg}
            </span>
          )}

          <button
            onClick={handleSave}
            disabled={!ready || saveStatus === "saving"}
            className="px-4 py-1.5 text-sm font-medium rounded-md bg-indigo-600 text-white
                       hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed
                       transition-colors"
          >
            {saveStatus === "saving"
              ? "Saving…"
              : saveStatus === "saved"
              ? "Saved ✓"
              : saveStatus === "error"
              ? "Retry Save"
              : "Save"}
          </button>
        </div>
      </div>

      {/* WebViewer mount point */}
      <div ref={containerRef} className="flex-1 min-h-0" />
    </div>
  );
}
