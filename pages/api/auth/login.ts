import type { NextApiRequest, NextApiResponse } from "next";
import bcrypt from "bcryptjs";
import { getDb } from "@/lib/db";
import { getUserByEmail } from "@/server/users";
import { getSession } from "@/lib/session";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  const { email, password } = req.body as { email?: string; password?: string };

  if (!email?.trim() || !password) {
    return res.status(400).json({ error: "Email and password are required." });
  }

  try {
    const user = await getUserByEmail(getDb(), email);

    // Always run bcrypt.compare to prevent timing-based user enumeration
    const passwordOk = user
      ? await bcrypt.compare(password, user.passwordHash)
      : await bcrypt.compare(password, "$2b$12$invalidhashfortimingequalisation");

    if (!user || !passwordOk) {
      return res.status(401).json({ error: "Invalid email or password." });
    }

    const session = await getSession(req, res);
    session.user = { id: user.id, email: user.email };
    await session.save();

    res.status(200).json({ ok: true });
  } catch (err) {
    console.error("Login error:", err);
    res.status(500).json({ error: "Login failed. Please try again." });
  }
}
