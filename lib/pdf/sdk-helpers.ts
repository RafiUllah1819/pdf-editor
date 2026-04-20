import type { WebViewerInstance } from "@/lib/apryse";
import type { ViewerSettings } from "./sdk-config";

export async function applyViewerSettings(
  instance: WebViewerInstance,
  settings: ViewerSettings
): Promise<void> {
  const { UI, Core } = instance;

  UI.setTheme(settings.theme === "dark" ? UI.Theme.DARK : UI.Theme.LIGHT);

  const fitMode =
    settings.fitMode === "FitPage" ? UI.FitMode.FitPage : UI.FitMode.FitWidth;
  UI.setFitMode(fitMode);

  UI.setToolbarGroup("toolbarGroup-Edit");

  for (const group of settings.hideToolbars) {
    UI.disableElements([group]);
  }

  UI.openElements(["leftPanel"]);
  UI.setActiveLeftPanel("thumbnailsPanel");
}

export function waitForDocumentLoaded(
  instance: WebViewerInstance
): Promise<void> {
  return new Promise((resolve) => {
    const { documentViewer } = instance.Core;
    // Resolve immediately if the document has already finished loading
    // (can happen with fast networks or React StrictMode double-invocation)
    if (documentViewer.getDocument()) {
      resolve();
      return;
    }
    documentViewer.addEventListener("documentLoaded", resolve, { once: true });
  });
}

export async function getDocumentBytes(
  instance: WebViewerInstance
): Promise<Uint8Array> {
  const doc = instance.Core.documentViewer.getDocument();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const data: unknown = await (doc as any).getFileData({});
  // WebViewer runs inside an iframe — instanceof Uint8Array fails cross-frame
  // because the constructor is from a different JS context.
  // ArrayBuffer.isView() checks the internal typed-array slot, works cross-frame.
  if (ArrayBuffer.isView(data)) {
    const view = data as ArrayBufferView;
    return new Uint8Array(view.buffer, view.byteOffset, view.byteLength);
  }
  if (data instanceof ArrayBuffer) return new Uint8Array(data);
  // Blob fallback for older SDK builds
  return new Uint8Array(await (data as Blob).arrayBuffer());
}
