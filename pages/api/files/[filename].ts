/**
 * Serves uploaded files from the local /uploads directory.
 * This route exists only for local development.
 * In production, swap LocalStorageProvider for S3/R2 and remove this route.
 */

import type { NextApiRequest, NextApiResponse } from "next";
import { createReadStream, existsSync } from "fs";
import path from "path";

export default function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const { filename } = req.query;
  if (typeof filename !== "string") {
    return res.status(400).json({ error: "Invalid filename" });
  }

  // Prevent path traversal attacks
  const safeName = path.basename(filename);
  const filePath = path.join(process.cwd(), "uploads", safeName);

  if (!existsSync(filePath)) {
    return res.status(404).json({ error: "File not found" });
  }

  res.setHeader("Content-Type", "application/pdf");
  res.setHeader("Cache-Control", "private, max-age=3600");
  createReadStream(filePath).pipe(res);
}
