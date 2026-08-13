export type ObjectBody = string | Uint8Array;

export type PutObjectInput = {
  key: string;
  body: ObjectBody;
  contentType?: string;
  metadata?: Record<string, string>;
};

export type StoredObject = {
  key: string;
  body: ObjectBody;
  contentType?: string;
  metadata: Record<string, string>;
};

export type SignedUrlOptions = {
  operation: "read" | "write";
  expiresInSeconds: number;
};

export interface ObjectStore {
  putObject(input: PutObjectInput): Promise<StoredObject>;
  getObject(key: string): Promise<StoredObject | null>;
  getSignedUrl(key: string, options: SignedUrlOptions): Promise<string>;
  deleteObject(key: string): Promise<void>;
}
