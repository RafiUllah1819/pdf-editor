/**
 * Minimal shared UI primitives.
 * Keep this file small — only add things used in 3+ places.
 */
import { cn } from "@/lib/utils";

// ---------------------------------------------------------------------------
// Spinner
// ---------------------------------------------------------------------------

export function Spinner({ className }: { className?: string }) {
  return (
    <svg
      className={cn("animate-spin", className)}
      fill="none"
      viewBox="0 0 24 24"
      aria-hidden="true"
    >
      <circle
        className="opacity-25"
        cx="12" cy="12" r="10"
        stroke="currentColor" strokeWidth="4"
      />
      <path
        className="opacity-75"
        fill="currentColor"
        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
      />
    </svg>
  );
}

// ---------------------------------------------------------------------------
// EmptyState
// ---------------------------------------------------------------------------

type EmptyStateProps = {
  icon: React.ReactNode;
  title: string;
  description?: string;
  action?: React.ReactNode;
};

export function EmptyState({ icon, title, description, action }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center py-16 text-center">
      <div className="mb-4 text-gray-300">{icon}</div>
      <p className="text-sm font-semibold text-gray-600">{title}</p>
      {description && (
        <p className="mt-1 max-w-xs text-sm text-gray-400">{description}</p>
      )}
      {action && <div className="mt-6">{action}</div>}
    </div>
  );
}

// ---------------------------------------------------------------------------
// AlertBanner
// ---------------------------------------------------------------------------

type AlertVariant = "error" | "warning" | "info";

const alertStyles: Record<AlertVariant, string> = {
  error:   "border-red-200 bg-red-50 text-red-700",
  warning: "border-amber-200 bg-amber-50 text-amber-700",
  info:    "border-blue-200 bg-blue-50 text-blue-700",
};

export function AlertBanner({
  variant = "error",
  children,
}: {
  variant?: AlertVariant;
  children: React.ReactNode;
}) {
  return (
    <div className={cn("rounded-lg border px-4 py-3 text-sm", alertStyles[variant])}>
      {children}
    </div>
  );
}

// ---------------------------------------------------------------------------
// StatusDot — inline save/export feedback ("Saved!" / "Error")
// ---------------------------------------------------------------------------

export function StatusMessage({
  status,
  savedText = "Saved!",
  errorText = "Failed — try again",
}: {
  status: "idle" | "saving" | "saved" | "error" | "exporting";
  savedText?: string;
  errorText?: string;
}) {
  if (status === "saved")
    return <span className="text-xs font-medium text-emerald-600">{savedText}</span>;
  if (status === "error")
    return <span className="text-xs font-medium text-red-500">{errorText}</span>;
  return null;
}
