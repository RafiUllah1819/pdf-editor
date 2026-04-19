import Link from "next/link";
import { useRouter } from "next/router";
import type { SessionUser } from "@/lib/session";

const NAV_LINKS = [
  { href: "/",          label: "Home" },
  { href: "/dashboard", label: "Dashboard" },
];

type Props = {
  user?: SessionUser;
};

export default function Navbar({ user }: Props) {
  const router = useRouter();

  async function handleLogout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/login");
  }

  return (
    <header className="border-b border-gray-200 bg-white">
      <div className="mx-auto flex h-14 max-w-7xl items-center justify-between px-4 sm:px-6">
        <Link href="/" className="text-base font-bold tracking-tight text-indigo-600">
          PDFEditor
        </Link>

        <div className="flex items-center gap-3">
          <nav className="flex items-center gap-1">
            {NAV_LINKS.map(({ href, label }) => (
              <Link
                key={href}
                href={href}
                className={`rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
                  router.pathname === href
                    ? "bg-indigo-50 text-indigo-700"
                    : "text-gray-600 hover:bg-gray-100 hover:text-gray-900"
                }`}
              >
                {label}
              </Link>
            ))}
          </nav>

          {user ? (
            <div className="flex items-center gap-3 border-l border-gray-200 pl-3">
              <span className="hidden text-xs text-gray-500 sm:block" title={user.email}>
                {user.email.length > 24 ? user.email.slice(0, 22) + "…" : user.email}
              </span>
              <button
                onClick={handleLogout}
                className="rounded-md px-3 py-1.5 text-sm font-medium text-gray-600 hover:bg-gray-100 hover:text-gray-900 transition-colors"
              >
                Log out
              </button>
            </div>
          ) : (
            <div className="border-l border-gray-200 pl-3">
              <Link
                href="/login"
                className="rounded-md px-3 py-1.5 text-sm font-medium text-gray-600 hover:bg-gray-100 hover:text-gray-900 transition-colors"
              >
                Sign in
              </Link>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
