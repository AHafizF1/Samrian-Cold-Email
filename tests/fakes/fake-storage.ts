import type {
  ObjectStore,
  PutObjectInput,
  SignedUrlOptions,
  StoredObject,
} from "../../src/server/ports";

export class FakeObjectStore implements ObjectStore {
  private readonly objects = new Map<string, StoredObject>();

  async putObject(input: PutObjectInput): Promise<StoredObject> {
    const object = {
      key: input.key,
      body: input.body,
      contentType: input.contentType,
      metadata: normalizeMetadata(input.metadata),
    };

    this.objects.set(input.key, object);
    return object;
  }

  async getObject(key: string): Promise<StoredObject | null> {
    return this.objects.get(key) ?? null;
  }

  async getSignedUrl(key: string, options: SignedUrlOptions): Promise<string> {
    return `https://fake-storage.local/${options.operation}/${encodeURIComponent(
      key
    )}?expires=${options.expiresInSeconds}`;
  }

  async deleteObject(key: string): Promise<void> {
    this.objects.delete(key);
  }
}

function normalizeMetadata(metadata: Record<string, string> | undefined) {
  return Object.fromEntries(
    Object.entries(metadata ?? {}).map(([key, value]) => [key.toLowerCase(), value])
  );
}
