import { getIronSession } from "iron-session";
import type { IncomingMessage, ServerResponse } from "http";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type SessionUser = {
  id: string;
  email: string;
};

export type SessionData = {
  user?: SessionUser;
};

// ---------------------------------------------------------------------------
// Options
// ---------------------------------------------------------------------------

// SESSION_SECRET must be at least 32 characters.
// Generate one with:  node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
if (process.env.NODE_ENV === "production" && !process.env.SESSION_SECRET) {
  throw new Error("SESSION_SECRET environment variable must be set in production");
}

const sessionOptions = {
  password: process.env.SESSION_SECRET ?? "dev-secret-change-this-in-production!!",
  cookieName: "pdf-editor-session",
  ttl: 60 * 60 * 24 * 7, // 7 days
  cookieOptions: {
    secure: process.env.NODE_ENV === "production",
    httpOnly: true,
    sameSite: "lax" as const,
  },
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Read (or create) the session for this request/response pair. */
export function getSession(req: IncomingMessage, res: ServerResponse) {
  return getIronSession<SessionData>(req, res, sessionOptions);
}

/**
 * Read the session and return the logged-in user, or null.
 * Use in API routes for lightweight auth checks.
 */
export async function getSessionUser(
  req: IncomingMessage,
  res: ServerResponse
): Promise<SessionUser | null> {
  const session = await getSession(req, res);
  return session.user ?? null;
}
