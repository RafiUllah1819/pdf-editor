import type { GetServerSideProps } from "next";
import dynamic from "next/dynamic";
import { getDb } from "@/lib/db";
import { getDocumentById } from "@/server/documents";
import { getLatestVersion } from "@/server/documentVersions";
import { getStorage } from "@/lib/storage";
import { getSession } from "@/lib/session";
import type { SessionUser } from "@/lib/session";
import type { Document } from "@/types";

const CommercialPdfEditor = dynamic(
  () => import("@/components/pdf/CommercialPdfEditor"),
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
  user: SessionUser;
};

export default function SdkEditorPage({ document, fileUrl }: Props) {
  return (
    <div className="h-screen flex flex-col">
      <CommercialPdfEditor
        documentId={document.id}
        pdfUrl={fileUrl}
        title={document.title}
        versionNum={document.latestVersionNum}
      />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Server-side: auth + ownership + file URL
// ---------------------------------------------------------------------------

export const getServerSideProps: GetServerSideProps<Props> = async ({
  req,
  res,
  params,
}) => {
  const session = await getSession(req, res);

  if (!session.user) {
    return { redirect: { destination: "/login", permanent: false } };
  }

  const id = params?.id;
  if (typeof id !== "string") return { notFound: true };

  try {
    const document = await getDocumentById(getDb(), id, session.user.id);
    if (!document) return { notFound: true };

    // Load the latest saved version (falls back to original if only v1 exists)
    const latestVersion = await getLatestVersion(getDb(), id, session.user.id);
    const storageKey = latestVersion?.filePath ?? document.filePath;
    const fileUrl = await getStorage().getDownloadUrl(storageKey);

    return {
      props: {
        document,
        fileUrl,
        user: session.user,
      },
    };
  } catch {
    return { notFound: true };
  }
};
