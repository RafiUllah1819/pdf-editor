import type { NextApiRequest, NextApiResponse } from "next";
import { unlink } from "fs/promises";
import { v4 as uuidv4 } from "uuid";
import { parseUpload } from "@/lib/upload";
import { getStorage } from "@/lib/storage";
import { getDb } from "@/lib/db";
import { createDocument } from "@/server/documents";
import { stripPdfExtension } from "@/lib/pdf";
import type { Document } from "@/types";

// Required: disable Next.js body parsing so formidable can read the stream
export const config = {
  api: { bodyParser: false },
};

type SuccessResponse = { document: Document };
type ErrorResponse = { error: string };

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<SuccessResponse | ErrorResponse>
) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  let tempPath: string | null = null;

  try {
    // 1. Parse multipart form — file lands in OS temp dir
    const upload = await parseUpload(req);
    tempPath = upload.tempPath;

    // 2. Move file into permanent storage with a UUID filename
    const destFilename = `${uuidv4()}.pdf`;
    const storage = getStorage();
    const storedPath = await storage.saveFile(upload.tempPath, destFilename);

    // 3. Persist metadata to PostgreSQL
    const document = await createDocument(getDb(), {
      title:        stripPdfExtension(upload.originalName),
      originalName: upload.originalName,
      filePath:     storedPath,
      fileSize:     upload.sizeBytes,
      pageCount:    0, // updated when PDF is opened in the editor
    });

    res.status(201).json({ document });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Upload failed";
    // 400 for validation errors (bad file type, too large), 500 for DB/storage errors
    const status = message.includes("Only PDF") || message.includes("too large") ? 400 : 500;
    res.status(status).json({ error: message });
  } finally {
    // Always clean up the OS temp file
    if (tempPath) {
      await unlink(tempPath).catch(() => {});
    }
  }
}
