import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  // Turbopack is the default in Next.js 16; empty config silences the warning.
  // The PDF.js worker file is copied to /public via the `copy-pdfjs-worker`
  // npm script which runs automatically on `postinstall`, `predev`, and `prebuild`.
  turbopack: {},
};

export default nextConfig;
