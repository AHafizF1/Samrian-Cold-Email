export type EncryptedBlob = {
  version: number;
  data: string;
};

export interface SecretCrypto {
  encryptString(plaintext: string): Promise<EncryptedBlob>;
  decryptString(blob: EncryptedBlob): Promise<string>;
}
