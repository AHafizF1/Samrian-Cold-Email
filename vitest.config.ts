import react from "@vitejs/plugin-react";
import { defineConfig } from "vitest/config";

export default defineConfig({
  plugins: [react()],
  resolve: {
    tsconfigPaths: true,
  },
  test: {
    globals: true,
    maxWorkers: 4,
    setupFiles: ["./tests/setup.ts"],
    projects: [
      {
        extends: true,
        test: {
          name: "unit",
          environment: "node",
          include: ["tests/unit/**/*.test.ts"],
        },
      },
      {
        extends: true,
        test: {
          name: "contracts",
          environment: "node",
          include: ["tests/contracts/**/*.contract.test.ts"],
        },
      },
      {
        extends: true,
        test: {
          name: "db",
          environment: "node",
          include: ["tests/db/**/*.test.ts"],
        },
      },
      {
        extends: true,
        test: {
          name: "repos",
          environment: "node",
          include: ["tests/repos/**/*.test.ts"],
        },
      },
      {
        extends: true,
        test: {
          name: "storage",
          environment: "node",
          include: ["tests/storage/**/*.test.ts"],
        },
      },
      {
        extends: true,
        test: {
          name: "queue",
          environment: "node",
          include: ["tests/queue/**/*.test.ts"],
        },
      },
      {
        extends: true,
        test: {
          name: "worker",
          environment: "node",
          include: ["tests/worker/**/*.test.ts"],
        },
      },
      {
        extends: true,
        test: {
          name: "auth",
          environment: "node",
          include: ["tests/auth/**/*.test.ts"],
        },
      },
      {
        extends: true,
        test: {
          name: "api",
          environment: "node",
          include: ["tests/api/**/*.test.ts"],
        },
      },
      {
        extends: true,
        test: {
          name: "scripts",
          environment: "node",
          include: ["tests/scripts/**/*.test.ts"],
        },
      },
      {
        extends: true,
        test: {
          name: "deploy",
          environment: "node",
          include: ["tests/deploy/**/*.test.ts"],
        },
      },
      {
        extends: true,
        test: {
          name: "security",
          environment: "node",
          include: ["tests/security/**/*.test.ts"],
        },
      },
      {
        extends: true,
        test: {
          name: "components",
          environment: "jsdom",
          include: ["tests/components/**/*.test.{ts,tsx}"],
        },
      },
    ],
  },
});
