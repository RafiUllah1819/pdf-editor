import Link from "next/link";
import { useRouter } from "next/router";

export default function Navbar() {
  const router = useRouter();

  return (
    <header className="border-b border-gray-200 bg-white">
      <div className="mx-auto flex h-14 max-w-7xl items-center justify-between px-4 sm:px-6">
        <Link href="/dashboard" className="text-base font-bold tracking-tight text-indigo-600">
          PDFEditor
        </Link>

        <nav className="flex items-center gap-1">
          <Link
            href="/dashboard"
            className={`rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
              router.pathname === "/dashboard"
                ? "bg-indigo-50 text-indigo-700"
                : "text-gray-600 hover:bg-gray-100 hover:text-gray-900"
            }`}
          >
            Dashboard
          </Link>
        </nav>
      </div>
    </header>
  );
}
