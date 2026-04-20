import { useEffect, useRef, useState, useCallback } from "react";
import Link from "next/link";
import type { WebViewerInstance } from "@/lib/apryse";
import { createViewer } from "@/lib/apryse";
import { getDocumentBytes } from "@/lib/pdf/sdk-helpers";

type Props = {
  documentId: string;
  pdfUrl: string;
  title: string;
};

export default function FillSignEditor({ documentId, pdfUrl, title }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const instanceRef  = useRef<WebViewerInstance | null>(null);
  const initStarted  = useRef(false);

  const [ready,       setReady]       = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [saveStatus,  setSaveStatus]  = useState<"idle"|"saving"|"saved"|"error">("idle");
  const [saveError,   setSaveError]   = useState<string | null>(null);

  useEffect(() => {
    if (initStarted.current || !containerRef.current) return;
    initStarted.current = true;

    createViewer({
      container: containerRef.current,
      extra: {
        initialDoc: pdfUrl,
        enableFilePicker: false,
        useDownloader: false,
        // Keep only Fill & Sign and Forms toolbars
        disabledElements: [
          "toolbarGroup-Annotate",
          "toolbarGroup-Shapes",
          "toolbarGroup-Insert",
          "toolbarGroup-Measure",
          "toolbarGroup-Edit",
          "toolbarGroup-Redact",
          "toolbarGroup-View",
        ],
      },
    }).then((instance) => {
      instanceRef.current = instance;
      const { UI } = instance;

      // Enable Fill & Sign feature
      UI.enableFeatures([UI.Feature.FilledSign]);
      UI.setToolbarGroup("toolbarGroup-FillAndSign");

      instance.Core.documentViewer.addEventListener("documentLoaded", () => {
        setReady(true);
      }, { once: true });

      // If document already loaded
      if (instance.Core.documentViewer.getDocument()) setReady(true);

    }).catch((err) => {
      console.error("[FillSign] init failed:", err);
      setReady(true); // show viewer anyway
    });

    return () => {
      instanceRef.current?.UI.dispose();
      instanceRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const getBytes = useCallback(async () => {
    const instance = instanceRef.current!;
    return getDocumentBytes(instance);
  }, []);

  const handleDownload = useCallback(async () => {
    if (!instanceRef.current || downloading) return;
    setDownloading(true);
    try {
      const bytes = await getBytes();
      const blob  = new Blob([bytes.buffer as ArrayBuffer], { type: "application/pdf" });
      const url   = URL.createObjectURL(blob);
      const a     = document.createElement("a");
      a.href      = url;
      a.download  = `${title || "document"}_signed.pdf`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error("Download failed:", err);
    } finally {
      setDownloading(false);
    }
  }, [title, downloading, getBytes]);

  const handleSave = useCallback(async () => {
    if (!instanceRef.current) return;
    setSaveStatus("saving");
    setSaveError(null);
    try {
      const bytes = await getBytes();
      const res   = await fetch(`/api/save-edit/${documentId}`, {
        method: "POST",
        headers: { "Content-Type": "application/pdf" },
        body: bytes.buffer as ArrayBuffer,
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error((body as { error?: string }).error ?? `HTTP ${res.status}`);
      }
      setSaveStatus("saved");
      setTimeout(() => setSaveStatus("idle"), 3000);
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : "Save failed");
      setSaveStatus("error");
    }
  }, [documentId, getBytes]);

  const saveCls =
    saveStatus === "saving" ? "bg-indigo-600 text-white cursor-wait" :
    saveStatus === "saved"  ? "bg-green-600 text-white" :
    saveStatus === "error"  ? "bg-red-600 text-white" :
                              "bg-indigo-600 text-white hover:bg-indigo-700";

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

        <span className="hidden sm:block max-w-[180px] truncate text-sm font-semibold text-gray-800" title={title}>
          {title}
        </span>

        <span className="inline-flex items-center rounded-full bg-violet-50 px-2 py-0.5 text-xs font-medium text-violet-700 ring-1 ring-inset ring-violet-200">
          Fill &amp; Sign
        </span>

        <div className="ml-auto flex items-center gap-2">
          <button
            onClick={handleDownload}
            disabled={!ready || downloading}
            className="flex items-center gap-1.5 rounded-md border border-gray-200 bg-white px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50 hover:border-gray-300 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
            </svg>
            {downloading ? "Downloading…" : "Download"}
          </button>

          <button
            onClick={handleSave}
            disabled={!ready || saveStatus === "saving"}
            className={`px-4 py-1.5 text-sm font-medium rounded-md transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${saveCls}`}
          >
            {saveStatus === "saving" ? "Saving…" : saveStatus === "saved" ? "Saved ✓" : saveStatus === "error" ? "Retry" : "Save"}
          </button>

          {saveStatus === "error" && saveError && (
            <span className="text-xs text-red-600">{saveError}</span>
          )}
        </div>
      </div>

      <div className="relative flex-1 min-h-0">
        <div ref={containerRef} className="h-full w-full" />
        {!ready && (
          <div className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-3 bg-gray-50">
            <svg className="h-12 w-12 text-gray-300 animate-pulse" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
            </svg>
            <p className="text-sm font-medium text-gray-500">Loading…</p>
          </div>
        )}
      </div>
    </div>
  );
}
