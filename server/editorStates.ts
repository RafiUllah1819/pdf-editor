import { Pool, PoolClient } from "pg";
import { EditorState, Annotation } from "@/types";

// ---- Row mapper -----------------------------------------------------------

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function toEditorState(row: any): EditorState {
  return {
    id:          row.id,
    documentId:  row.document_id,
    annotations: (row.annotations_json as Annotation[]) ?? [],
    pageOrder:   (row.page_order_json as number[]) ?? [],
    createdAt:   row.created_at.toISOString(),
    updatedAt:   row.updated_at.toISOString(),
  };
}

// ---- Queries --------------------------------------------------------------

export async function getEditorState(
  db: Pool | PoolClient,
  documentId: string
): Promise<EditorState | null> {
  const { rows } = await db.query(
    `SELECT * FROM editor_states WHERE document_id = $1`,
    [documentId]
  );
  return rows.length ? toEditorState(rows[0]) : null;
}

/**
 * Returns the existing editor state for a document, or creates a blank one
 * if none exists yet. Safe to call on every editor page load.
 */
export async function getOrCreateEditorState(
  db: Pool | PoolClient,
  documentId: string,
  initialPageOrder: number[] = []
): Promise<EditorState> {
  const existing = await getEditorState(db, documentId);
  if (existing) return existing;

  const { rows } = await db.query(
    `INSERT INTO editor_states (document_id, annotations_json, page_order_json)
     VALUES ($1, '[]', $2)
     RETURNING *`,
    [documentId, JSON.stringify(initialPageOrder)]
  );
  return toEditorState(rows[0]);
}

export async function saveAnnotations(
  db: Pool | PoolClient,
  documentId: string,
  annotations: Annotation[]
): Promise<EditorState | null> {
  const { rows } = await db.query(
    `UPDATE editor_states
     SET annotations_json = $1
     WHERE document_id = $2
     RETURNING *`,
    [JSON.stringify(annotations), documentId]
  );
  return rows.length ? toEditorState(rows[0]) : null;
}

export async function savePageOrder(
  db: Pool | PoolClient,
  documentId: string,
  pageOrder: number[]
): Promise<EditorState | null> {
  const { rows } = await db.query(
    `UPDATE editor_states
     SET page_order_json = $1
     WHERE document_id = $2
     RETURNING *`,
    [JSON.stringify(pageOrder), documentId]
  );
  return rows.length ? toEditorState(rows[0]) : null;
}

export async function deleteEditorState(
  db: Pool | PoolClient,
  documentId: string
): Promise<boolean> {
  const { rowCount } = await db.query(
    `DELETE FROM editor_states WHERE document_id = $1`,
    [documentId]
  );
  return (rowCount ?? 0) > 0;
}
