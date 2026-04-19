import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  // Turbopack is the default in Next.js 16; empty config silences the warning.
  // The PDF.js worker file is copied to /public via the `copy-pdfjs-worker`
  // npm script which runs automatically on `postinstall`, `predev`, and `prebuild`.
  turbopack: {},
  // Keep AWS SDK packages out of the Next.js bundle entirely.
  // They are only needed at runtime when STORAGE_PROVIDER=s3.
  // Without this, the bundler follows lib/storage.ts → lib/storage-s3.ts → these
  // imports and fails if the packages are not installed (even in local mode).
  serverExternalPackages: ["@aws-sdk/client-s3", "@aws-sdk/s3-request-presigner"],
};

export default nextConfig;
