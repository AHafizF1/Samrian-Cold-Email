import type { CredentialKeys } from "./envelope";

const KEY_BYTES = 32;
const LEGACY_ID = "legacy-master";

export function getCredentialKeys(
  env: Record<string, string | undefined> = process.env
): CredentialKeys {
  const activeKeyId = env.CREDENTIAL_ACTIVE_KEY_ID?.trim();
  const encoded = env.CREDENTIAL_KEYS_JSON?.trim();

  if (activeKeyId || encoded) {
    if (!activeKeyId || !encoded) {
      throw new Error(
        "CREDENTIAL_ACTIVE_KEY_ID and CREDENTIAL_KEYS_JSON must be configured together"
      );
    }
    const keys = parseKeyring(encoded);
    if (!keys[activeKeyId]) {
      throw new Error("CREDENTIAL_ACTIVE_KEY_ID must reference CREDENTIAL_KEYS_JSON");
    }
    return {
      activeKeyId,
      keys,
      legacyKey: parseOptionalKey(env.MASTER_ENCRYPTION_KEY, "MASTER_ENCRYPTION_KEY"),
    };
  }

  const legacyKey = parseOptionalKey(env.MASTER_ENCRYPTION_KEY, "MASTER_ENCRYPTION_KEY");
  if (!legacyKey) {
    throw new Error("CREDENTIAL_ACTIVE_KEY_ID and CREDENTIAL_KEYS_JSON are required");
  }
  return {
    activeKeyId: LEGACY_ID,
    keys: { [LEGACY_ID]: legacyKey },
    legacyKey,
  };
}

function parseKeyring(value: string): Record<string, Buffer> {
  let input: unknown;
  try {
    input = JSON.parse(value);
  } catch {
    throw new Error("CREDENTIAL_KEYS_JSON must be a JSON object of 32-byte hex keys");
  }
  if (!input || typeof input !== "object" || Array.isArray(input)) {
    throw new Error("CREDENTIAL_KEYS_JSON must be a JSON object of 32-byte hex keys");
  }

  const entries = Object.entries(input);
  if (entries.length === 0) {
    throw new Error("CREDENTIAL_KEYS_JSON must contain at least one key");
  }
  return Object.fromEntries(
    entries.map(([id, key]) => {
      if (!/^[a-zA-Z0-9_-]{1,64}$/.test(id) || typeof key !== "string") {
        throw new Error("CREDENTIAL_KEYS_JSON contains an invalid key entry");
      }
      return [id, parseKey(key, "CREDENTIAL_KEYS_JSON")];
    })
  );
}

function parseOptionalKey(value: string | undefined, name: string): Buffer | undefined {
  return value?.trim() ? parseKey(value.trim(), name) : undefined;
}

function parseKey(value: string, name: string): Buffer {
  if (!/^[0-9a-f]{64}$/i.test(value)) {
    throw new Error(`${name} must contain 32-byte hex keys`);
  }
  const key = Buffer.from(value, "hex");
  if (key.length !== KEY_BYTES) throw new Error(`${name} must contain 32-byte hex keys`);
  return key;
}
