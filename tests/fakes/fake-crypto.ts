import type { EncryptedBlob, SecretCrypto } from "../../src/server/ports";

const FAKE_VERSION = 1;

export class FakeSecretCrypto implements SecretCrypto {
  constructor(private readonly key: string) {}

  async encryptString(plaintext: string): Promise<EncryptedBlob> {
    return {
      version: FAKE_VERSION,
      data: Buffer.from(`${this.key}:${plaintext}`, "utf8").toString("base64"),
    };
  }

  async decryptString(blob: EncryptedBlob): Promise<string> {
    if (blob.version !== FAKE_VERSION) {
      throw new Error("Unsupported encrypted blob version");
    }

    const decoded = decodeBase64(blob.data);
    const prefix = `${this.key}:`;
    if (!decoded.startsWith(prefix)) {
      throw new Error("Malformed encrypted blob");
    }

    return decoded.slice(prefix.length);
  }
}

function decodeBase64(value: string): string {
  if (!/^[A-Za-z0-9+/]+={0,2}$/.test(value)) {
    throw new Error("Malformed encrypted blob");
  }

  const decoded = Buffer.from(value, "base64").toString("utf8");
  const normalizedInput = value.replace(/=+$/, "");
  const normalizedRoundtrip = Buffer.from(decoded, "utf8").toString("base64").replace(/=+$/, "");

  if (normalizedInput !== normalizedRoundtrip) {
    throw new Error("Malformed encrypted blob");
  }

  return decoded;
}
