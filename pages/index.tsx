import Link from "next/link";

export default function LandingPage() {
  return (
    <div className="flex flex-col items-center justify-center px-6 py-24 text-center">
      <span className="mb-4 inline-block rounded-full bg-indigo-100 px-4 py-1 text-sm font-medium text-indigo-700">
        Now in Beta
      </span>

      <h1 className="max-w-2xl text-5xl font-bold tracking-tight text-gray-900">
        Edit PDFs with ease
      </h1>

      <p className="mt-6 max-w-xl text-lg text-gray-600">
        Annotate, highlight, and modify your PDF documents directly in the
        browser. No installs, no fuss.
      </p>

      <div className="mt-10 flex gap-4">
        <Link
          href="/dashboard"
          className="rounded-lg bg-indigo-600 px-6 py-3 text-sm font-semibold text-white shadow-sm hover:bg-indigo-700"
        >
          Go to Dashboard
        </Link>
        <a
          href="#features"
          className="rounded-lg border border-gray-300 px-6 py-3 text-sm font-semibold text-gray-700 hover:bg-gray-50"
        >
          Learn more
        </a>
      </div>

      <section id="features" className="mt-24 w-full max-w-4xl">
        <h2 className="text-2xl font-bold text-gray-900">Features</h2>
        <div className="mt-8 grid grid-cols-1 gap-6 sm:grid-cols-3">
          {[
            {
              title: "Annotate",
              desc: "Add text, highlights, and shapes directly onto your PDF pages.",
            },
            {
              title: "Export",
              desc: "Download the modified PDF with all your annotations baked in.",
            },
            {
              title: "Organize",
              desc: "Manage all your documents from a simple dashboard.",
            },
          ].map((f) => (
            <div
              key={f.title}
              className="rounded-xl border border-gray-200 bg-white p-6 text-left shadow-sm"
            >
              <h3 className="font-semibold text-gray-900">{f.title}</h3>
              <p className="mt-2 text-sm text-gray-600">{f.desc}</p>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
