/**
 * OAuth State Security (DRY — Single Source of Truth)
 *
 * Used by both Google and Microsoft OAuth routes.
 *
 * State format: base64url({ nonce, orgId, userId, mailboxId?, ts, sig })
 * sig = HMAC-SHA256(nonce|orgId|userId|ts, BETTER_AUTH_SECRET)
 *
 * Security properties:
 * - CSRF: random nonce + httpOnly cookie verification
 * - Org binding: state encodes the orgId, preventing cross-org token injection
 * - Timestamp: server-side expiry check (10 minutes) independent of cookie maxAge
 * - Signed: HMAC prevents forgery even if the attacker sees the state in the URL
 */

import crypto from "crypto";
import { RETENTION } from "@/server/data/retention";

// ── Constants ─────────────────────────────────────────────────────────────────

// ── Types ─────────────────────────────────────────────────────────────────────

interface OAuthStatePayload {
  /** Random nonce for CSRF */
  n: string;
  /** Organization ID */
  o: string;
  /** User ID */
  u: string;
  /** Optional mailbox ID (for reconnect flows) */
  m?: string;
  /** Timestamp (ms since epoch) */
  t: number;
  /** HMAC signature */
  s: string;
}

export interface ValidatedState {
  orgId: string;
  userId: string;
  mailboxId?: string;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function getSigningSecret(): string {
  const secret = process.env.BETTER_AUTH_SECRET;
  if (!secret) {
    throw new Error("BETTER_AUTH_SECRET is required for OAuth state signing");
  }
  return secret;
}

function computeSignature(nonce: string, orgId: string, userId: string, ts: number): string {
  const data = `${nonce}|${orgId}|${userId}|${ts}`;
  return crypto.createHmac("sha256", getSigningSecret()).update(data).digest("hex");
}

function base64urlEncode(input: string): string {
  return Buffer.from(input, "utf8")
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

function base64urlDecode(input: string): string {
  const base64 = input.replace(/-/g, "+").replace(/_/g, "/");
  const padded = base64.padEnd(base64.length + ((4 - (base64.length % 4)) % 4), "=");
  return Buffer.from(padded, "base64").toString("utf8");
}

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * Create a signed, timestamped OAuth state string.
 *
 * @param orgId - The user's active organization ID
 * @param userId - The authenticated user's ID
 * @param mailboxId - Optional mailbox ID for reconnect flows
 * @returns base64url-encoded state string to include in the OAuth authorize URL
 */
export function createOAuthState(orgId: string, userId: string, mailboxId?: string): string {
  const nonce = crypto.randomBytes(16).toString("hex");
  const ts = Date.now();
  const sig = computeSignature(nonce, orgId, userId, ts);

  const payload: OAuthStatePayload = {
    n: nonce,
    o: orgId,
    u: userId,
    t: ts,
    s: sig,
    ...(mailboxId && { m: mailboxId }),
  };

  return base64urlEncode(JSON.stringify(payload));
}

/**
 * Validate an OAuth state string.
 *
 * @param stateParam - The state parameter from the OAuth callback
 * @param expectedOrgId - The org ID from the authenticated user's session
 * @param expectedUserId - The user ID from the authenticated session
 * @returns Validated state with orgId, userId, and optional mailboxId
 * @throws Error if state is invalid, expired, tampered, or mismatched
 */
export function validateOAuthState(
  stateParam: string,
  expectedOrgId: string,
  expectedUserId: string
): ValidatedState {
  let payload: OAuthStatePayload;
  try {
    const decoded = base64urlDecode(stateParam);
    payload = JSON.parse(decoded) as OAuthStatePayload;
  } catch {
    throw new Error("Invalid OAuth state: malformed payload");
  }

  // Verify required fields exist
  if (!payload.n || !payload.o || !payload.u || !payload.t || !payload.s) {
    throw new Error("Invalid OAuth state: missing required fields");
  }

  // Verify timestamp (not expired)
  const age = Date.now() - payload.t;
  if (age > RETENTION.oauthStateMs) {
    throw new Error("OAuth state expired: please try connecting again");
  }
  if (age < 0) {
    throw new Error("Invalid OAuth state: timestamp is in the future");
  }

  // Verify HMAC signature (prevents forgery)
  const expectedSig = computeSignature(payload.n, payload.o, payload.u, payload.t);
  if (!crypto.timingSafeEqual(Buffer.from(payload.s, "hex"), Buffer.from(expectedSig, "hex"))) {
    throw new Error("Invalid OAuth state: signature mismatch");
  }

  // Verify org and user binding (prevents cross-org/cross-user token injection)
  if (payload.o !== expectedOrgId) {
    throw new Error("Invalid OAuth state: organization mismatch");
  }
  if (payload.u !== expectedUserId) {
    throw new Error("Invalid OAuth state: user mismatch");
  }

  return {
    orgId: payload.o,
    userId: payload.u,
    mailboxId: payload.m,
  };
}
