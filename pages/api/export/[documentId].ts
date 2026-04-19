import type { NextApiRequest, NextApiResponse } from "next";
import { getDb } from "@/lib/db";
import { getDocumentById } from "@/server/documents";
import { getEditorState } from "@/server/editorStates";
import { getStorage } from "@/lib/storage";
import { getSessionUser } from "@/lib/session";
import { exportPdf } from "@/lib/exportPdf";

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== "GET") return res.status(405).json({ error: "Method not allowed" });

  const user = await getSessionUser(req, res);
  if (!user) return res.status(401).json({ error: "Not authenticated" });

  const { documentId } = req.query;
  if (typeof documentId !== "string") {
    return res.status(400).json({ error: "Invalid documentId" });
  }

  const db = getDb();

  // getDocumentById enforces ownership — returns null if wrong user
  const document = await getDocumentById(db, documentId, user.id);
  if (!document) return res.status(404).json({ error: "Document not found" });

  const editorState = await getEditorState(db, documentId).catch(() => null);
  const annotations = editorState?.annotations ?? [];
  const pageOrder   = editorState?.pageOrder   ?? [];

  let sourcePdfBytes: Buffer;
  try {
    sourcePdfBytes = await getStorage().readFile(document.filePath);
  } catch {
    return res.status(500).json({ error: "Could not read source PDF from storage" });
  }

  let exportedBytes: Uint8Array;
  try {
    exportedBytes = await exportPdf(sourcePdfBytes, annotations, pageOrder);
  } catch (err) {
    console.error("PDF export error:", err);
    return res.status(500).json({ error: "Export failed" });
  }

  const safeTitle = document.title.replace(/[^a-z0-9_\-]/gi, "_");
  res.setHeader("Content-Type", "application/pdf");
  res.setHeader("Content-Disposition", `attachment; filename="${safeTitle}_annotated.pdf"`);
  res.setHeader("Content-Length", exportedBytes.byteLength);
  res.status(200).end(Buffer.from(exportedBytes));
}
