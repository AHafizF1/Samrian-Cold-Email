import type { CredentialContext } from "./envelope";
import { credentialKeyId } from "./envelope";

type CredentialCrypto = {
  encrypt(plaintext: string, context: CredentialContext): string;
  decrypt(value: string, context: CredentialContext): string;
};

export function rotateCredential(
  value: string,
  context: CredentialContext,
  activeKeyId: string,
  crypto: CredentialCrypto
): { changed: boolean; value: string } {
  if (credentialKeyId(value) === activeKeyId) return { changed: false, value };
  return {
    changed: true,
    value: crypto.encrypt(crypto.decrypt(value, context), context),
  };
}
