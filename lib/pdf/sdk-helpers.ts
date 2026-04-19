import type { WebViewerInstance } from "@/lib/apryse";
import type { ViewerSettings } from "./sdk-config";

export function applyViewerSettings(
  instance: WebViewerInstance,
  settings: ViewerSettings
): void {
  const { UI } = instance;

  UI.setTheme(settings.theme === "dark" ? UI.Theme.DARK : UI.Theme.LIGHT);

  const fitMode =
    settings.fitMode === "FitPage" ? UI.FitMode.FitPage : UI.FitMode.FitWidth;
  UI.setFitMode(fitMode);

  for (const group of settings.hideToolbars) {
    UI.disableElements([group]);
  }

  UI.enableFeatures([UI.Feature.ContentEdit]);
  UI.setToolbarGroup(UI.ToolbarGroup.EDIT);

  // Open the left panel and show the thumbnail view by default
  UI.openElements(["leftPanel"]);
  UI.setActiveLeftPanel("thumbnailsPanel");
}

export function waitForDocumentLoaded(
  instance: WebViewerInstance
): Promise<void> {
  return new Promise((resolve) => {
    instance.Core.documentViewer.addEventListener("documentLoaded", resolve, {
      once: true,
    });
  });
}

export async function getDocumentBytes(
  instance: WebViewerInstance
): Promise<Uint8Array> {
  const doc = instance.Core.documentViewer.getDocument();
  // getFileData returns a Blob; cast through any for SDK version flexibility
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const blob: Blob = await (doc as any).getFileData({});
  const arrayBuffer = await blob.arrayBuffer();
  return new Uint8Array(arrayBuffer);
}
