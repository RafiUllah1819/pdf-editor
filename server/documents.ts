import type { Pool, PoolClient } from "pg";
import type { Document } from "@/types";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function toDocument(row: any): Document {
  return {
    id:               row.id,
    title:            row.title,
    originalName:     row.original_name,
    filePath:         row.file_path,
    fileSize:         row.file_size,
    pageCount:        row.page_count,
    latestVersionNum: row.latest_version_num ?? 1,
    createdAt:        row.created_at.toISOString(),
    updatedAt:        row.updated_at.toISOString(),
  };
}

// ── Queries ───────────────────────────────────────────────────────────────────

/** Returns all documents, newest first. */
export async function getAllDocuments(
  db: Pool | PoolClient
): Promise<Document[]> {
  const { rows } = await db.query(
    "SELECT * FROM documents ORDER BY updated_at DESC"
  );
  return rows.map(toDocument);
}

/** Fetch a single document by ID. Returns null if not found. */
export async function getDocumentById(
  db: Pool | PoolClient,
  id: string
): Promise<Document | null> {
  const { rows } = await db.query(
    "SELECT * FROM documents WHERE id = $1",
    [id]
  );
  return rows.length ? toDocument(rows[0]) : null;
}

export type CreateDocumentInput = {
  userId?: string | null;
  title: string;
  originalName: string;
  filePath: string;
  fileSize: number;
  pageCount: number;
};

export async function createDocument(
  db: Pool | PoolClient,
  input: CreateDocumentInput
): Promise<Document> {
  const { rows } = await db.query(
    `INSERT INTO documents (user_id, title, original_name, file_path, file_size, page_count)
     VALUES ($1, $2, $3, $4, $5, $6)
     RETURNING *`,
    [input.userId, input.title, input.originalName, input.filePath, input.fileSize, input.pageCount]
  );
  return toDocument(rows[0]);
}

export async function updateDocumentTitle(
  db: Pool | PoolClient,
  id: string,
  title: string
): Promise<Document | null> {
  const { rows } = await db.query(
    "UPDATE documents SET title = $1 WHERE id = $2 RETURNING *",
    [title, id]
  );
  return rows.length ? toDocument(rows[0]) : null;
}

export async function deleteDocument(
  db: Pool | PoolClient,
  id: string
): Promise<boolean> {
  const { rowCount } = await db.query(
    "DELETE FROM documents WHERE id = $1",
    [id]
  );
  return (rowCount ?? 0) > 0;
}
