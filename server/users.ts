import type { Pool, PoolClient } from "pg";

export type User = {
  id: string;
  email: string;
  passwordHash: string;
  createdAt: string;
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function toUser(row: any): User {
  return {
    id:           row.id,
    email:        row.email,
    passwordHash: row.password_hash,
    createdAt:    row.created_at.toISOString(),
  };
}

export async function getUserByEmail(
  db: Pool | PoolClient,
  email: string
): Promise<User | null> {
  const { rows } = await db.query(
    "SELECT * FROM users WHERE email = $1",
    [email.toLowerCase().trim()]
  );
  return rows.length ? toUser(rows[0]) : null;
}

export async function createUser(
  db: Pool | PoolClient,
  email: string,
  passwordHash: string
): Promise<User> {
  const { rows } = await db.query(
    "INSERT INTO users (email, password_hash) VALUES ($1, $2) RETURNING *",
    [email.toLowerCase().trim(), passwordHash]
  );
  return toUser(rows[0]);
}
