/**
 * Environment variable validation and type-safe access
 *
 * This ensures all required environment variables are present
 * and provides type-safe access throughout the application.
 */

export function getEnvVar(key: string, defaultValue?: string): string {
  const value = process.env[key];

  if (!value && defaultValue === undefined) {
    throw new Error(`Missing required environment variable: ${key}`);
  }

  return value || defaultValue!;
}

export function getEnvVarOptional(key: string): string | undefined {
  return process.env[key];
}

export function validateEnv() {
  const required = [
    "CONVEX_DEPLOYMENT",
    "NEXT_PUBLIC_CONVEX_URL",
    "BETTER_AUTH_SECRET",
    "BETTER_AUTH_URL",
  ];

  const missing = required.filter((key) => !process.env[key]);

  if (missing.length > 0) {
    throw new Error(
      `Missing required environment variables:\n${missing.map((k) => `  - ${k}`).join("\n")}`
    );
  }
}

// Type-safe environment variables
export const env = {
  convex: {
    deployment: () => getEnvVar("CONVEX_DEPLOYMENT"),
    url: () => getEnvVar("NEXT_PUBLIC_CONVEX_URL"),
  },
  auth: {
    secret: () => getEnvVar("BETTER_AUTH_SECRET"),
    url: () => getEnvVar("BETTER_AUTH_URL"),
  },
  isDevelopment: process.env.NODE_ENV === "development",
  isProduction: process.env.NODE_ENV === "production",
  isTest: process.env.NODE_ENV === "test",
};
