import type { NextApiRequest, NextApiResponse } from "next";
import { createReadStream, existsSync, statSync } from "fs";
import path from "path";

export default function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "GET" && req.method !== "HEAD") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const { filename } = req.query;
  if (typeof filename !== "string") {
    return res.status(400).json({ error: "Invalid filename" });
  }

  const safeName = path.basename(filename);
  const filePath = path.join(process.cwd(), "uploads", safeName);

  if (!existsSync(filePath)) {
    return res.status(404).json({ error: "File not found" });
  }

  const { size } = statSync(filePath);
  const rangeHeader = req.headers["range"];

  res.setHeader("Content-Type", "application/pdf");
  res.setHeader("Accept-Ranges", "bytes");
  res.setHeader("Cache-Control", "private, max-age=3600");

  if (!rangeHeader) {
    res.setHeader("Content-Length", size);
    if (req.method === "HEAD") return res.status(200).end();
    return createReadStream(filePath).pipe(res);
  }

  // Parse Range: bytes=start-end
  const match = rangeHeader.match(/bytes=(\d*)-(\d*)/);
  if (!match) {
    res.setHeader("Content-Range", `bytes */${size}`);
    return res.status(416).end();
  }

  const start = match[1] ? parseInt(match[1], 10) : 0;
  const end = match[2] ? parseInt(match[2], 10) : size - 1;

  if (start > end || end >= size) {
    res.setHeader("Content-Range", `bytes */${size}`);
    return res.status(416).end();
  }

  res.setHeader("Content-Range", `bytes ${start}-${end}/${size}`);
  res.setHeader("Content-Length", end - start + 1);
  res.status(206);

  if (req.method === "HEAD") return res.end();
  createReadStream(filePath, { start, end }).pipe(res);
}
