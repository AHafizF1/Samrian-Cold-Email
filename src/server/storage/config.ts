export type StorageProvider = "s3";

export type StorageEnv = {
  STORAGE_PROVIDER?: string;
  S3_ENDPOINT?: string;
  S3_REGION?: string;
  S3_BUCKET?: string;
  S3_ACCESS_KEY_ID?: string;
  S3_SECRET_ACCESS_KEY?: string;
  S3_FORCE_PATH_STYLE?: string;
  S3_SERVER_SIDE_ENCRYPTION?: string;
  S3_KMS_KEY_ID?: string;
  [key: string]: string | undefined;
};

export type S3Config = {
  provider: "s3";
  endpoint?: string;
  region: string;
  bucket: string;
  accessKeyId: string;
  secretAccessKey: string;
  forcePathStyle: boolean;
  serverSideEncryption?: "AES256" | "aws:kms";
  kmsKeyId?: string;
};

export function readStorageConfig(env: StorageEnv = process.env): S3Config {
  const provider = env.STORAGE_PROVIDER ?? "s3";
  if (provider !== "s3") {
    throw new Error(`Unsupported STORAGE_PROVIDER: ${provider}`);
  }

  const serverSideEncryption = readEncryption(env.S3_SERVER_SIDE_ENCRYPTION);
  const kmsKeyId = optional(env.S3_KMS_KEY_ID);
  if (serverSideEncryption === "aws:kms" && !kmsKeyId) {
    throw new Error("S3_KMS_KEY_ID is required when S3_SERVER_SIDE_ENCRYPTION=aws:kms");
  }

  return {
    provider,
    endpoint: optional(env.S3_ENDPOINT),
    region: env.S3_REGION || "us-east-1",
    bucket: requireEnv(env, "S3_BUCKET"),
    accessKeyId: requireEnv(env, "S3_ACCESS_KEY_ID"),
    secretAccessKey: requireEnv(env, "S3_SECRET_ACCESS_KEY"),
    forcePathStyle: env.S3_FORCE_PATH_STYLE === "true",
    serverSideEncryption,
    kmsKeyId,
  };
}

function readEncryption(value: string | undefined): "AES256" | "aws:kms" | undefined {
  if (!value) return undefined;
  if (value === "AES256" || value === "aws:kms") return value;
  throw new Error("S3_SERVER_SIDE_ENCRYPTION must be AES256 or aws:kms");
}

function requireEnv(env: StorageEnv, key: keyof StorageEnv): string {
  const value = env[key];
  if (!value) throw new Error(`${key} is required`);
  return value;
}

function optional(value: string | undefined) {
  return value && value.length > 0 ? value : undefined;
}
