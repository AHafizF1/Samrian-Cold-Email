import { beforeAll, describe, expect, test } from "vitest";

import { contacts } from "../../src/server/db/schema";
import { createDb, readDbConfig } from "../../src/server/db/db";

const testUrl = process.env.TEST_DATABASE_URL;

describe.skipIf(!testUrl)("db migration smoke", () => {
  beforeAll(() => {
    readDbConfig({
      DATABASE_DRIVER: "postgres-js",
      DATABASE_URL: testUrl,
    });
  });

  test("inserts and reads a contact from test Postgres", async () => {
    const db = createDb({ driver: "postgres-js", url: testUrl! });
    const id = `contact_${Date.now()}`;

    await db.client.insert(contacts).values({
      id,
      orgId: "org_test",
      email: `ada-${id}@example.com`,
      customVars: {},
    });

    const rows = await db.client.select().from(contacts);
    expect(rows.some((row) => row.id === id)).toBe(true);
  });
});
