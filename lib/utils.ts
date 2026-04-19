import { clsx, type ClassValue } from "clsx";
import { v4 as uuidv4 } from "uuid";

/** Merge Tailwind class names conditionally. */
export function cn(...inputs: ClassValue[]): string {
  return clsx(...inputs);
}

/** Generate a RFC-4122 UUID. */
export function generateId(): string {
  return uuidv4();
}

/** Format an ISO date string to a readable locale string (e.g. "Jan 5, 2025"). */
export function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

/** Clamp a number between min and max (inclusive). */
export function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

/** Convert bytes to a human-readable string (e.g. "2.4 MB"). */
export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/** Strip the .pdf extension from a filename. */
export function stripPdfExtension(filename: string): string {
  return filename.replace(/\.pdf$/i, "");
}
