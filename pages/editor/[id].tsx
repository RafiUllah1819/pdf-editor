import type { GetServerSideProps } from "next";
import dynamic from "next/dynamic";
import { getDb } from "@/lib/db";
import { getDocumentById } from "@/server/documents";
import { getOrCreateEditorState } from "@/server/editorStates";
import { getStorage } from "@/lib/storage";
import { getSession } from "@/lib/session";
import type { SessionUser } from "@/lib/session";
import type { Annotation, Document } from "@/types";

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
  user: SessionUser;
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
// Server-side data fetching + auth + ownership check
// ---------------------------------------------------------------------------

export const getServerSideProps: GetServerSideProps<Props> = async ({ req, res, params }) => {
  const session = await getSession(req, res);

  if (!session.user) {
    return { redirect: { destination: "/login", permanent: false } };
  }

  const id = params?.id;
  if (typeof id !== "string") return { notFound: true };

  try {
    // getDocumentById scopes the query to session.user.id — returns null for wrong owner
    const document = await getDocumentById(getDb(), id, session.user.id);
    if (!document) return { notFound: true };

    const fileUrl = await getStorage().getDownloadUrl(document.filePath);
    const editorState = await getOrCreateEditorState(getDb(), document.id);

    return {
      props: {
        document,
        fileUrl,
        initialAnnotations: editorState.annotations,
        initialPageOrder:   editorState.pageOrder,
        user:               session.user,
      },
    };
  } catch {
    return { notFound: true };
  }
};
