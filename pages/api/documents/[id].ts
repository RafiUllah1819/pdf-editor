import type { NextApiRequest, NextApiResponse } from "next";
import { getDb } from "@/lib/db";
import { getDocumentById } from "@/server/documents";
import type { Document } from "@/types";

type SuccessResponse = { document: Document };
type ErrorResponse = { error: string };

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<SuccessResponse | ErrorResponse>
) {
  if (req.method !== "GET") return res.status(405).json({ error: "Method not allowed" });

  const { id } = req.query;
  if (typeof id !== "string") return res.status(400).json({ error: "Invalid document ID" });

  try {
    const document = await getDocumentById(getDb(), id);
    if (!document) return res.status(404).json({ error: "Document not found" });
    res.status(200).json({ document });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to fetch document";
    res.status(500).json({ error: message });
  }
}
