"use node";

import { internalAction } from "../_generated/server";
import { v } from "convex/values";
import crypto from "crypto";

const ALGORITHM = "aes-256-gcm";
const IV_LENGTH = 16;
const AUTH_TAG_LENGTH = 16;

function getMasterKey(): Buffer {
  const key = process.env.MASTER_ENCRYPTION_KEY;
  if (!key || key.length !== 64) {
    throw new Error("MASTER_ENCRYPTION_KEY must be 64-char hex string");
  }
  return Buffer.from(key, "hex");
}

export const encryptCredentials = internalAction({
  args: { plaintext: v.string() },
  handler: async (_, args): Promise<{ encryptedData: string; iv: string }> => {
    const masterKey = getMasterKey();
    const iv = crypto.randomBytes(IV_LENGTH);
    const cipher = crypto.createCipheriv(ALGORITHM, masterKey, iv);

    let encrypted = cipher.update(args.plaintext, "utf8", "hex");
    encrypted += cipher.final("hex");

    const authTag = cipher.getAuthTag();
    const encryptedData = encrypted + authTag.toString("hex");

    return { encryptedData, iv: iv.toString("hex") };
  },
});

export const decryptCredentials = internalAction({
  args: { encryptedData: v.string(), iv: v.string() },
  handler: async (_, args): Promise<string> => {
    const masterKey = getMasterKey();
    const iv = Buffer.from(args.iv, "hex");

    const authTagStart = args.encryptedData.length - AUTH_TAG_LENGTH * 2;
    const encrypted = args.encryptedData.slice(0, authTagStart);
    const authTag = Buffer.from(args.encryptedData.slice(authTagStart), "hex");

    const decipher = crypto.createDecipheriv(ALGORITHM, masterKey, iv);
    decipher.setAuthTag(authTag);

    let decrypted = decipher.update(encrypted, "hex", "utf8");
    decrypted += decipher.final("utf8");

    return decrypted;
  },
});
