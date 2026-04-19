/**
 * Copies Apryse WebViewer static assets from node_modules into /public so the
 * browser can load them from a stable URL: /webviewer/...
 *
 * The copy is intentionally skipped when /public/webviewer already exists to
 * avoid repeating a ~200 MB file copy on every dev restart.
 * Re-run manually after upgrading @pdftron/webviewer:
 *   node scripts/copy-webviewer-assets.mjs --force
 *
 * Runs automatically via postinstall / predev / prebuild npm hooks.
 */

import { cpSync, existsSync, mkdirSync, rmSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
import { createRequire } from "module";

const require = createRequire(import.meta.url);
const __dirname = dirname(fileURLToPath(import.meta.url));
const force = process.argv.includes("--force");

const pkgJsonPath = require.resolve("@pdftron/webviewer/package.json");
const assetsSrc   = join(dirname(pkgJsonPath), "public");
const publicDir   = join(__dirname, "..", "public");
const assetsDest  = join(publicDir, "webviewer");

if (!existsSync(publicDir)) mkdirSync(publicDir, { recursive: true });

if (!existsSync(assetsSrc)) {
  console.warn("[copy-webviewer-assets] Source not found:", assetsSrc);
  console.warn("[copy-webviewer-assets] Make sure @pdftron/webviewer is installed.");
  process.exit(0);
}

if (existsSync(assetsDest) && !force) {
  console.log("[copy-webviewer-assets] /public/webviewer already exists — skipping.");
  console.log("[copy-webviewer-assets] Run with --force to overwrite after an SDK upgrade.");
  process.exit(0);
}

if (existsSync(assetsDest) && force) {
  console.log("[copy-webviewer-assets] --force: removing existing /public/webviewer …");
  rmSync(assetsDest, { recursive: true, force: true });
}

console.log("[copy-webviewer-assets] Copying WebViewer assets to /public/webviewer …");
console.log("[copy-webviewer-assets] This is a one-time operation (~200 MB).");
cpSync(assetsSrc, assetsDest, { recursive: true });
console.log("[copy-webviewer-assets] Done.");
