import type { GetServerSideProps } from "next";
import dynamic from "next/dynamic";
import { getDb } from "@/lib/db";
import { getDocumentById } from "@/server/documents";
import { getOrCreateEditorState } from "@/server/editorStates";
import { getStorage } from "@/lib/storage";
import type { Annotation, Document } from "@/types";

// EditorShell (and everything it imports) must be browser-only — pdfjs-dist
// requires a window context and must not be bundled for the server.
const EditorShell = dynamic(() => import("@/components/editor/EditorShell"), {
  ssr: false,
  loading: () => (
    <div className="flex h-[calc(100vh-56px)] items-center justify-center bg-gray-100">
      <span className="text-sm text-gray-400">Loading editor…</span>
    </div>
  ),
});

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

type Props = {
  document: Document;
  fileUrl: string;
  initialAnnotations: Annotation[];
  initialPageOrder: number[];
};

export default function EditorPage({ document, fileUrl, initialAnnotations, initialPageOrder }: Props) {
  return (
    <EditorShell
      document={document}
      fileUrl={fileUrl}
      initialAnnotations={initialAnnotations}
      initialPageOrder={initialPageOrder}
    />
  );
}

// ---------------------------------------------------------------------------
// Server-side data fetching
// ---------------------------------------------------------------------------

export const getServerSideProps: GetServerSideProps<Props> = async ({ params }) => {
  const id = params?.id;
  if (typeof id !== "string") return { notFound: true };

  try {
    const document = await getDocumentById(getDb(), id);
    if (!document) return { notFound: true };

    const fileUrl = getStorage().getServeUrl(document.filePath);
    const editorState = await getOrCreateEditorState(getDb(), document.id);
    return {
      props: {
        document,
        fileUrl,
        initialAnnotations: editorState.annotations,
        initialPageOrder: editorState.pageOrder,
      },
    };
  } catch {
    return { notFound: true };
  }
};
