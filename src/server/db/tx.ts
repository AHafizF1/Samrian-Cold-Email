import type { NeonHttpDatabase } from "drizzle-orm/neon-http";
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js";

import type * as schema from "./schema";

export type DbClient = PostgresJsDatabase<typeof schema> | NeonHttpDatabase<typeof schema>;
export type DbTransaction = Parameters<Parameters<DbClient["transaction"]>[0]>[0];
export type DbExecutor = DbClient | DbTransaction;
