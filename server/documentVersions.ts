import type { Pool, PoolClient } from "pg";
import type { DocumentVersion } from "@/types";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function toVersion(row: any): DocumentVersion {
  return {
    id:         row.id,
    documentId: row.document_id,
    versionNum: row.version_num,
    filePath:   row.file_path,
    fileSize:   row.file_size,
    label:      row.label ?? undefined,
    createdAt:  row.created_at.toISOString(),
  };
}

export type CreateVersionInput = {
  documentId: string;
  versionNum: number;
  filePath: string;
  fileSize: number;
  label?: string;
};

export async function createVersion(
  db: Pool | PoolClient,
  input: CreateVersionInput
): Promise<DocumentVersion> {
  const { rows } = await db.query(
    `INSERT INTO document_versions (document_id, version_num, file_path, file_size, label)
     VALUES ($1, $2, $3, $4, $5)
     RETURNING *`,
    [input.documentId, input.versionNum, input.filePath, input.fileSize, input.label ?? null]
  );
  return toVersion(rows[0]);
}

/**
 * Returns the version record for a document's latest version.
 * Scoped to userId to prevent cross-user access.
 */
export async function getLatestVersion(
  db: Pool | PoolClient,
  documentId: string,
  userId: string
): Promise<DocumentVersion | null> {
  const { rows } = await db.query(
    `SELECT v.*
     FROM   document_versions v
     JOIN   documents d ON d.id = v.document_id
     WHERE  v.document_id = $1
       AND  d.user_id = $2
       AND  v.version_num = d.latest_version_num`,
    [documentId, userId]
  );
  return rows.length ? toVersion(rows[0]) : null;
}

/**
 * Returns all versions for a document, oldest first.
 * Scoped to userId to prevent cross-user access.
 */
export async function listVersions(
  db: Pool | PoolClient,
  documentId: string,
  userId: string
): Promise<DocumentVersion[]> {
  const { rows } = await db.query(
    `SELECT v.*
     FROM   document_versions v
     JOIN   documents d ON d.id = v.document_id
     WHERE  v.document_id = $1
       AND  d.user_id = $2
     ORDER  BY v.version_num ASC`,
    [documentId, userId]
  );
  return rows.map(toVersion);
}
