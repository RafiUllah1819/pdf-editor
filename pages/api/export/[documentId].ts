import type { NextApiRequest, NextApiResponse } from "next";
import fs from "fs/promises";
import { getDb } from "@/lib/db";
import { getDocumentById } from "@/server/documents";
import { getEditorState } from "@/server/editorStates";
import { resolveLocalPath } from "@/lib/storage";
import { exportPdf } from "@/lib/exportPdf";

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const { documentId } = req.query;
  if (typeof documentId !== "string") {
    return res.status(400).json({ error: "Invalid documentId" });
  }

  const db = getDb();

  const document = await getDocumentById(db, documentId).catch(() => null);
  if (!document) return res.status(404).json({ error: "Document not found" });

  const editorState = await getEditorState(db, documentId).catch(() => null);
  const annotations = editorState?.annotations ?? [];

  let sourcePdfBytes: Buffer;
  try {
    const filePath = resolveLocalPath(document.filePath);
    sourcePdfBytes = await fs.readFile(filePath);
  } catch {
    return res.status(500).json({ error: "Could not read source PDF" });
  }

  let exportedBytes: Uint8Array;
  try {
    exportedBytes = await exportPdf(sourcePdfBytes, annotations, editorState?.pageOrder ?? []);
  } catch (err) {
    console.error("PDF export error:", err);
    return res.status(500).json({ error: "Export failed" });
  }

  const filename = `${document.title.replace(/[^a-z0-9_\-]/gi, "_")}_annotated.pdf`;

  res.setHeader("Content-Type", "application/pdf");
  res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
  res.setHeader("Content-Length", exportedBytes.byteLength);
  res.status(200).end(Buffer.from(exportedBytes));
}
