import assert from "node:assert/strict";
import { afterEach, test } from "node:test";

function resetEnv() {
  delete process.env.S3_BUCKET;
  delete process.env.S3_KEY;
  delete process.env.S3_REGION;
  delete process.env.S3_CACHE_TTL_MS;
  delete process.env.LAMBDA_WRITE_URL;
  delete process.env.DATABASE_URL;
}

afterEach(() => {
  resetEnv();
});

async function loadStorageModule() {
  return import(`../server/storage.js?${Math.random()}`);
}

test("uses S3 storage when bucket and key are provided", async () => {
  process.env.S3_BUCKET = "app-bucket";
  process.env.S3_KEY = "data.json";
  process.env.S3_REGION = "ap-northeast-1";

  const storageModule = await loadStorageModule();
  const storage = storageModule.getStorage();

  assert(storage instanceof storageModule.S3Storage);
});

test("falls back to in-memory storage when no backend is configured", async () => {
  const storageModule = await loadStorageModule();
  const storage = storageModule.getStorage();

  assert(storage instanceof storageModule.InMemoryStorage);
});
