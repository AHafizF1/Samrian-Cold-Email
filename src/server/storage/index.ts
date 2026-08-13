import type { ObjectStore } from "../ports";
import { readStorageConfig, type StorageEnv } from "./config";
import { S3Store } from "./s3";

export { readStorageConfig, type S3Config, type StorageEnv } from "./config";
export { S3Store } from "./s3";

export function createObjectStore(env?: StorageEnv): ObjectStore {
  return new S3Store(readStorageConfig(env));
}
