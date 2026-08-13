import { describe, expect, test } from "vitest";

import { isCredentialEnvelope as isEncryptedBlob } from "../../src/server/crypto";
import { mailboxProviders } from "../../src/server/db/schema/constants";

describe("mailbox provider validation", () => {
  test("accepts every provider allowed by the mailbox schema", () => {
    const schemaProviders = ["smtp", "puzzle", "mailpool", "google", "microsoft"];

    expect(mailboxProviders).toEqual(schemaProviders);
  });
});

describe("encrypted blob validation", () => {
  test("accepts self-contained encrypted blobs", () => {
    expect(isEncryptedBlob(JSON.stringify({ c: "0".repeat(32), iv: "0".repeat(32) }))).toBe(true);
  });

  test("rejects missing ciphertext or invalid IV length", () => {
    expect(isEncryptedBlob(JSON.stringify({ c: "", iv: "0".repeat(32) }))).toBe(false);
    expect(isEncryptedBlob(JSON.stringify({ c: "abcdef", iv: "0".repeat(16) }))).toBe(false);
  });

  test("rejects non-hex and ciphertext shorter than a full GCM tag", () => {
    expect(isEncryptedBlob(JSON.stringify({ c: "ab", iv: "0".repeat(32) }))).toBe(false);
    expect(isEncryptedBlob(JSON.stringify({ c: "z".repeat(32), iv: "0".repeat(32) }))).toBe(false);
    expect(isEncryptedBlob(JSON.stringify({ c: "0".repeat(32), iv: "z".repeat(32) }))).toBe(false);
  });
});
