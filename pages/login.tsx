import { useState } from "react";
import { useRouter } from "next/router";
import Link from "next/link";
import type { GetServerSideProps } from "next";
import { getSession } from "@/lib/session";
import { AlertBanner } from "@/components/ui";

// ---------------------------------------------------------------------------
// Server-side: redirect already-authenticated users to the dashboard
// ---------------------------------------------------------------------------

export const getServerSideProps: GetServerSideProps = async ({ req, res }) => {
  const session = await getSession(req, res);
  if (session.user) return { redirect: { destination: "/dashboard", permanent: false } };
  return { props: { hideNav: true } };
};

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

type Mode = "login" | "register";

export default function LoginPage() {
  const router = useRouter();
  const [mode, setMode] = useState<Mode>("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    const endpoint = mode === "login" ? "/api/auth/login" : "/api/auth/register";

    try {
      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });

      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        throw new Error((data as { error?: string }).error ?? "Something went wrong.");
      }

      router.push("/dashboard");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setLoading(false);
    }
  }

  function switchMode(next: Mode) {
    setMode(next);
    setError(null);
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50 px-4">
      <div className="w-full max-w-sm">
        {/* Logo */}
        <div className="mb-8 text-center">
          <Link href="/" className="text-xl font-bold text-indigo-600">
            PDFEditor
          </Link>
          <p className="mt-1 text-sm text-gray-500">
            {mode === "login" ? "Sign in to your account" : "Create a new account"}
          </p>
        </div>

        {/* Card */}
        <div className="rounded-xl border border-gray-200 bg-white p-8 shadow-sm">
          {/* Tab toggle */}
          <div className="mb-6 flex rounded-lg border border-gray-200 bg-gray-50 p-1">
            {(["login", "register"] as Mode[]).map((m) => (
              <button
                key={m}
                type="button"
                onClick={() => switchMode(m)}
                className={`flex-1 rounded-md py-1.5 text-sm font-medium transition-colors ${
                  mode === m
                    ? "bg-white text-gray-900 shadow-sm"
                    : "text-gray-500 hover:text-gray-700"
                }`}
              >
                {m === "login" ? "Sign in" : "Register"}
              </button>
            ))}
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="mb-1.5 block text-xs font-medium text-gray-700">
                Email address
              </label>
              <input
                type="email"
                required
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm placeholder-gray-400 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
              />
            </div>

            <div>
              <label className="mb-1.5 block text-xs font-medium text-gray-700">
                Password
                {mode === "register" && (
                  <span className="ml-1 font-normal text-gray-400">(min. 8 characters)</span>
                )}
              </label>
              <input
                type="password"
                required
                autoComplete={mode === "login" ? "current-password" : "new-password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm placeholder-gray-400 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
              />
            </div>

            {error && (
              <AlertBanner variant="error">{error}</AlertBanner>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full rounded-lg bg-indigo-600 py-2 text-sm font-semibold text-white hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-60 transition-colors"
            >
              {loading
                ? mode === "login" ? "Signing in…" : "Creating account…"
                : mode === "login" ? "Sign in" : "Create account"}
            </button>
          </form>
        </div>

        <p className="mt-4 text-center text-xs text-gray-400">
          {mode === "login" ? "No account? " : "Already have an account? "}
          <button
            type="button"
            onClick={() => switchMode(mode === "login" ? "register" : "login")}
            className="font-medium text-indigo-600 hover:underline"
          >
            {mode === "login" ? "Register" : "Sign in"}
          </button>
        </p>
      </div>
    </div>
  );
}
