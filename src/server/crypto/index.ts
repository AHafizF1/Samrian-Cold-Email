import {
  createCredentialCrypto,
  credentialKeyId,
  isCredentialEnvelope,
  type CredentialContext,
} from "./envelope";
import { getCredentialKeys } from "./keys";

export type { CredentialContext, CredentialPurpose } from "./envelope";
export { createCredentialCrypto, credentialKeyId, getCredentialKeys, isCredentialEnvelope };

export function encryptCredential(plaintext: string, context: CredentialContext): string {
  return createCredentialCrypto(getCredentialKeys()).encrypt(plaintext, context);
}

export function decryptCredential(value: string, context: CredentialContext): string {
  return createCredentialCrypto(getCredentialKeys()).decrypt(value, context);
}
