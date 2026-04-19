import type { WebViewerOptions } from "@/lib/apryse";

export type ViewerSettings = {
  theme: "light" | "dark";
  fitMode: "FitWidth" | "FitPage";
  showToolbars: string[];
  hideToolbars: string[];
};

export const DEFAULT_VIEWER_SETTINGS: ViewerSettings = {
  theme: "light",
  fitMode: "FitWidth",
  showToolbars: ["toolbarGroup-View", "toolbarGroup-Annotate", "toolbarGroup-Edit"],
  hideToolbars: [
    "toolbarGroup-Shapes",
    "toolbarGroup-Insert",
    "toolbarGroup-Measure",
    "toolbarGroup-FillAndSign",
    "toolbarGroup-Forms",
    "toolbarGroup-Redact",
  ],
};

export function buildViewerOptions(
  initialDoc: string,
  overrides: Partial<WebViewerOptions> = {}
): Partial<WebViewerOptions> {
  return {
    initialDoc,
    enableFilePicker: false,
    ...overrides,
  };
}
