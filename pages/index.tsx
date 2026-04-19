import Link from "next/link";

const FEATURES = [
  {
    title: "Annotate",
    desc: "Add text boxes, highlights, and signatures directly onto any PDF page.",
    icon: (
      <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
          d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
      </svg>
    ),
  },
  {
    title: "Reorder pages",
    desc: "Drag thumbnails to rearrange or remove pages before exporting.",
    icon: (
      <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
          d="M4 6h16M4 10h16M4 14h16M4 18h16" />
      </svg>
    ),
  },
  {
    title: "Export",
    desc: "Download a flattened PDF with all annotations and page changes baked in.",
    icon: (
      <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
          d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
      </svg>
    ),
  },
];

export default function LandingPage() {
  return (
    <div className="flex flex-col items-center px-6 py-20 text-center">
      {/* Hero */}
      <span className="mb-5 inline-flex items-center gap-1.5 rounded-full border border-indigo-200 bg-indigo-50 px-3 py-1 text-xs font-medium text-indigo-700">
        <span className="h-1.5 w-1.5 rounded-full bg-indigo-500" />
        Now in Beta
      </span>

      <h1 className="max-w-2xl text-4xl font-bold tracking-tight text-gray-900 sm:text-5xl">
        Edit PDFs right in your browser
      </h1>

      <p className="mt-5 max-w-xl text-base text-gray-500 sm:text-lg">
        Annotate, reorder, and export PDF documents — no installs, no sign-up required.
      </p>

      <div className="mt-8 flex flex-wrap justify-center gap-3">
        <Link
          href="/dashboard"
          className="rounded-lg bg-indigo-600 px-6 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-indigo-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-indigo-600"
        >
          Open Dashboard
        </Link>
        <a
          href="#features"
          className="rounded-lg border border-gray-300 px-6 py-2.5 text-sm font-semibold text-gray-700 hover:bg-gray-50"
        >
          See features
        </a>
      </div>

      {/* Feature cards */}
      <section id="features" className="mt-24 w-full max-w-3xl">
        <h2 className="text-xl font-bold text-gray-900">What you can do</h2>
        <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-3">
          {FEATURES.map((f) => (
            <div
              key={f.title}
              className="rounded-xl border border-gray-200 bg-white p-5 text-left shadow-sm"
            >
              <div className="mb-3 inline-flex h-10 w-10 items-center justify-center rounded-lg bg-indigo-50 text-indigo-600">
                {f.icon}
              </div>
              <h3 className="font-semibold text-gray-900">{f.title}</h3>
              <p className="mt-1.5 text-sm text-gray-500">{f.desc}</p>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
