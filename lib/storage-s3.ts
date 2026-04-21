/**
 * S3-compatible storage provider.
 * Works with Amazon S3 and Cloudflare R2 (R2 is S3-compatible).
 *
 * Required packages (install before switching to S3):
 *   npm install @aws-sdk/client-s3 @aws-sdk/s3-request-presigner
 *
 * Required env vars:
 *   S3_BUCKET, S3_ACCESS_KEY_ID, S3_SECRET_ACCESS_KEY
 *
 * Optional env vars:
 *   S3_REGION      — default "auto" (correct for R2; use e.g. "us-east-1" for S3)
 *   S3_ENDPOINT    — required for R2, omit for AWS S3
 *   S3_PUBLIC_URL  — if set, download URLs are "${S3_PUBLIC_URL}/${key}"
 *                    instead of presigned URLs
 *
 * This file is only loaded when STORAGE_PROVIDER=s3 (see lib/storage.ts).
 *
 * AWS SDK packages are required lazily with /* webpackIgnore: true * / so that
 * Turbopack and webpack never attempt to resolve or bundle them. The packages
 * are resolved by Node.js at runtime only when this provider is actually used.
 * This means the packages do not need to be installed in local development mode.
 */

/* eslint-disable @typescript-eslint/no-require-imports, @typescript-eslint/no-explicit-any */

import type { StorageProvider } from "./storage";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function requireEnv(key: string): string {
  const value = process.env[key];
  if (!value) throw new Error(`Storage misconfiguration: missing env var ${key}`);
  return value;
}

// Load AWS SDK packages at call time, not at module load time.
// The /* webpackIgnore: true */ comment tells both webpack and Turbopack
// to skip static analysis of these require calls entirely.
const loadS3 = (): any => require(/* webpackIgnore: true */ "@aws-sdk/client-s3");
const loadPresigner = (): any => require(/* webpackIgnore: true */ "@aws-sdk/s3-request-presigner");

// ---------------------------------------------------------------------------
// Provider
// ---------------------------------------------------------------------------

class S3StorageProvider implements StorageProvider {
  private readonly bucket: string;
  private readonly region: string;
  private readonly endpoint: string | undefined;
  /** CDN / public bucket base URL, e.g. "https://pub-xxx.r2.dev" (no trailing slash). */
  private readonly publicUrl: string | null;
  private readonly credentials: { accessKeyId: string; secretAccessKey: string };

  // Lazily initialised on first use — avoids constructing the client if no
  // method is ever called (shouldn't happen in practice, but keeps the pattern clean).
  private _client: any = null;

  constructor() {
    this.bucket      = requireEnv("S3_BUCKET");
    this.publicUrl   = process.env.S3_PUBLIC_URL?.replace(/\/$/, "") ?? null;
    this.region      = process.env.S3_REGION ?? "auto";
    this.endpoint    = process.env.S3_ENDPOINT || undefined;
    this.credentials = {
      accessKeyId:     requireEnv("S3_ACCESS_KEY_ID"),
      secretAccessKey: requireEnv("S3_SECRET_ACCESS_KEY"),
    };
  }

  private get client(): any {
    if (!this._client) {
      const { S3Client } = loadS3();
      const cfg: Record<string, unknown> = {
        region:      this.region,
        credentials: this.credentials,
      };
      if (this.endpoint) cfg.endpoint = this.endpoint;
      this._client = new S3Client(cfg);
    }
    return this._client;
  }

  // ── Upload ──────────────────────────────────────────────────────────────

  async uploadFile(key: string, data: Buffer, contentType: string): Promise<void> {
    const { PutObjectCommand } = loadS3();
    await this.client.send(
      new PutObjectCommand({
        Bucket:      this.bucket,
        Key:         key,
        Body:        data,
        ContentType: contentType,
      })
    );
  }

  // ── Delete ───────────────────────────────────────────────────────────────

  async deleteFile(key: string): Promise<void> {
    const { DeleteObjectCommand } = loadS3();
    await this.client.send(
      new DeleteObjectCommand({ Bucket: this.bucket, Key: key })
    ).catch(() => {});
  }

  // ── Download URL ─────────────────────────────────────────────────────────

  async getDownloadUrl(key: string): Promise<string> {
    if (this.publicUrl) {
      return `${this.publicUrl}/${key}`;
    }
    // Proxy through our own API to avoid CORS issues with direct R2 presigned URLs
    return `/api/files/${encodeURIComponent(key)}`;
  }

  // ── Server-side read (used by PDF export) ─────────────────────────────────

  async readFile(key: string): Promise<Buffer> {
    const { GetObjectCommand } = loadS3();
    const response = await this.client.send(
      new GetObjectCommand({ Bucket: this.bucket, Key: key })
    );

    if (!response.Body) throw new Error(`S3 object "${key}" returned no body`);

    const chunks: Uint8Array[] = [];
    for await (const chunk of response.Body as AsyncIterable<Uint8Array>) {
      chunks.push(chunk);
    }
    return Buffer.concat(chunks);
  }
}

// ---------------------------------------------------------------------------
// Factory — called by lib/storage.ts via require()
// ---------------------------------------------------------------------------

export function createS3Provider(): StorageProvider {
  return new S3StorageProvider();
}
