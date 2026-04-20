import type { NextApiRequest, NextApiResponse } from "next";
import { readFile, unlink } from "fs/promises";
import { parseUpload } from "@/lib/upload";
import { getStorage } from "@/lib/storage";
import { getDb, withTransaction } from "@/lib/db";
import { createDocument } from "@/server/documents";
import { createVersion } from "@/server/documentVersions";
import { generateId, stripPdfExtension } from "@/lib/utils";
import type { Document } from "@/types";

export const config = {
  api: { bodyParser: false },
};

type SuccessResponse = { document: Document };
type ErrorResponse = { error: string };

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<SuccessResponse | ErrorResponse>
) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  let tempPath: string | null = null;

  try {
    const upload = await parseUpload(req);
    tempPath = upload.tempPath;

    const fileBuffer = await readFile(upload.tempPath);
    const key = `${generateId()}.pdf`;
    await getStorage().uploadFile(key, fileBuffer, "application/pdf");

    const document = await withTransaction(async (client) => {
      const doc = await createDocument(client, {
        userId:       null,
        title:        stripPdfExtension(upload.originalName),
        originalName: upload.originalName,
        filePath:     key,
        fileSize:     upload.sizeBytes,
        pageCount:    0,
      });
      // Seed version 1 — the original upload
      await createVersion(client, {
        documentId: doc.id,
        versionNum: 1,
        filePath:   key,
        fileSize:   upload.sizeBytes,
        label:      "original",
      });
      return doc;
    });

    res.status(201).json({ document });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Upload failed";
    const status =
      message.startsWith("Only PDF") ||
      message.startsWith("File too large") ||
      message.startsWith("No file received")
        ? 400 : 500;
    res.status(status).json({ error: message });
  } finally {
    if (tempPath) await unlink(tempPath).catch(() => {});
  }
}
