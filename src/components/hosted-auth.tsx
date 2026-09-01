import Link from "next/link";

type HostedAuthProps = {
  mode: "sign-in" | "sign-up";
};

export function HostedAuth({ mode }: HostedAuthProps) {
  const signingUp = mode === "sign-up";
  const href = signingUp ? "/api/auth/workos/sign-up" : "/api/auth/workos/sign-in";

  return (
    <div className="flex min-h-screen flex-col bg-[#f9f9f9] font-[family-name:var(--font-ibm-plex)]">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-7xl items-center px-6 py-4">
          <Link
            href="/"
            className="font-[family-name:var(--font-plus-jakarta)] text-xl font-bold text-slate-900"
          >
            Samrian
          </Link>
        </div>
      </header>

      <main className="flex flex-1 items-center justify-center px-4 py-12">
        <section className="w-full max-w-[440px] rounded-lg border border-[#c7c4d8] bg-white p-8 sm:p-10">
          <h1 className="font-[family-name:var(--font-plus-jakarta)] text-2xl font-bold text-[#1a1c1c]">
            {signingUp ? "Create your account" : "Welcome back"}
          </h1>
          <p className="mt-2 text-sm leading-6 text-[#464555]">
            Continue to Samrian through our secure hosted sign-in.
          </p>
          <a
            href={href}
            className="mt-8 flex w-full items-center justify-center rounded-lg bg-[#3525cd] px-4 py-3.5 text-sm font-semibold text-white transition-colors hover:bg-[#2d1faf] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#3525cd] focus-visible:ring-offset-2"
          >
            Continue with WorkOS
          </a>
          <p className="mt-6 text-center text-xs leading-5 text-slate-500">
            Google, GitHub, and email options appear on the next screen.
          </p>
        </section>
      </main>
    </div>
  );
}
