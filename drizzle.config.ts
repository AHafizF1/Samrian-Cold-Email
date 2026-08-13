import { config } from "dotenv";
import { defineConfig } from "drizzle-kit";

config({ path: ".env.local" });
config();

const defaultDatabaseUrl = "postgres://postgres:postgres@localhost:5432/samrian";

export default defineConfig({
  dialect: "postgresql",
  schema: "./src/server/db/schema/index.ts",
  out: "./drizzle",
  dbCredentials: {
    url: process.env.DATABASE_URL ?? process.env.TEST_DATABASE_URL ?? defaultDatabaseUrl,
  },
});
