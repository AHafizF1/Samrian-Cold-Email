import {
  createCipheriv,
  createDecipheriv,
  randomBytes,
  type CipherGCM,
  type DecipherGCM,
} from "node:crypto";

const VERSION = 2;
const ALGORITHM = "A256GCM";
const IV_BYTES = 12;
const TAG_BYTES = 16;

export type CredentialPurpose = "password" | "refresh-token" | "access-token";

export type CredentialContext = {
  orgId: string;
  mailboxId: string;
  provider: "smtp" | "puzzle" | "mailpool" | "google" | "microsoft";
  purpose: CredentialPurpose;
};

export type CredentialKeys = {
  activeKeyId: string;
  keys: Readonly<Record<string, Buffer>>;
  legacyKey?: Buffer;
};

type Envelope = {
  v: 2;
  kid: string;
  alg: "A256GCM";
  iv: string;
  ct: string;
  tag: string;
};

export function createCredentialCrypto(config: CredentialKeys) {
  const activeKey = getKey(config.keys, config.activeKeyId);

  return {
    encrypt(plaintext: string, context: CredentialContext): string {
      const iv = randomBytes(IV_BYTES);
      const cipher = createCipheriv("aes-256-gcm", activeKey, iv) as CipherGCM;
      cipher.setAAD(aad(context));
      const ciphertext = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
      const envelope: Envelope = {
        v: VERSION,
        kid: config.activeKeyId,
        alg: ALGORITHM,
        iv: iv.toString("base64url"),
        ct: ciphertext.toString("base64url"),
        tag: cipher.getAuthTag().toString("base64url"),
      };
      return JSON.stringify(envelope);
    },

    decrypt(value: string, context: CredentialContext): string {
      if (isLegacyEnvelope(value)) {
        if (!config.legacyKey) throw new Error("Legacy credential key is not configured");
        return decryptLegacy(value, config.legacyKey);
      }
      const envelope = parseEnvelope(value);
      const key = getKey(config.keys, envelope.kid);
      try {
        const decipher = createDecipheriv("aes-256-gcm", key, decode(envelope.iv, IV_BYTES), {
          authTagLength: TAG_BYTES,
        }) as DecipherGCM;
        decipher.setAAD(aad(context));
        decipher.setAuthTag(decode(envelope.tag, TAG_BYTES));
        return Buffer.concat([decipher.update(decode(envelope.ct)), decipher.final()]).toString(
          "utf8"
        );
      } catch {
        throw new Error("Credential decryption failed");
      }
    },
  };
}

export function isCredentialEnvelope(value: string): boolean {
  try {
    if (isLegacyEnvelope(value)) return true;
    parseEnvelope(value);
    return true;
  } catch {
    return false;
  }
}

export function credentialKeyId(value: string): string | null {
  if (isLegacyEnvelope(value)) return null;
  return parseEnvelope(value).kid;
}

function parseEnvelope(value: string): Envelope {
  let input: unknown;
  try {
    input = JSON.parse(value);
  } catch {
    throw new Error("Invalid credential envelope");
  }
  if (
    !input ||
    typeof input !== "object" ||
    (input as Partial<Envelope>).v !== VERSION ||
    (input as Partial<Envelope>).alg !== ALGORITHM ||
    typeof (input as Partial<Envelope>).kid !== "string" ||
    typeof (input as Partial<Envelope>).iv !== "string" ||
    typeof (input as Partial<Envelope>).ct !== "string" ||
    typeof (input as Partial<Envelope>).tag !== "string"
  ) {
    throw new Error("Invalid credential envelope");
  }
  const envelope = input as Envelope;
  if (!/^[a-zA-Z0-9_-]{1,64}$/.test(envelope.kid)) {
    throw new Error("Invalid credential envelope");
  }
  try {
    decode(envelope.iv, IV_BYTES);
    decode(envelope.ct);
    decode(envelope.tag, TAG_BYTES);
  } catch {
    throw new Error("Invalid credential envelope");
  }
  return envelope;
}

function getKey(keys: Readonly<Record<string, Buffer>>, id: string): Buffer {
  const key = keys[id];
  if (!key) throw new Error("Unknown credential key ID");
  if (key.length !== 32) throw new Error(`Credential key ${id} must be 32 bytes`);
  return key;
}

function aad(context: CredentialContext): Buffer {
  return Buffer.from(
    JSON.stringify([
      "samrian-mailbox-credential",
      VERSION,
      context.orgId,
      context.mailboxId,
      context.provider,
      context.purpose,
    ]),
    "utf8"
  );
}

function decode(value: string, length?: number): Buffer {
  if (!/^[A-Za-z0-9_-]+$/.test(value)) throw new Error("Invalid base64url");
  const decoded = Buffer.from(value, "base64url");
  if (length !== undefined && decoded.length !== length) throw new Error("Invalid byte length");
  if (decoded.toString("base64url") !== value) throw new Error("Invalid base64url");
  return decoded;
}

function isLegacyEnvelope(value: string): boolean {
  try {
    const input = JSON.parse(value) as { c?: unknown; iv?: unknown };
    return (
      typeof input.c === "string" &&
      typeof input.iv === "string" &&
      input.c.length >= TAG_BYTES * 2 &&
      input.iv.length === 32 &&
      /^[0-9a-f]+$/i.test(input.c) &&
      /^[0-9a-f]+$/i.test(input.iv)
    );
  } catch {
    return false;
  }
}

function decryptLegacy(value: string, key: Buffer): string {
  const input = JSON.parse(value) as { c: string; iv: string };
  const tagOffset = input.c.length - TAG_BYTES * 2;
  try {
    const decipher = createDecipheriv("aes-256-gcm", key, Buffer.from(input.iv, "hex"), {
      authTagLength: TAG_BYTES,
    }) as DecipherGCM;
    decipher.setAuthTag(Buffer.from(input.c.slice(tagOffset), "hex"));
    return decipher.update(input.c.slice(0, tagOffset), "hex", "utf8") + decipher.final("utf8");
  } catch {
    throw new Error("Credential decryption failed");
  }
}
