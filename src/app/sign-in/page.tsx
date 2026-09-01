"use client";

import * as React from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import {
  isGoogleSignInAvailable,
  isHostedAuth,
  signInWithEmail,
  signInWithGoogle,
} from "@/lib/auth";
import { HostedAuth } from "@/components/hosted-auth";
import { toast } from "sonner";
import Link from "next/link";
import { Eye, EyeOff } from "lucide-react";

export default function SignInPage() {
  const router = useRouter();
  const [email, setEmail] = React.useState("");
  const [password, setPassword] = React.useState("");
  const [showPassword, setShowPassword] = React.useState(false);
  const [isLoading, setIsLoading] = React.useState(false);
  const [isGoogleLoading, setIsGoogleLoading] = React.useState(false);
  const googleSignInAvailable = isGoogleSignInAvailable();

  if (isHostedAuth()) {
    return <HostedAuth mode="sign-in" />;
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      const result = await signInWithEmail({
        email,
        password,
      });

      if (result.error) {
        toast.error(result.error.message || "Sign-in failed");
      } else {
        router.push("/dashboard");
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Sign-in failed");
    } finally {
      setIsLoading(false);
    }
  };

  const handleGoogleSignIn = async () => {
    setIsGoogleLoading(true);

    try {
      const result = await signInWithGoogle({ mode: "sign-in" });

      if (result.error) {
        toast.error(result.error.message || "Google sign-in failed");
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Google sign-in failed");
    } finally {
      setIsGoogleLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen flex-col bg-[#f9f9f9] font-[family-name:var(--font-ibm-plex)]">
      {/* Header */}
      <header className="fixed left-0 right-0 top-0 z-50 border-b border-slate-200 bg-white/80 backdrop-blur-md">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-4">
          <div className="font-[family-name:var(--font-plus-jakarta)] text-xl font-bold tracking-tight text-slate-900">
            Samrian
          </div>
          <nav className="hidden items-center md:flex">
            <Link
              href="/sign-in"
              className="border-b-2 border-indigo-700 font-semibold text-indigo-700"
            >
              Login
            </Link>
          </nav>
        </div>
      </header>

      {/* Main */}
      <main className="flex flex-grow items-center justify-center px-4 pb-12 pt-20">
        <div className="w-full max-w-[440px] rounded-lg border border-[#c7c4d8] bg-white p-10">
          {/* Heading */}
          <div className="mb-10 text-left">
            <h1 className="mb-2 font-[family-name:var(--font-plus-jakarta)] text-2xl font-bold tracking-tight text-[#1a1c1c]">
              Welcome back
            </h1>
            <p className="text-sm text-[#464555]">
              Enter your credentials to access your outreach dashboard.
            </p>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="space-y-2">
              <label
                htmlFor="email"
                className="block text-[11px] font-bold uppercase tracking-wider text-[#464555] opacity-80"
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

            <div className="space-y-2">
              <div className="flex items-center">
                <label
                  htmlFor="password"
                  className="block text-[11px] font-bold uppercase tracking-wider text-[#464555] opacity-80"
                >
                  Password
                </label>
              </div>
              <div className="relative">
                <input
                  id="password"
                  name="password"
                  type={showPassword ? "text" : "password"}
                  required
                  autoComplete="current-password"
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

            <button
              type="submit"
              disabled={isLoading}
              className="w-full rounded-lg bg-gradient-to-br from-[#3525cd] to-[#4f46e5] py-3.5 text-sm font-semibold text-white shadow-sm transition-all active:scale-[0.98] disabled:opacity-70"
            >
              {isLoading ? "Signing in…" : "Sign In"}
            </button>
          </form>

          {/* Divider */}
          <div className="relative my-10">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-[#c7c4d8]/40" />
            </div>
            <div className="relative flex justify-center text-[10px] font-bold uppercase tracking-widest">
              <span className="bg-white px-4 text-[#464555]">Or continue with</span>
            </div>
          </div>

          {/* Social Buttons */}
          <div className="grid grid-cols-1 gap-4">
            <button
              type="button"
              onClick={handleGoogleSignIn}
              disabled={!googleSignInAvailable || isGoogleLoading}
              title={googleSignInAvailable ? undefined : "Google sign-in is not configured"}
              className="group flex items-center justify-center gap-3 rounded-lg border border-[#c7c4d8] bg-white px-4 py-3 transition-colors hover:bg-[#f3f3f3] disabled:cursor-not-allowed disabled:opacity-60"
            >
              <Image src="/logos/google.svg" alt="" width={20} height={20} />
              <span className="text-xs font-semibold text-[#1a1c1c]">
                {isGoogleLoading ? "Connecting to Google…" : "Google"}
              </span>
            </button>
          </div>

          {/* Sign-up Link */}
          <p className="mt-10 text-center text-sm text-[#464555]">
            New to Samrian?{" "}
            <Link href="/sign-up" className="font-semibold text-[#3525cd] hover:underline">
              Create an account
            </Link>
          </p>
        </div>
      </main>

      {/* Footer */}
      <footer className="mx-auto flex w-full max-w-7xl flex-col items-center justify-between gap-6 border-t border-slate-200 px-6 py-12 md:flex-row">
        <div className="flex flex-col items-center gap-2 md:items-start">
          <div className="font-[family-name:var(--font-plus-jakarta)] text-lg font-bold text-slate-900">
            Samrian
          </div>
          <p className="text-sm text-slate-500">Open source under AGPL-3.0-or-later.</p>
        </div>
        <div className="flex gap-8">
          <Link
            href="/licensing"
            className="text-sm text-slate-500 transition-colors hover:text-slate-900"
          >
            License and source
          </Link>
        </div>
      </footer>
    </div>
  );
}
