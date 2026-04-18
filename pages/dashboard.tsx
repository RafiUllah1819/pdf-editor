import type { GetServerSideProps } from "next";
import Link from "next/link";
import { useRouter } from "next/router";
import { useRef, useState } from "react";
import { getDb } from "@/lib/db";
import { getAllDocuments } from "@/server/documents";
import { formatDate, formatBytes } from "@/lib/utils";
import type { Document } from "@/types";

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

type Props = {
  documents: Document[];
  dbError?: string;
};

export default function DashboardPage({ documents, dbError }: Props) {
  const router = useRouter();

  function handleUploadSuccess() {
    // Re-run getServerSideProps to pick up the new document
    router.replace(router.asPath);
  }

  return (
    <div className="mx-auto max-w-5xl px-6 py-10">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">My Documents</h1>
          {!dbError && (
            <p className="mt-1 text-sm text-gray-500">
              {documents.length} document{documents.length !== 1 ? "s" : ""}
            </p>
          )}
        </div>
      </div>

      {/* DB connection error */}
      {dbError && (
        <div className="mt-6 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          <strong>Database error:</strong> {dbError}
        </div>
      )}

      {/* Upload form */}
      <UploadForm onSuccess={handleUploadSuccess} />

      {/* Document grid */}
      {!dbError && documents.length > 0 && (
        <div className="mt-8 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {documents.map((doc) => (
            <DocumentCard key={doc.id} doc={doc} />
          ))}
        </div>
      )}

      {!dbError && documents.length === 0 && (
        <div className="mt-16 flex flex-col items-center text-center text-gray-400">
          <svg className="h-12 w-12" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
              d="M9 13h6m-3-3v6m5 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          </svg>
          <p className="mt-3 text-base font-medium">No documents yet</p>
          <p className="mt-1 text-sm">Upload a PDF above to get started.</p>
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Upload form
// ---------------------------------------------------------------------------

type UploadFormProps = { onSuccess: () => void };

function UploadForm({ onSuccess }: UploadFormProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const MAX_MB = 20;

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0] ?? null;
    setError(null);

    if (!file) return;

    if (file.type !== "application/pdf") {
      setError("Only PDF files are accepted.");
      setSelectedFile(null);
      return;
    }
    if (file.size > MAX_MB * 1024 * 1024) {
      setError(`File is too large. Maximum size is ${MAX_MB} MB.`);
      setSelectedFile(null);
      return;
    }

    setSelectedFile(file);
  }

  async function handleUpload() {
    if (!selectedFile) return;

    setUploading(true);
    setError(null);

    try {
      const formData = new FormData();
      formData.append("file", selectedFile);

      const res = await fetch("/api/documents/upload", {
        method: "POST",
        body: formData,
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error ?? "Upload failed");
      }

      // Reset form
      setSelectedFile(null);
      if (inputRef.current) inputRef.current.value = "";
      onSuccess();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setUploading(false);
    }
  }

  return (
    <div className="mt-6 rounded-xl border border-dashed border-gray-300 bg-white p-6">
      <p className="mb-3 text-sm font-medium text-gray-700">Upload a PDF</p>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        {/* File input */}
        <label className="flex-1 cursor-pointer">
          <input
            ref={inputRef}
            type="file"
            accept="application/pdf,.pdf"
            className="hidden"
            onChange={handleFileChange}
            disabled={uploading}
          />
          <div className="flex items-center gap-2 rounded-lg border border-gray-200 px-4 py-2.5 text-sm text-gray-600 hover:bg-gray-50">
            <svg className="h-4 w-4 shrink-0 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" />
            </svg>
            <span className="truncate">
              {selectedFile ? selectedFile.name : "Choose a PDF file…"}
            </span>
          </div>
        </label>

        {/* Upload button */}
        <button
          onClick={handleUpload}
          disabled={!selectedFile || uploading}
          className="shrink-0 rounded-lg bg-indigo-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {uploading ? "Uploading…" : "Upload"}
        </button>
      </div>

      {/* File info */}
      {selectedFile && !error && (
        <p className="mt-2 text-xs text-gray-400">
          {formatBytes(selectedFile.size)} · PDF
        </p>
      )}

      {/* Error message */}
      {error && (
        <p className="mt-2 text-xs font-medium text-red-600">{error}</p>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Document card
// ---------------------------------------------------------------------------

function DocumentCard({ doc }: { doc: Document }) {
  return (
    <div className="flex flex-col rounded-xl border border-gray-200 bg-white p-5 shadow-sm transition-shadow hover:shadow-md">
      <div className="flex items-start justify-between">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-indigo-50 text-indigo-600">
          <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
              d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
          </svg>
        </div>
        <span className="text-xs text-gray-400">{doc.pageCount || "?"} pages</span>
      </div>

      <h3 className="mt-3 truncate text-sm font-semibold text-gray-900" title={doc.title}>
        {doc.title}
      </h3>
      <p className="mt-0.5 truncate text-xs text-gray-400" title={doc.originalName}>
        {doc.originalName}
      </p>
      <p className="mt-1 text-xs text-gray-400">
        {formatBytes(doc.fileSize)} · {formatDate(doc.updatedAt)}
      </p>

      <div className="mt-4 flex gap-2">
        <Link
          href={`/editor/${doc.id}`}
          className="flex-1 rounded-lg bg-indigo-600 py-1.5 text-center text-xs font-semibold text-white hover:bg-indigo-700"
        >
          Open Editor
        </Link>
        <button
          disabled
          title="Download coming soon"
          className="rounded-lg border border-gray-200 px-3 py-1.5 text-xs font-semibold text-gray-600 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-40"
        >
          Download
        </button>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Server-side data fetching
// ---------------------------------------------------------------------------

export const getServerSideProps: GetServerSideProps<Props> = async () => {
  try {
    const documents = await getAllDocuments(getDb());
    return { props: { documents } };
  } catch (err) {
    const dbError = err instanceof Error ? err.message : "Could not connect to database";
    return { props: { documents: [], dbError } };
  }
};
