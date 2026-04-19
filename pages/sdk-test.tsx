/**
 * SDK verification page — /sdk-test
 *
 * Opens an empty WebViewer and reports the SDK version + whether fullAPI
 * (content editing) is available.  Remove or restrict this page before
 * going to production.
 *
 * How to test:
 *   1. npm run dev
 *   2. Open http://localhost:3000/sdk-test
 *   3. The viewer iframe should appear; the status strip should say "Ready"
 *      and show the SDK version number.
 *   4. Open browser devtools → Console.  You should see no errors.
 *      A "(DEMO MODE)" watermark on the viewer means no license key is set.
 */

import { useEffect, useRef, useState } from "react";
import type { WebViewerInstance } from "@/lib/apryse";
import { createViewer } from "@/lib/apryse";

type Status = "loading" | "ready" | "error";

export default function SdkTestPage() {
  const viewerDivRef = useRef<HTMLDivElement>(null);
  const instanceRef  = useRef<WebViewerInstance | null>(null);

  const [status,  setStatus]  = useState<Status>("loading");
  const [version, setVersion] = useState<string | null>(null);
  const [hasFullApi, setHasFullApi] = useState<boolean | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    // Guard against React StrictMode double-invocation
    if (!viewerDivRef.current || instanceRef.current) return;

    createViewer({ container: viewerDivRef.current })
      .then((instance) => {
        instanceRef.current = instance;

        // SDK version via Core.getVersion()
        setVersion(instance.Core.getVersion());

        // Verify fullAPI loaded by checking the ContentEdit namespace exists
        setHasFullApi(typeof instance.Core.ContentEdit !== "undefined");

        setStatus("ready");
      })
      .catch((err: unknown) => {
        setErrorMsg(err instanceof Error ? err.message : String(err));
        setStatus("error");
      });

    return () => {
      instanceRef.current?.UI.dispose();
      instanceRef.current = null;
    };
  }, []);

  const licenseSet = Boolean(process.env.NEXT_PUBLIC_APRYSE_LICENSE_KEY);

  return (
    <div style={{ padding: "24px", fontFamily: "system-ui, sans-serif" }}>
      <h1 style={{ margin: "0 0 16px" }}>Apryse WebViewer — SDK Setup Test</h1>

      {/* Status strip */}
      <div
        style={{
          display: "inline-flex",
          gap: "24px",
          padding: "10px 16px",
          borderRadius: "6px",
          marginBottom: "16px",
          background:
            status === "ready"   ? "#f0fdf4" :
            status === "error"   ? "#fef2f2" :
                                   "#f8fafc",
          border:
            status === "ready"   ? "1px solid #86efac" :
            status === "error"   ? "1px solid #fca5a5" :
                                   "1px solid #e2e8f0",
          fontSize: "13px",
        }}
      >
        <span>
          Status:{" "}
          <strong>
            {status === "loading" ? "⏳ Loading…" :
             status === "ready"   ? "✅ Ready"    :
                                    "❌ Error"}
          </strong>
        </span>
        {version     && <span>SDK version: <strong>{version}</strong></span>}
        {hasFullApi !== null && (
          <span>
            fullAPI / ContentEdit:{" "}
            <strong>{hasFullApi ? "✅ available" : "❌ not available"}</strong>
          </span>
        )}
        <span>
          License key:{" "}
          <strong>{licenseSet ? "✅ set" : "⚠️ not set (demo mode)"}</strong>
        </span>
      </div>

      {status === "error" && (
        <div
          style={{
            padding: "12px 16px",
            marginBottom: "16px",
            background: "#fef2f2",
            border: "1px solid #fca5a5",
            borderRadius: "6px",
            fontSize: "13px",
            color: "#dc2626",
          }}
        >
          <strong>Error:</strong> {errorMsg}
          <br />
          <br />
          Common causes:
          <ul style={{ margin: "8px 0 0", paddingLeft: "20px" }}>
            <li>
              <code>/public/webviewer</code> is missing — run{" "}
              <code>npm run copy-webviewer-assets</code>
            </li>
            <li>The dev server was started before the assets were copied</li>
          </ul>
        </div>
      )}

      {/* WebViewer container */}
      <div
        ref={viewerDivRef}
        style={{
          width: "100%",
          height: "75vh",
          border: "1px solid #e2e8f0",
          borderRadius: "6px",
          overflow: "hidden",
        }}
      />
    </div>
  );
}
