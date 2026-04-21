import type { GetServerSideProps } from "next";
import Link from "next/link";
import { useRouter } from "next/router";
import { useRef, useState } from "react";
import { getDb } from "@/lib/db";
import { getDocumentsByUserId } from "@/server/documents";
import { getSession } from "@/lib/session";
import { formatDate, formatBytes } from "@/lib/utils";
import { AlertBanner, EmptyState, Spinner } from "@/components/ui";
import type { Document } from "@/types";

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

type Props = {
  documents: Document[];
  userEmail: string | null;
  dbError?: string;
};

export default function DashboardPage({ documents, userEmail, dbError }: Props) {
  const router = useRouter();

  return (
    <div className="mx-auto max-w-5xl px-4 py-10 sm:px-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">
            {userEmail ? "My Documents" : "PDF Editor"}
          </h1>
          {userEmail && !dbError && (
            <p className="mt-1 text-sm text-gray-500">
              {documents.length === 0
                ? "No documents yet"
                : `${documents.length} document${documents.length !== 1 ? "s" : ""}`}
            </p>
          )}
          {!userEmail && (
            <p className="mt-1 text-sm text-gray-500">Upload a PDF to edit and download it.</p>
          )}
        </div>
        {userEmail && (
          <div className="flex items-center gap-3">
            <span className="hidden sm:block text-xs text-gray-500">{userEmail}</span>
            <LogoutButton />
          </div>
        )}
      </div>

      {dbError && (
        <div className="mt-6">
          <AlertBanner variant="error">
            <strong>Database unavailable:</strong> {dbError}
          </AlertBanner>
        </div>
      )}

      {/* Upload form — available to everyone */}
      {!dbError && (
        <UploadForm onSuccess={(docId) => router.push(`/editor-sdk/${docId}`)} />
      )}

      {/* Anonymous hint */}
      {!userEmail && !dbError && (
        <p className="mt-3 text-center text-xs text-gray-400">
          <Link href="/login" className="text-indigo-500 hover:underline">Sign in</Link>
          {" "}to save your documents and access them later.
        </p>
      )}

      {/* Logged-in: show their documents */}
      {userEmail && !dbError && documents.length > 0 && (
        <div className="mt-8 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {documents.map((doc) => (
            <DocumentCard key={doc.id} doc={doc} />
          ))}
        </div>
      )}

      {userEmail && !dbError && documents.length === 0 && (
        <EmptyState
          icon={
            <svg className="h-12 w-12" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1}
                d="M9 13h6m-3-3v6m5 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
          }
          title="No documents yet"
          description="Upload a PDF above to get started."
        />
      )}
    </div>
  );
}

function LogoutButton() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  async function handleLogout() {
    setLoading(true);
    await fetch("/api/auth/logout", { method: "POST" });
    router.replace("/dashboard");
  }

  return (
    <button
      onClick={handleLogout}
      disabled={loading}
      className="rounded-md border border-gray-200 px-3 py-1.5 text-xs font-medium text-gray-600 hover:bg-gray-50 transition-colors disabled:opacity-50"
    >
      {loading ? "Signing out…" : "Sign out"}
    </button>
  );
}

// ---------------------------------------------------------------------------
// Upload form — supports click-to-browse and drag-and-drop
// ---------------------------------------------------------------------------

const MAX_MB = 20;

type UploadFormProps = { onSuccess: (docId: string) => void };

function UploadForm({ onSuccess }: UploadFormProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);

  function validateAndSet(file: File | null) {
    setError(null);
    if (!file) return;
    if (file.type !== "application/pdf") {
      setError("Only PDF files are accepted. Please choose a .pdf file.");
      return;
    }
    if (file.size > MAX_MB * 1024 * 1024) {
      setError(`File exceeds the ${MAX_MB} MB limit (yours is ${(file.size / 1024 / 1024).toFixed(1)} MB).`);
      return;
    }
    setSelectedFile(file);
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    setIsDragging(false);
    validateAndSet(e.dataTransfer.files?.[0] ?? null);
  }

  async function handleUpload() {
    if (!selectedFile) return;
    setUploading(true);
    setError(null);

    try {
      const formData = new FormData();
      formData.append("file", selectedFile);
      const res = await fetch("/api/documents/upload", { method: "POST", body: formData });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error((data as { error?: string }).error ?? "Upload failed.");
      setSelectedFile(null);
      if (inputRef.current) inputRef.current.value = "";
      onSuccess((data as { document: { id: string } }).document.id);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload failed.");
    } finally {
      setUploading(false);
    }
  }

  return (
    <div className="mt-6">
      <div
        onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={handleDrop}
        onClick={() => !uploading && inputRef.current?.click()}
        className={`cursor-pointer rounded-xl border-2 border-dashed px-6 py-8 text-center transition-colors
          ${isDragging
            ? "border-indigo-400 bg-indigo-50"
            : "border-gray-300 bg-white hover:border-indigo-300 hover:bg-gray-50"
          }`}
      >
        <input
          ref={inputRef}
          type="file"
          accept="application/pdf,.pdf"
          className="hidden"
          onChange={(e) => validateAndSet(e.target.files?.[0] ?? null)}
          disabled={uploading}
        />

        {uploading ? (
          <div className="flex flex-col items-center gap-2 text-gray-500">
            <Spinner className="h-7 w-7 text-indigo-500" />
            <span className="text-sm font-medium">Uploading…</span>
          </div>
        ) : selectedFile ? (
          <div className="flex flex-col items-center gap-1">
            <svg className="h-8 w-8 text-indigo-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
            </svg>
            <p className="text-sm font-semibold text-gray-800">{selectedFile.name}</p>
            <p className="text-xs text-gray-400">{formatBytes(selectedFile.size)}</p>
            <p className="mt-1 text-xs text-gray-400">Click to choose a different file</p>
          </div>
        ) : (
          <div className="flex flex-col items-center gap-2">
            <svg className="h-8 w-8 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
            </svg>
            <p className="text-sm font-medium text-gray-700">
              Drop a PDF here, or <span className="text-indigo-600 underline underline-offset-2">browse</span>
            </p>
            <p className="text-xs text-gray-400">PDF only · max {MAX_MB} MB</p>
          </div>
        )}
      </div>

      {error && (
        <div className="mt-3"><AlertBanner variant="error">{error}</AlertBanner></div>
      )}

      {selectedFile && !uploading && (
        <div className="mt-3 flex justify-end">
          <button
            onClick={handleUpload}
            className="rounded-lg bg-indigo-600 px-5 py-2 text-sm font-semibold text-white hover:bg-indigo-700 transition-colors"
          >
            Upload
          </button>
        </div>
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
        <div className="flex items-center gap-1.5">
          {doc.latestVersionNum > 1 && (
            <span className="rounded-full bg-indigo-50 px-2 py-0.5 text-xs font-medium text-indigo-600 ring-1 ring-inset ring-indigo-200">
              v{doc.latestVersionNum}
            </span>
          )}
          <span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-500">
            {doc.pageCount || "?"} pp
          </span>
        </div>
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

      <div className="mt-4">
        <Link
          href={`/editor-sdk/${doc.id}`}
          className="block w-full rounded-lg bg-indigo-600 py-1.5 text-center text-xs font-semibold text-white hover:bg-indigo-700 transition-colors"
        >
          Edit PDF
        </Link>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Server-side data fetching + auth guard
// ---------------------------------------------------------------------------

export const getServerSideProps: GetServerSideProps<Props> = async ({ req, res }) => {
  const session = await getSession(req, res);
  const userEmail = session.user?.email ?? null;
  const userId = session.user?.id ?? null;

  if (!userId) {
    return { props: { documents: [], userEmail: null } };
  }

  try {
    const documents = await getDocumentsByUserId(getDb(), userId);
    return { props: { documents, userEmail } };
  } catch (err) {
    const dbError = err instanceof Error ? err.message : "Could not connect to database";
    return { props: { documents: [], userEmail, dbError } };
  }
};
