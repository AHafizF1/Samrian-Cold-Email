import { describe, expect, test } from "vitest";

import type { ObjectStore } from "../../src/server/ports";
import { readStorageConfig, S3Store } from "../../src/server/storage";

const testS3Env = {
  STORAGE_PROVIDER: "s3",
  S3_ENDPOINT: process.env.TEST_S3_ENDPOINT,
  S3_REGION: process.env.TEST_S3_REGION ?? "us-east-1",
  S3_BUCKET: process.env.TEST_S3_BUCKET,
  S3_ACCESS_KEY_ID: process.env.TEST_S3_ACCESS_KEY_ID,
  S3_SECRET_ACCESS_KEY: process.env.TEST_S3_SECRET_ACCESS_KEY,
  S3_FORCE_PATH_STYLE: process.env.TEST_S3_FORCE_PATH_STYLE ?? "true",
};

describe("storage config", () => {
  test("rejects missing bucket and credentials with clear errors", () => {
    expect(() => readStorageConfig({ STORAGE_PROVIDER: "s3" })).toThrow("S3_BUCKET is required");
    expect(() =>
      readStorageConfig({
        STORAGE_PROVIDER: "s3",
        S3_BUCKET: "samrian",
      })
    ).toThrow("S3_ACCESS_KEY_ID is required");
    expect(() =>
      readStorageConfig({
        STORAGE_PROVIDER: "s3",
        S3_BUCKET: "samrian",
        S3_ACCESS_KEY_ID: "minio",
      })
    ).toThrow("S3_SECRET_ACCESS_KEY is required");
  });

  test("supports MinIO path-style mode", () => {
    expect(
      readStorageConfig({
        STORAGE_PROVIDER: "s3",
        S3_ENDPOINT: "http://localhost:9000",
        S3_REGION: "us-east-1",
        S3_BUCKET: "samrian",
        S3_ACCESS_KEY_ID: "minio",
        S3_SECRET_ACCESS_KEY: "minio-secret",
        S3_FORCE_PATH_STYLE: "true",
      })
    ).toMatchObject({
      provider: "s3",
      endpoint: "http://localhost:9000",
      region: "us-east-1",
      bucket: "samrian",
      forcePathStyle: true,
    });
  });

  test("validates explicit server-side encryption", () => {
    const base = {
      STORAGE_PROVIDER: "s3",
      S3_BUCKET: "samrian",
      S3_ACCESS_KEY_ID: "key",
      S3_SECRET_ACCESS_KEY: "secret",
    };

    expect(readStorageConfig({ ...base, S3_SERVER_SIDE_ENCRYPTION: "AES256" })).toMatchObject({
      serverSideEncryption: "AES256",
    });
    expect(() => readStorageConfig({ ...base, S3_SERVER_SIDE_ENCRYPTION: "aws:kms" })).toThrow(
      "S3_KMS_KEY_ID"
    );
    expect(() => readStorageConfig({ ...base, S3_SERVER_SIDE_ENCRYPTION: "invalid" })).toThrow(
      "S3_SERVER_SIDE_ENCRYPTION"
    );
  });
});

describe.skipIf(!hasTestS3Env())("S3Store", () => {
  test("stores, reads, signs, and deletes objects", async () => {
    const store: ObjectStore = new S3Store(readStorageConfig(testS3Env));
    const key = `tests/${crypto.randomUUID()}.txt`;

    const stored = await store.putObject({
      key,
      body: "raw email",
      contentType: "message/rfc822",
      metadata: { messageid: "message-1" },
    });
    expect(stored).toMatchObject({
      key,
      body: "raw email",
      contentType: "message/rfc822",
      metadata: { messageid: "message-1" },
    });

    await expect(store.getObject(key)).resolves.toMatchObject({
      key,
      body: "raw email",
      contentType: "message/rfc822",
      metadata: { messageid: "message-1" },
    });

    await expect(
      store.getSignedUrl(key, { operation: "read", expiresInSeconds: 60 })
    ).resolves.toContain(key);
    await expect(
      store.getSignedUrl(key, { operation: "write", expiresInSeconds: 60 })
    ).resolves.toContain(key);

    await store.deleteObject(key);
    await store.deleteObject(key);
    await expect(store.getObject(key)).resolves.toBeNull();
  });
});

function hasTestS3Env() {
  return !!(testS3Env.S3_BUCKET && testS3Env.S3_ACCESS_KEY_ID && testS3Env.S3_SECRET_ACCESS_KEY);
}
