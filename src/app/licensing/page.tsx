import { ExternalLink } from "lucide-react";

const sourceUrl = process.env.NEXT_PUBLIC_SOURCE_URL;

export default function LicensingPage() {
  return (
    <main className="min-h-screen bg-white px-6 py-16 text-slate-900">
      <div className="mx-auto max-w-3xl">
        <p className="text-sm font-semibold text-indigo-700">Samrian</p>
        <h1 className="mt-3 text-4xl font-bold">Open source licensing</h1>
        <p className="mt-5 max-w-2xl text-base leading-7 text-slate-600">
          Samrian application and server code use AGPL-3.0-or-later. Contracts, SDK, CLI, and MCP
          packages use MIT licenses so integrations remain easy to adopt.
        </p>

        <section className="mt-12 border-t border-slate-200 pt-8">
          <h2 className="text-xl font-semibold">Application source</h2>
          <p className="mt-3 leading-7 text-slate-600">
            This deployment should link to source matching the version currently running.
          </p>
          {sourceUrl ? (
            <a
              href={sourceUrl}
              target="_blank"
              rel="noreferrer"
              className="mt-4 inline-flex items-center gap-2 font-semibold text-indigo-700 hover:text-indigo-900"
            >
              View corresponding source
              <ExternalLink className="h-4 w-4" aria-hidden="true" />
            </a>
          ) : (
            <p className="mt-4 text-sm font-medium text-amber-700">
              Source URL has not been configured for this deployment.
            </p>
          )}
        </section>

        <section className="mt-10 border-t border-slate-200 pt-8">
          <h2 className="text-xl font-semibold">Brand use</h2>
          <p className="mt-3 leading-7 text-slate-600">
            Forks may describe themselves as based on Samrian, but should use distinct names and
            branding. Full license and trademark policy ship with the source distribution.
          </p>
        </section>
      </div>
    </main>
  );
}
