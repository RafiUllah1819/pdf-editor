import type { NextApiRequest, NextApiResponse } from "next";
import { getDb } from "@/lib/db";
import { getDocumentById } from "@/server/documents";
import { getOrCreateEditorState, saveEditorState } from "@/server/editorStates";
import { getSessionUser } from "@/lib/session";
import type { Annotation, EditorState } from "@/types";

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<EditorState | { error: string }>
) {
  const user = await getSessionUser(req, res);
  if (!user) return res.status(401).json({ error: "Not authenticated" });

  const documentId = req.query.documentId;
  if (typeof documentId !== "string") {
    return res.status(400).json({ error: "Invalid documentId" });
  }

  const db = getDb();

  // Verify the document exists and belongs to the requesting user
  const document = await getDocumentById(db, documentId, user.id);
  if (!document) return res.status(404).json({ error: "Document not found" });

  if (req.method === "GET") {
    try {
      const state = await getOrCreateEditorState(db, documentId);
      return res.status(200).json(state);
    } catch (err) {
      console.error("GET editor-state error:", err);
      return res.status(500).json({ error: "Failed to load editor state" });
    }
  }

  if (req.method === "PUT") {
    try {
      const { annotations, pageOrder } = req.body as {
        annotations: Annotation[];
        pageOrder: number[];
      };
      if (!Array.isArray(annotations)) {
        return res.status(400).json({ error: "annotations must be an array" });
      }
      if (!Array.isArray(pageOrder)) {
        return res.status(400).json({ error: "pageOrder must be an array" });
      }
      const state = await saveEditorState(db, documentId, annotations, pageOrder);
      if (!state) return res.status(404).json({ error: "Editor state not found" });
      return res.status(200).json(state);
    } catch (err) {
      console.error("PUT editor-state error:", err);
      return res.status(500).json({ error: "Failed to save editor state" });
    }
  }

  res.setHeader("Allow", ["GET", "PUT"]);
  return res.status(405).json({ error: "Method not allowed" });
}
