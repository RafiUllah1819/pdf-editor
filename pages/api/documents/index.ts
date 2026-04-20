import type { NextApiRequest, NextApiResponse } from "next";
import { getDb } from "@/lib/db";
import { getAllDocuments } from "@/server/documents";
import type { Document } from "@/types";

type SuccessResponse = { documents: Document[] };
type ErrorResponse = { error: string };

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<SuccessResponse | ErrorResponse>
) {
  if (req.method !== "GET") return res.status(405).json({ error: "Method not allowed" });

  try {
    const documents = await getAllDocuments(getDb());
    res.status(200).json({ documents });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to fetch documents";
    res.status(500).json({ error: message });
  }
}
