import type { NextApiRequest, NextApiResponse } from "next";
import bcrypt from "bcryptjs";
import { getDb } from "@/lib/db";
import { getUserByEmail, createUser } from "@/server/users";
import { getSession } from "@/lib/session";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  const { email, password } = req.body as { email?: string; password?: string };

  if (!email?.trim() || !password) {
    return res.status(400).json({ error: "Email and password are required." });
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return res.status(400).json({ error: "Enter a valid email address." });
  }
  if (password.length < 8) {
    return res.status(400).json({ error: "Password must be at least 8 characters." });
  }

  try {
    const db = getDb();
    const existing = await getUserByEmail(db, email);
    if (existing) {
      return res.status(409).json({ error: "An account with this email already exists." });
    }

    const passwordHash = await bcrypt.hash(password, 12);
    const user = await createUser(db, email, passwordHash);

    const session = await getSession(req, res);
    session.user = { id: user.id, email: user.email };
    await session.save();

    res.status(201).json({ ok: true });
  } catch (err) {
    console.error("Register error:", err);
    res.status(500).json({ error: "Registration failed. Please try again." });
  }
}
