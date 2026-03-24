"use client";

import { authClient } from "@/lib/auth-client";
import { useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";

export default function Home() {
  const user = useQuery(api.auth.getCurrentUser);

  if (user === undefined) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <p className="text-gray-500">Loading...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gray-50 text-gray-900 gap-6">
      <h1 className="text-4xl font-bold tracking-tight">ColdEmail MVP</h1>
      <div className="bg-white shadow-xl rounded-xl p-8 max-w-sm w-full text-center border">
        {user ? (
          <div className="space-y-4">
            <p className="font-medium text-lg">Welcome back,</p>
            <p className="text-gray-500">{user.email}</p>
            <button
              onClick={() => authClient.signOut()}
              className="w-full bg-red-600 hover:bg-red-700 text-white py-2 px-4 rounded-md font-medium transition-colors"
            >
              Sign Out
            </button>
          </div>
        ) : (
          <div className="space-y-4">
            <p className="text-gray-600 mb-6">You must be logged in to access the dashboard.</p>
            <a
              href="/sign-in"
              className="block w-full bg-black hover:bg-gray-800 text-white py-2 px-4 rounded-md font-medium transition-colors"
            >
              Sign In
            </a>
            <a
              href="/sign-up"
              className="block w-full border border-gray-300 hover:bg-gray-50 text-black py-2 px-4 rounded-md font-medium transition-colors"
            >
              Sign Up
            </a>
          </div>
        )}
      </div>
    </div>
  );
}
