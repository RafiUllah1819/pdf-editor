import type { NextApiRequest, NextApiResponse } from "next";
import { getDb, withTransaction } from "@/lib/db";
import { getDocumentById } from "@/server/documents";
import { createVersion } from "@/server/documentVersions";
import { getStorage } from "@/lib/storage";
import { generateId } from "@/lib/utils";

type SuccessResponse = { ok: true; versionNum: number; filePath: string };
type ErrorResponse = { error: string };

export const config = {
  api: {
    // Raw binary upload — body parser must be disabled so the request stream
    // remains readable via `for await (const chunk of req)`.
    bodyParser: false,
  },
};

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<SuccessResponse | ErrorResponse>
) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const { documentId } = req.query;
  if (typeof documentId !== "string") {
    return res.status(400).json({ error: "Invalid document ID" });
  }

  try {
    const document = await getDocumentById(getDb(), documentId);
    if (!document) return res.status(404).json({ error: "Document not found" });

    // Read raw PDF bytes from request body
    const chunks: Buffer[] = [];
    for await (const chunk of req) {
      chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk as ArrayBuffer));
    }
    const pdfBuffer = Buffer.concat(chunks);

    if (pdfBuffer.length === 0) {
      return res.status(400).json({ error: "Empty PDF body" });
    }

    // Each version gets its own storage key — the original is never touched
    const versionKey = `${generateId()}.pdf`;
    await getStorage().uploadFile(versionKey, pdfBuffer, "application/pdf");

    // Atomically increment latest_version_num and insert the version record
    const newVersionNum = await withTransaction(async (client) => {
      const { rows } = await client.query(
        `UPDATE documents
         SET latest_version_num = latest_version_num + 1
         WHERE id = $1
         RETURNING latest_version_num`,
        [documentId]
      );

      if (!rows.length) throw new Error("Document not found");

      const num: number = rows[0].latest_version_num;

      await createVersion(client, {
        documentId,
        versionNum: num,
        filePath:   versionKey,
        fileSize:   pdfBuffer.length,
        label:      "edited",
      });

      return num;
    });

    return res.status(200).json({ ok: true, versionNum: newVersionNum, filePath: versionKey });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to save document";
    return res.status(500).json({ error: message });
  }
}
