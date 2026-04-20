/**
 * Storage abstraction layer.
 *
 * Two providers are available; select via the STORAGE_PROVIDER env var:
 *
 *   STORAGE_PROVIDER=local   (default) — saves to ./uploads/ on the server
 *   STORAGE_PROVIDER=s3      — uploads to Amazon S3 or Cloudflare R2
 *
 * The value stored in `documents.file_path` is always the storage key
 * (just the filename, e.g. "550e8400.pdf").  The key is the same for
 * both providers, so switching providers only requires re-uploading files.
 *
 * To add a new provider (GCS, Azure Blob, etc.) implement StorageProvider
 * and add a branch in getStorage().
 */

import path from "path";
import fs from "fs/promises";
import { existsSync, mkdirSync } from "fs";

// ---------------------------------------------------------------------------
// Interface
// ---------------------------------------------------------------------------

export interface StorageProvider {
  /**
   * Upload file bytes under the given key.
   * `key` is persisted in the database as `file_path`.
   */
  uploadFile(key: string, data: Buffer, contentType: string): Promise<void>;

  /** Delete a stored file. Silently ignores missing files. */
  deleteFile(key: string): Promise<void>;

  /**
   * Return a URL the browser can use to fetch the file.
   *
   * Local:  /api/files/<key>  (served by the Next.js dev route)
   * S3/R2 public bucket:  ${S3_PUBLIC_URL}/<key>
   * S3/R2 private bucket: presigned GetObject URL (1-hour expiry)
   */
  getDownloadUrl(key: string): Promise<string>;

  /**
   * Read the raw file bytes on the server side.
   * Used by the PDF export route to load the source PDF.
   *
   * Local:  reads ./uploads/<key> from disk
   * S3/R2:  streams the object body into a Buffer
   */
  readFile(key: string): Promise<Buffer>;
}

// ---------------------------------------------------------------------------
// Local filesystem provider — development only
// ---------------------------------------------------------------------------

const UPLOADS_DIR = path.join(process.cwd(), "uploads");

class LocalStorageProvider implements StorageProvider {
  constructor() {
    if (!existsSync(UPLOADS_DIR)) mkdirSync(UPLOADS_DIR, { recursive: true });
  }

  async uploadFile(key: string, data: Buffer): Promise<void> {
    await fs.writeFile(path.join(UPLOADS_DIR, key), data);
  }

  async deleteFile(key: string): Promise<void> {
    await fs.unlink(path.join(UPLOADS_DIR, key)).catch(() => {});
  }

  async getDownloadUrl(key: string): Promise<string> {
    return `/api/files/${encodeURIComponent(key)}`;
  }

  async readFile(key: string): Promise<Buffer> {
    return fs.readFile(path.join(UPLOADS_DIR, key));
  }
}

// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------

/**
 * Returns the active StorageProvider based on the STORAGE_PROVIDER env var.
 *
 * The S3 provider is loaded lazily via require() so that missing AWS SDK
 * packages do not break the local development build.
 *
 * Before switching to "s3", install the required packages:
 *   npm install @aws-sdk/client-s3 @aws-sdk/s3-request-presigner
 */
let _storageInstance: StorageProvider | null = null;

export function getStorage(): StorageProvider {
  if (_storageInstance) return _storageInstance;

  const provider = process.env.STORAGE_PROVIDER ?? "local";

  if (provider === "s3") {
    // Lazy require — only evaluated when STORAGE_PROVIDER=s3
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { createS3Provider } = require("./storage-s3") as typeof import("./storage-s3");
    _storageInstance = createS3Provider();
  } else {
    _storageInstance = new LocalStorageProvider();
  }

  return _storageInstance;
}
