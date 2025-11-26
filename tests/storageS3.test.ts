import assert from "node:assert/strict";
import { test } from "node:test";
import { GetObjectCommand, PutObjectCommand } from "@aws-sdk/client-s3";

import { S3Storage, type S3StorageOptions } from "../server/storage";

type PersistedUser = {
  id: string;
  username: string;
  email: string;
  password: string;
  emailVerified: string | null;
  verificationToken: string | null;
  resetToken: string | null;
  resetTokenExpiry: string | null;
};

type PersistedCollection = {
  id: string;
  userId: string;
  name: string;
  createdAt: string;
};

type PersistedBookmark = {
  id: string;
  userId: string;
  collectionId: string | null;
  url: string;
  title: string;
  domain: string;
  favicon: string | null;
  memo: string | null;
  createdAt: string;
};

type PersistedData = {
  users: PersistedUser[];
  collections: PersistedCollection[];
  bookmarks: PersistedBookmark[];
};

class FakeClock {
  private current = 0;

  now = (): number => this.current;

  advance(ms: number): void {
    this.current += ms;
  }
}

class FakeS3Client {
  getCalls = 0;
  puts: PutObjectCommand[] = [];

  constructor(private payload: PersistedData, private etag: string | undefined = undefined) {}

  setData(data: PersistedData, etag = this.etag): void {
    this.payload = data;
    this.etag = etag;
  }

  get data(): PersistedData {
    return this.payload;
  }

  async send(command: unknown): Promise<any> {
    if (command instanceof GetObjectCommand) {
      this.getCalls += 1;
      return {
        Body: { transformToString: () => JSON.stringify(this.payload) },
        ETag: this.etag,
      };
    }

    if (command instanceof PutObjectCommand) {
      const input = (command as PutObjectCommand).input as any;
      const serialized = typeof input.Body === "string" ? input.Body : input.Body?.toString?.();
      this.payload = serialized ? (JSON.parse(serialized) as PersistedData) : this.payload;
      this.etag = this.bumpEtag();
      this.puts.push(command as PutObjectCommand);
      return { ETag: this.etag };
    }

    throw new Error(`Unexpected command: ${String(command)}`);
  }

  private bumpEtag(): string {
    const next = (this.etag ? parseInt(this.etag.replace(/[^0-9]/g, ""), 10) + 1 : 1).toString();
    return `"${next}"`;
  }
}

const baseOptions = (clock: FakeClock, overrides: Partial<S3StorageOptions> = {}): S3StorageOptions => ({
  bucket: "test-bucket",
  key: "data.json",
  cacheTtlMs: 1_000,
  ...overrides,
});

const persistedUser = (id: string): PersistedUser => ({
  id,
  username: `user-${id}`,
  email: `${id}@example.com`,
  password: "hashed",
  emailVerified: null,
  verificationToken: null,
  resetToken: null,
  resetTokenExpiry: null,
});

const emptyData = (): PersistedData => ({ users: [], collections: [], bookmarks: [] });

test("caches S3 reads until the cache TTL expires", async () => {
  const clock = new FakeClock();
  const client = new FakeS3Client({ ...emptyData(), users: [persistedUser("1")] }, '"1"');
  const storage = new S3Storage(baseOptions(clock), { client, now: clock.now });

  await storage.getUser("1");
  await storage.getUser("1");

  assert.equal(client.getCalls, 1, "second hit should use cache");

  clock.advance(2_000);
  const refreshed = await storage.getUser("1");

  assert.equal(client.getCalls, 2, "cache should refresh after TTL");
  assert.equal(refreshed?.id, "1");
});

test("delegates writes to Lambda when configured and refreshes cache", async () => {
  const clock = new FakeClock();
  const client = new FakeS3Client(emptyData());
  const fetchCalls: any[] = [];

  const storage = new S3Storage(baseOptions(clock, { lambdaWriteUrl: "https://lambda.example" }), {
    client,
    now: clock.now,
    fetchFn: async (url, init) => {
      fetchCalls.push({ url, init });
      const user = persistedUser("lambda-id");
      client.setData({ ...emptyData(), users: [user] }, '"after-lambda"');
      return {
        ok: true,
        status: 200,
        json: async () => ({ result: user }),
        text: async () => "",
      } as any;
    },
  });

  const created = await storage.createUser({
    username: "user-lambda",
    email: "user@example.com",
    password: "secret",
  });

  assert.equal(fetchCalls.length, 1, "lambda endpoint should be invoked");
  const body = JSON.parse(fetchCalls[0]?.init?.body as string);
  assert.equal(body.operation, "createUser");
  assert.equal(client.getCalls, 1, "cache should reload after lambda write");
  assert.equal(created.id, "lambda-id");
});

test("uses optimistic concurrency when writing directly to S3", async () => {
  const clock = new FakeClock();
  const client = new FakeS3Client({ ...emptyData(), users: [persistedUser("owner")] }, '"9"');

  const storage = new S3Storage(baseOptions(clock), {
    client,
    now: clock.now,
    randomUUID: () => "new-collection-id",
  });

  const created = await storage.createCollection({ userId: "owner", name: "Work" });

  assert.equal(created.id, "new-collection-id");
  assert.equal(client.puts.length, 1, "PutObject should be called for direct write");
  const putInput = client.puts[0]?.input as any;
  assert.equal(putInput.IfMatch, '"9"', "optimistic lock should use previous ETag");
});
