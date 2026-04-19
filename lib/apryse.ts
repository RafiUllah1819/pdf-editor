/**
 * Apryse WebViewer v11 — initialization utility.
 *
 * All WebViewer usage in the app goes through createViewer() so that the
 * asset path and license key are configured in exactly one place.
 *
 * ─── Usage (always inside a useEffect, never at module level or in SSR) ────
 *
 *   const instanceRef = useRef<WebViewerInstance | null>(null);
 *
 *   useEffect(() => {
 *     if (!divRef.current || instanceRef.current) return; // StrictMode guard
 *     createViewer({ container: divRef.current })
 *       .then(inst => { instanceRef.current = inst; })
 *       .catch(console.error);
 *   }, []);
 *
 * ─── Why dynamic import ──────────────────────────────────────────────────────
 *   @pdftron/webviewer accesses browser globals (window, document) at import
 *   time.  Importing it at the top level would crash during Next.js SSR.
 *   The dynamic import inside createViewer() defers evaluation to the browser.
 *
 * ─── Why fullAPI: true ───────────────────────────────────────────────────────
 *   Content Editing (direct PDF text editing) requires the full PDF processing
 *   engine (InfixServer WASM).  Without fullAPI the ContentEdit namespace and
 *   ContentEditManager are unavailable.
 */

import type { WebViewerInstance, WebViewerOptions } from "@pdftron/webviewer";

export type { WebViewerInstance, WebViewerOptions };

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** URL prefix for the WebViewer static assets copied into /public. */
export const WEBVIEWER_PATH = "/webviewer";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type CreateViewerOptions = {
  /** DOM element the viewer iframe will be mounted into. Must be in the DOM. */
  container: HTMLElement;

  /**
   * URL (or data URI) of the document to open on load.
   * Leave undefined to open an empty viewer.
   */
  initialDoc?: string;

  /**
   * Any additional WebViewerOptions to merge in.
   * These override the defaults set by createViewer().
   * See: https://docs.apryse.com/api/web/WebViewerOptions.html
   */
  extra?: Partial<WebViewerOptions>;
};

// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------

/**
 * Creates and returns an Apryse WebViewerInstance.
 *
 * @throws if the WebViewer assets are not found at WEBVIEWER_PATH.
 *         Run `npm run copy-webviewer-assets` if /public/webviewer is missing.
 */
export async function createViewer(
  opts: CreateViewerOptions
): Promise<WebViewerInstance> {
  // Dynamic import — keeps @pdftron/webviewer out of the SSR bundle entirely
  const { default: WebViewer } = await import("@pdftron/webviewer");

  return WebViewer(
    {
      path: WEBVIEWER_PATH,

      // License key — set NEXT_PUBLIC_APRYSE_LICENSE_KEY in .env.local.
      // Without a key the SDK runs in demo mode (watermark on exported PDFs).
      licenseKey: process.env.NEXT_PUBLIC_APRYSE_LICENSE_KEY ?? "",

      // Required for direct PDF text editing (ContentEdit / InfixServer WASM).
      fullAPI: true,

      ...(opts.initialDoc ? { initialDoc: opts.initialDoc } : {}),
      ...opts.extra,
    },
    opts.container
  );
}
