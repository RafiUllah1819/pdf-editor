/**
 * Storage abstraction layer.
 *
 * LocalStorageProvider  — writes to /uploads (development)
 * To add S3/R2 later: implement StorageProvider, then swap getStorage().
 */

import path from "path";
import fs from "fs/promises";
import { existsSync, mkdirSync } from "fs";

export interface StorageProvider {
  /**
   * Move/copy a file from a temporary source path into permanent storage.
   * Returns the stored path (used as `file_path` in the DB).
   */
  saveFile(sourcePath: string, destFilename: string): Promise<string>;

  /** Delete a stored file. Silently ignores missing files. */
  deleteFile(storedPath: string): Promise<void>;

  /**
   * Resolve a stored path to a URL the Next.js API can serve.
   * For local storage this is /api/files/<filename>.
   * For S3 this would be a signed URL or public CDN URL.
   */
  getServeUrl(storedPath: string): string;
}

// ---------------------------------------------------------------------------
// Local filesystem — development only
// ---------------------------------------------------------------------------

const UPLOADS_DIR = path.join(process.cwd(), "uploads");

class LocalStorageProvider implements StorageProvider {
  constructor() {
    if (!existsSync(UPLOADS_DIR)) {
      mkdirSync(UPLOADS_DIR, { recursive: true });
    }
  }

  async saveFile(sourcePath: string, destFilename: string): Promise<string> {
    const dest = path.join(UPLOADS_DIR, destFilename);
    await fs.copyFile(sourcePath, dest);
    return destFilename; // stored path is just the filename
  }

  async deleteFile(storedPath: string): Promise<void> {
    await fs.unlink(path.join(UPLOADS_DIR, storedPath)).catch(() => {});
  }

  getServeUrl(storedPath: string): string {
    return `/api/files/${encodeURIComponent(storedPath)}`;
  }
}

/**
 * Returns the active storage provider.
 * Swap the return value here when adding S3/R2:
 *   if (process.env.STORAGE === "s3") return new S3StorageProvider();
 */
export function getStorage(): StorageProvider {
  return new LocalStorageProvider();
}

/** Resolve a stored filename to an absolute path — local dev only. */
export function resolveLocalPath(storedPath: string): string {
  return path.join(UPLOADS_DIR, storedPath);
}
