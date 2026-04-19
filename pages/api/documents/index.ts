import type { NextApiRequest, NextApiResponse } from "next";
import { getDb } from "@/lib/db";
import { getAllDocuments } from "@/server/documents";
import { getSessionUser } from "@/lib/session";
import type { Document } from "@/types";

type SuccessResponse = { documents: Document[] };
type ErrorResponse = { error: string };

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<SuccessResponse | ErrorResponse>
) {
  if (req.method !== "GET") return res.status(405).json({ error: "Method not allowed" });

  const user = await getSessionUser(req, res);
  if (!user) return res.status(401).json({ error: "Not authenticated" });

  try {
    const documents = await getAllDocuments(getDb(), user.id);
    res.status(200).json({ documents });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to fetch documents";
    res.status(500).json({ error: message });
  }
}
