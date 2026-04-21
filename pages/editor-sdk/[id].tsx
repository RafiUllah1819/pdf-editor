import type { GetServerSideProps } from "next";
import dynamic from "next/dynamic";
import { getDb } from "@/lib/db";
import { getDocumentById } from "@/server/documents";
import { getLatestVersion } from "@/server/documentVersions";
import { getStorage } from "@/lib/storage";
import type { Document } from "@/types";

const FreeTextEditor = dynamic(
  () => import("@/components/pdf/FreeTextEditor"),
  {
    ssr: false,
    loading: () => (
      <div className="flex h-screen items-center justify-center bg-gray-100">
        <span className="text-sm text-gray-400">Loading editor…</span>
      </div>
    ),
  }
);

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

type Props = {
  document: Document;
  fileUrl: string;
};

export default function SdkEditorPage({ document, fileUrl }: Props) {
  return (
    <div className="h-screen flex flex-col">
      <FreeTextEditor
        documentId={document.id}
        pdfUrl={fileUrl}
        title={document.title}
      />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Server-side: auth + ownership + file URL
// ---------------------------------------------------------------------------

export const getServerSideProps: GetServerSideProps<Props> = async ({ params }) => {
  const id = params?.id;
  if (typeof id !== "string") return { notFound: true };

  const db = getDb();

  const document = await getDocumentById(db, id);
  if (!document) return { notFound: true };

  let storageKey = document.filePath;
  try {
    const latestVersion = await getLatestVersion(db, id);
    if (latestVersion) storageKey = latestVersion.filePath;
  } catch {
    // versions table missing or unavailable — original file is fine
  }

  const fileUrl = await getStorage().getDownloadUrl(storageKey);

  return {
    props: {
      document,
      fileUrl,
    },
  };
};
