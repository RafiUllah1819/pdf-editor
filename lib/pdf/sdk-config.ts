import type { WebViewerOptions } from "@/lib/apryse";

export type ViewerSettings = {
  theme: "light" | "dark";
  fitMode: "FitWidth" | "FitPage";
  hideToolbars: string[];
};

// All toolbar groups except Edit are hidden — only text/content editing tools shown
const HIDDEN_TOOLBARS = [
  "toolbarGroup-Annotate",
  "toolbarGroup-Shapes",
  "toolbarGroup-Insert",
  "toolbarGroup-Measure",
  "toolbarGroup-Redact",
  "toolbarGroup-View",
];

export const DEFAULT_VIEWER_SETTINGS: ViewerSettings = {
  theme: "light",
  fitMode: "FitWidth",
  hideToolbars: HIDDEN_TOOLBARS,
};

export function buildViewerOptions(
  initialDoc: string,
  overrides: Partial<WebViewerOptions> = {}
): Partial<WebViewerOptions> {
  return {
    initialDoc,
    enableFilePicker: false,
    // Disable incremental download — most uploaded PDFs are not linearized,
    // and the chunk-based downloader stalls on non-linearized files which
    // breaks ContentEdit WASM initialization.
    useDownloader: false,
    disabledElements: HIDDEN_TOOLBARS,
    ...overrides,
  };
}
