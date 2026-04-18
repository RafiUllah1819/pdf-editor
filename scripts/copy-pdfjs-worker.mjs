/**
 * Copies the PDF.js worker file into /public so the browser can load it from
 * a stable URL: /pdf.worker.min.mjs
 * Runs automatically via postinstall / predev / prebuild npm hooks.
 */
import { createRequire } from "module";
import { copyFileSync, existsSync, mkdirSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const require = createRequire(import.meta.url);
const __dirname = dirname(fileURLToPath(import.meta.url));

const pkgJson = require.resolve("pdfjs-dist/package.json");
const workerSrc = join(dirname(pkgJson), "build", "pdf.worker.min.mjs");
const publicDir = join(__dirname, "..", "public");
const workerDest = join(publicDir, "pdf.worker.min.mjs");

if (!existsSync(publicDir)) mkdirSync(publicDir, { recursive: true });

if (!existsSync(workerSrc)) {
  console.warn("[copy-pdfjs-worker] Worker source not found:", workerSrc);
  process.exit(0);
}

copyFileSync(workerSrc, workerDest);
console.log("[copy-pdfjs-worker] Copied pdf.worker.min.mjs to /public");
