import { describe, expect, test } from "vitest";

import type { ObjectStore } from "../../src/server/ports";
import { FakeObjectStore } from "../fakes/fake-storage";

describe("ObjectStore contract", () => {
  test("stores content with metadata and reads it by key", async () => {
    const store: ObjectStore = new FakeObjectStore();

    const stored = await store.putObject({
      key: "eml/message-1.eml",
      body: "raw email",
      contentType: "message/rfc822",
      metadata: { messageid: "message-1" },
    });

    const object = await store.getObject(stored.key);

    expect(object).toEqual({
      key: "eml/message-1.eml",
      body: "raw email",
      contentType: "message/rfc822",
      metadata: { messageid: "message-1" },
    });
  });

  test("returns deterministic signed urls and deletes objects", async () => {
    const store: ObjectStore = new FakeObjectStore();
    await store.putObject({ key: "imports/file.csv", body: "email\nada@example.com" });

    await expect(
      store.getSignedUrl("imports/file.csv", { operation: "read", expiresInSeconds: 60 })
    ).resolves.toBe("https://fake-storage.local/read/imports%2Ffile.csv?expires=60");

    await store.deleteObject("imports/file.csv");

    await expect(store.getObject("imports/file.csv")).resolves.toBeNull();
  });
});
