/**
 * Multipart form parser.
 * Saves the uploaded file to the OS temp directory.
 * The caller (API route) is responsible for moving it via StorageProvider
 * and deleting the temp file when done.
 */

import formidable from "formidable";
import type { IncomingMessage } from "http";

export type ParsedUpload = {
  tempPath: string;     // absolute path to the temp file
  originalName: string;
  mimeType: string;
  sizeBytes: number;
};

const MAX_FILE_SIZE = 20 * 1024 * 1024; // 20 MB

export async function parseUpload(req: IncomingMessage): Promise<ParsedUpload> {
  const form = formidable({
    maxFileSize: MAX_FILE_SIZE,
    keepExtensions: true,
    // No uploadDir — defaults to os.tmpdir(); caller moves the file
  });

  return new Promise((resolve, reject) => {
    form.parse(req, (err, _fields, files) => {
      if (err) {
        // formidable error code 1009 = file too large
        const message =
          (err as NodeJS.ErrnoException & { code?: number }).code === 1009
            ? `File too large. Maximum size is ${MAX_FILE_SIZE / (1024 * 1024)} MB.`
            : err.message;
        return reject(new Error(message));
      }

      const fileArray = files.file;
      const uploaded = Array.isArray(fileArray) ? fileArray[0] : fileArray;

      if (!uploaded) {
        return reject(new Error("No file received. Make sure the field name is 'file'."));
      }

      const mimeType = uploaded.mimetype ?? "";
      if (mimeType !== "application/pdf") {
        return reject(new Error("Only PDF files are accepted."));
      }

      resolve({
        tempPath: uploaded.filepath,
        originalName: uploaded.originalFilename ?? "document.pdf",
        mimeType,
        sizeBytes: uploaded.size,
      });
    });
  });
}
