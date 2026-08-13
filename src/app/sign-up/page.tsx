"use client";

import * as React from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import {
  createOrganization,
  isGoogleSignInAvailable,
  setActiveOrganization,
  signInWithGoogle,
  signUpWithEmail,
} from "@/lib/auth";
import { toast } from "sonner";
import Link from "next/link";
import { Eye, EyeOff } from "lucide-react";

export default function SignUpPage() {
  const router = useRouter();
  const [name, setName] = React.useState("");
  const [email, setEmail] = React.useState("");
  const [password, setPassword] = React.useState("");
  const [orgName, setOrgName] = React.useState("");
  const [orgSlug, setOrgSlug] = React.useState("");
  const [showPassword, setShowPassword] = React.useState(false);
  const [isLoading, setIsLoading] = React.useState(false);
  const [isGoogleLoading, setIsGoogleLoading] = React.useState(false);
  const googleSignInAvailable = isGoogleSignInAvailable();

  const generateSlug = (value: string) =>
    value
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9\s-]/g, "")
      .replace(/\s+/g, "-");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      // Step 1: Sign up user
      const signUpResult = await signUpWithEmail({
        email,
        password,
        name,
      });

      if (signUpResult.error) {
        toast.error(signUpResult.error.message || "Sign-up failed");
        return;
      }

      // Step 2: Create the organization and set it as active
      if (orgName.trim()) {
        try {
          const orgResult = await createOrganization({
            name: orgName.trim(),
            slug: orgSlug || generateSlug(orgName),
          });

          // Set the newly created org as the active one on the session
          if (orgResult.data?.id) {
            await setActiveOrganization(orgResult.data.id);
          }
        } catch {
          // Org creation failure is non-blocking
          console.warn("Organization creation failed, user can create one later.");
        }
      }

      toast.success("Account created successfully!");
      router.push("/dashboard");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Sign-up failed");
    } finally {
      setIsLoading(false);
    }
  };

  const handleGoogleSignUp = async () => {
    setIsGoogleLoading(true);

    try {
      const result = await signInWithGoogle({ mode: "sign-up" });

      if (result.error) {
        toast.error(result.error.message || "Google sign-up failed");
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Google sign-up failed");
    } finally {
      setIsGoogleLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen flex-col bg-[#f9f9f9] font-[family-name:var(--font-ibm-plex)]">
      {/* Minimal Header */}
      <nav className="mx-auto flex w-full max-w-7xl items-center justify-start px-6 py-8">
        <Link
          href="/"
          className="font-[family-name:var(--font-plus-jakarta)] text-xl font-bold tracking-tight text-slate-900"
        >
          Samrian
        </Link>
      </nav>

      {/* Main */}
      <main className="flex flex-grow items-center justify-center px-6 pb-20">
        <div className="w-full max-w-[480px]">
          {/* Central Sign Up Card */}
          <section className="rounded-xl border border-[#c7c4d8] bg-white p-8 md:p-12">
            <header className="mb-10 text-left">
              <h1 className="mb-3 font-[family-name:var(--font-plus-jakarta)] text-3xl font-bold leading-tight tracking-tight text-[#1a1c1c] md:text-4xl">
                Create your account
              </h1>
              <p className="text-sm leading-relaxed text-[#464555]">
                Join the next generation of technical outreach. Precise, focused, and brutally
                efficient.
              </p>
            </header>

            <form onSubmit={handleSubmit} className="space-y-6">
              {/* Full Name */}
              <div className="space-y-2">
                <label
                  htmlFor="name"
                  className="block text-[0.6875rem] font-semibold uppercase tracking-wider text-[#464555]"
                >
                  Full Name
                </label>
                <input
                  id="name"
                  name="name"
                  type="text"
                  required
                  autoComplete="name"
                  placeholder="Nikola Tesla"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full rounded-lg border border-[#c7c4d8] bg-white px-4 py-3 text-sm outline-none transition-all duration-200 placeholder:text-slate-400 focus:border-[#3525cd] focus:ring-2 focus:ring-[#3525cd]/10"
                />
              </div>

              {/* Email */}
              <div className="space-y-2">
                <label
                  htmlFor="email"
                  className="block text-[0.6875rem] font-semibold uppercase tracking-wider text-[#464555]"
                >
                  Email Address
                </label>
                <input
                  id="email"
                  name="email"
                  type="email"
                  required
                  autoComplete="email"
                  placeholder="name@company.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full rounded-lg border border-[#c7c4d8] bg-white px-4 py-3 text-sm outline-none transition-all duration-200 placeholder:text-slate-400 focus:border-[#3525cd] focus:ring-2 focus:ring-[#3525cd]/10"
                />
              </div>

              {/* Password */}
              <div className="space-y-2">
                <label
                  htmlFor="password"
                  className="block text-[0.6875rem] font-semibold uppercase tracking-wider text-[#464555]"
                >
                  Password
                </label>
                <div className="relative">
                  <input
                    id="password"
                    name="password"
                    type={showPassword ? "text" : "password"}
                    required
                    minLength={8}
                    autoComplete="new-password"
                    placeholder="••••••••"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full rounded-lg border border-[#c7c4d8] bg-white px-4 py-3 pr-10 text-sm outline-none transition-all duration-200 placeholder:text-slate-400 focus:border-[#3525cd] focus:ring-2 focus:ring-[#3525cd]/10"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-[#464555] opacity-60 transition-opacity hover:opacity-100"
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>

              {/* Organization Name */}
              <div className="space-y-2">
                <label
                  htmlFor="orgName"
                  className="block text-[0.6875rem] font-semibold uppercase tracking-wider text-[#464555]"
                >
                  Organization Name
                </label>
                <input
                  id="orgName"
                  name="orgName"
                  type="text"
                  required
                  placeholder="Acme Corp"
                  value={orgName}
                  onChange={(e) => {
                    setOrgName(e.target.value);
                    setOrgSlug(generateSlug(e.target.value));
                  }}
                  className="w-full rounded-lg border border-[#c7c4d8] bg-white px-4 py-3 text-sm outline-none transition-all duration-200 placeholder:text-slate-400 focus:border-[#3525cd] focus:ring-2 focus:ring-[#3525cd]/10"
                />
              </div>

              {/* Organization Slug */}
              <div className="space-y-2">
                <label
                  htmlFor="orgSlug"
                  className="block text-[0.6875rem] font-semibold uppercase tracking-wider text-[#464555]"
                >
                  Organization ID (Slug)
                </label>
                <input
                  id="orgSlug"
                  name="orgSlug"
                  type="text"
                  required
                  placeholder="acme-corp"
                  value={orgSlug}
                  onChange={(e) => setOrgSlug(generateSlug(e.target.value))}
                  className="w-full rounded-lg border border-[#c7c4d8] bg-white px-4 py-3 text-sm outline-none transition-all duration-200 placeholder:text-slate-400 focus:border-[#3525cd] focus:ring-2 focus:ring-[#3525cd]/10"
                />
                {orgSlug && (
                  <p className="text-[0.6875rem] text-[#464555]/60">
                    Workspace ID: <span className="font-medium">{orgSlug}</span>
                  </p>
                )}
              </div>

              {/* Submit */}
              <button
                type="submit"
                disabled={isLoading}
                className="w-full rounded-lg bg-gradient-to-br from-[#3525cd] to-[#4f46e5] px-6 py-4 font-[family-name:var(--font-plus-jakarta)] text-sm font-semibold text-white shadow-sm transition-opacity duration-200 hover:opacity-95 disabled:opacity-70"
              >
                {isLoading ? "Creating account…" : "Create Account"}
              </button>
            </form>

            {/* Divider */}
            <div className="relative my-8">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-[#c7c4d8]/40" />
              </div>
              <div className="relative flex justify-center text-[0.6875rem] uppercase">
                <span className="bg-white px-4 text-[#464555]">Or continue with</span>
              </div>
            </div>

            {/* Social Sign Up */}
            <div className="grid grid-cols-1 gap-4">
              <button
                type="button"
                onClick={handleGoogleSignUp}
                disabled={!googleSignInAvailable || isGoogleLoading}
                title={googleSignInAvailable ? undefined : "Google sign-in is not configured"}
                className="flex items-center justify-center gap-3 border border-[#c7c4d8] bg-white px-4 py-3 text-sm font-medium transition-colors duration-200 hover:bg-[#f3f3f3] disabled:cursor-not-allowed disabled:opacity-60"
              >
                <Image src="/logos/google.svg" alt="" width={20} height={20} />
                {isGoogleLoading ? "Connecting to Google…" : "Google"}
              </button>
            </div>

            {/* Login Redirect */}
            <footer className="mt-10 text-center">
              <p className="text-sm text-[#464555]">
                Already have an account?{" "}
                <Link
                  href="/sign-in"
                  className="ml-1 font-semibold text-[#3525cd] underline-offset-4 transition-all hover:underline hover:decoration-[#3525cd]/30"
                >
                  Login
                </Link>
              </p>
            </footer>
          </section>
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-slate-200 bg-slate-50">
        <div className="mx-auto flex w-full max-w-7xl flex-col items-center justify-between gap-6 px-6 py-12 md:flex-row">
          <div className="font-[family-name:var(--font-plus-jakarta)] text-lg font-bold text-slate-900">
            Samrian
          </div>
          <nav className="flex flex-wrap justify-center gap-8">
            <Link
              href="/licensing"
              className="text-sm text-slate-500 transition-colors hover:text-slate-900"
            >
              License and source
            </Link>
          </nav>
          <p className="text-[0.6875rem] font-medium text-slate-500">
            Open source under AGPL-3.0-or-later.
          </p>
        </div>
      </footer>
    </div>
  );
}
