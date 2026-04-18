import type { NextApiRequest, NextApiResponse } from "next";
import { getDb } from "@/lib/db";

type HealthResponse = {
  status: "ok" | "error";
  db: "connected" | "unreachable";
  message?: string;
};

export default async function handler(
  _req: NextApiRequest,
  res: NextApiResponse<HealthResponse>
) {
  try {
    await getDb().query("SELECT 1");
    res.status(200).json({ status: "ok", db: "connected" });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    res.status(500).json({ status: "error", db: "unreachable", message });
  }
}
