"use node";

import { internalAction, internalQuery } from "../_generated/server";
import { v } from "convex/values";
import { internal } from "../_generated/api";
import crypto from "crypto";
import type { Id } from "../_generated/dataModel";
import type { DecryptedCredentials } from "../../lib/email-connectors/types";

const ALGORITHM = "aes-256-gcm";
const IV_LENGTH = 16;
const AUTH_TAG_LENGTH = 16;

function getMasterKey(): Buffer {
  const key = process.env.MASTER_ENCRYPTION_KEY;
  if (!key || key.length !== 64) {
    throw new Error("MASTER_ENCRYPTION_KEY must be a 64-character hex string (32 bytes)");
  }
  return Buffer.from(key, "hex");
}

// ============================================================
// Internal query — fetch mailbox for decryption (no sensitive fields exposed to client)
// ============================================================

export const getMailboxForDecryption = internalQuery({
  args: { mailboxId: v.id("mailboxes") },
  handler: async (ctx, args) => {
    const mailbox = await ctx.db.get(args.mailboxId);
    if (!mailbox) throw new Error("Mailbox not found");
    return mailbox;
  },
});

// ============================================================
// encrypt — AES-256-GCM, returns { ciphertext, iv }
// ============================================================

export const encrypt = internalAction({
  args: { plaintext: v.string() },
  returns: v.object({ ciphertext: v.string(), iv: v.string() }),
  handler: async (_, args): Promise<{ ciphertext: string; iv: string }> => {
    const masterKey = getMasterKey();
    const iv = crypto.randomBytes(IV_LENGTH);
    const cipher = crypto.createCipheriv(ALGORITHM, masterKey, iv);

    let encrypted = cipher.update(args.plaintext, "utf8", "hex");
    encrypted += cipher.final("hex");

    // Append auth tag to ciphertext
    const authTag = cipher.getAuthTag();
    const ciphertext = encrypted + authTag.toString("hex");

    return { ciphertext, iv: iv.toString("hex") };
  },
});

// ============================================================
// decrypt — AES-256-GCM, returns plaintext
// ============================================================

export const decrypt = internalAction({
  args: { ciphertext: v.string(), iv: v.string() },
  returns: v.string(),
  handler: async (_, args): Promise<string> => {
    const masterKey = getMasterKey();
    const iv = Buffer.from(args.iv, "hex");

    const authTagHexLen = AUTH_TAG_LENGTH * 2;
    const authTagStart = args.ciphertext.length - authTagHexLen;
    const encrypted = args.ciphertext.slice(0, authTagStart);
    const authTag = Buffer.from(args.ciphertext.slice(authTagStart), "hex");

    const decipher = crypto.createDecipheriv(ALGORITHM, masterKey, iv);
    decipher.setAuthTag(authTag);

    let decrypted = decipher.update(encrypted, "hex", "utf8");
    decrypted += decipher.final("utf8");

    return decrypted;
  },
});

// ============================================================
// decryptMailboxCreds — fetches mailbox, decrypts credentials/tokens
// ============================================================

export const decryptMailboxCreds = internalAction({
  args: { mailboxId: v.id("mailboxes") },
  returns: v.any(), // Returning a complex DecryptedCredentials type
  handler: async (ctx, args): Promise<DecryptedCredentials> => {
    const mailbox = await ctx.runQuery(internal.actions.encryption.getMailboxForDecryption, {
      mailboxId: args.mailboxId,
    });

    const { provider, encryptedCreds, refreshToken, accessToken, iv } = mailbox;

    if (provider === "puzzle" || provider === "mailpool") {
      // SMTP/IMAP — decrypt password from encryptedCreds
      if (!encryptedCreds) {
        throw new Error(`Mailbox ${args.mailboxId} is missing encryptedCreds`);
      }
      const password = await ctx.runAction(internal.actions.encryption.decrypt, {
        ciphertext: encryptedCreds,
        iv,
      });
      return { type: "smtp-imap", password };
    }

    if (provider === "google" || provider === "microsoft") {
      // OAuth2 — decrypt refresh token (and optionally access token)
      if (!refreshToken) {
        throw new Error(`Mailbox ${args.mailboxId} is missing refreshToken`);
      }
      const decryptedRefreshToken = await ctx.runAction(internal.actions.encryption.decrypt, {
        ciphertext: refreshToken,
        iv,
      });

      let decryptedAccessToken: string | undefined;
      if (accessToken) {
        decryptedAccessToken = await ctx.runAction(internal.actions.encryption.decrypt, {
          ciphertext: accessToken,
          iv,
        });
      }

      return {
        type: "oauth2",
        refreshToken: decryptedRefreshToken,
        ...(decryptedAccessToken !== undefined && { accessToken: decryptedAccessToken }),
        ...(mailbox.tokenExpiresAt !== undefined && { tokenExpiresAt: mailbox.tokenExpiresAt }),
      };
    }

    throw new Error(`Unknown provider: ${provider}`);
  },
});

// ============================================================
// Legacy aliases — kept for backward compatibility
// ============================================================

export const encryptCredentials = internalAction({
  args: { plaintext: v.string() },
  returns: v.object({ encryptedData: v.string(), iv: v.string() }),
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
  returns: v.string(),
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
