import {
  DeleteObjectCommand,
  GetObjectCommand,
  HeadObjectCommand,
  NoSuchKey,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

import type {
  ObjectBody,
  ObjectStore,
  PutObjectInput,
  SignedUrlOptions,
  StoredObject,
} from "../ports";
import type { S3Config } from "./config";
import { deadlineSignal } from "../network/deadline";

export class S3Store implements ObjectStore {
  private readonly client: S3Client;

  constructor(private readonly config: S3Config) {
    this.client = new S3Client({
      endpoint: config.endpoint,
      region: config.region,
      forcePathStyle: config.forcePathStyle,
      credentials: {
        accessKeyId: config.accessKeyId,
        secretAccessKey: config.secretAccessKey,
      },
    });
  }

  async putObject(input: PutObjectInput): Promise<StoredObject> {
    await this.client.send(
      new PutObjectCommand({
        Bucket: this.config.bucket,
        Key: input.key,
        Body: toSdkBody(input.body),
        ContentType: input.contentType,
        Metadata: normalizeMetadata(input.metadata),
        ServerSideEncryption: this.config.serverSideEncryption,
        SSEKMSKeyId: this.config.kmsKeyId,
      }),
      { abortSignal: deadlineSignal() }
    );

    return {
      key: input.key,
      body: input.body,
      contentType: input.contentType,
      metadata: normalizeMetadata(input.metadata),
    };
  }

  async getObject(key: string): Promise<StoredObject | null> {
    try {
      const result = await this.client.send(
        new GetObjectCommand({
          Bucket: this.config.bucket,
          Key: key,
        }),
        { abortSignal: deadlineSignal() }
      );

      return {
        key,
        body: await streamToString(result.Body),
        contentType: result.ContentType,
        metadata: normalizeMetadata(result.Metadata),
      };
    } catch (error) {
      if (isMissingObject(error)) return null;
      throw error;
    }
  }

  async getSignedUrl(key: string, options: SignedUrlOptions): Promise<string> {
    const command =
      options.operation === "read"
        ? new GetObjectCommand({ Bucket: this.config.bucket, Key: key })
        : new PutObjectCommand({
            Bucket: this.config.bucket,
            Key: key,
            ServerSideEncryption: this.config.serverSideEncryption,
            SSEKMSKeyId: this.config.kmsKeyId,
          });

    return getSignedUrl(this.client, command, { expiresIn: options.expiresInSeconds });
  }

  async deleteObject(key: string): Promise<void> {
    await this.client.send(
      new DeleteObjectCommand({
        Bucket: this.config.bucket,
        Key: key,
      }),
      { abortSignal: deadlineSignal() }
    );
  }

  async exists(key: string): Promise<boolean> {
    try {
      await this.client.send(new HeadObjectCommand({ Bucket: this.config.bucket, Key: key }), {
        abortSignal: deadlineSignal(),
      });
      return true;
    } catch (error) {
      if (isMissingObject(error)) return false;
      throw error;
    }
  }
}

function toSdkBody(body: ObjectBody) {
  return typeof body === "string" ? body : Buffer.from(body);
}

async function streamToString(body: unknown): Promise<string> {
  if (!body) return "";
  if (typeof body === "string") return body;
  if (body instanceof Uint8Array) return Buffer.from(body).toString("utf8");

  const stream = body as AsyncIterable<Uint8Array>;
  const chunks: Uint8Array[] = [];
  for await (const chunk of stream) {
    chunks.push(chunk);
  }
  return Buffer.concat(chunks).toString("utf8");
}

function isMissingObject(error: unknown) {
  return (
    error instanceof NoSuchKey ||
    (error instanceof Error && (error.name === "NoSuchKey" || error.name === "NotFound"))
  );
}

function normalizeMetadata(metadata: Record<string, string> | undefined) {
  return Object.fromEntries(
    Object.entries(metadata ?? {}).map(([key, value]) => [key.toLowerCase(), value])
  );
}
