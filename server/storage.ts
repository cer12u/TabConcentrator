import {
  type Bookmark,
  type Collection,
  type InsertBookmark,
  type InsertCollection,
  type InsertUser,
  type User,
} from "@shared/schema";
import { GetObjectCommand, PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { randomUUID } from "crypto";

export interface IStorage {
  getUser(id: string): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  getUserByEmail(email: string): Promise<User | undefined>;
  getUserByVerificationToken(token: string): Promise<User | undefined>;
  getUserByResetToken(token: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;
  updateUser(id: string, user: Partial<User>): Promise<User | undefined>;

  getCollectionsByUserId(userId: string): Promise<Collection[]>;
  getCollection(id: string): Promise<Collection | undefined>;
  createCollection(collection: InsertCollection): Promise<Collection>;
  updateCollection(
    id: string,
    collection: Partial<InsertCollection>,
  ): Promise<Collection | undefined>;
  deleteCollection(id: string): Promise<boolean>;

  getBookmarksByUserId(
    userId: string,
    collectionId?: string | null,
  ): Promise<Bookmark[]>;
  getBookmark(id: string): Promise<Bookmark | undefined>;
  createBookmark(bookmark: InsertBookmark): Promise<Bookmark>;
  updateBookmark(
    id: string,
    bookmark: Partial<InsertBookmark>,
  ): Promise<Bookmark | undefined>;
  deleteBookmark(id: string): Promise<boolean>;
}

type PersistedUser = Omit<User, "emailVerified" | "resetTokenExpiry"> & {
  emailVerified: string | null;
  resetTokenExpiry: string | null;
};

type PersistedCollection = Omit<Collection, "createdAt"> & { createdAt: string };
type PersistedBookmark = Omit<Bookmark, "createdAt"> & { createdAt: string };

type PersistedData = {
  users: PersistedUser[];
  collections: PersistedCollection[];
  bookmarks: PersistedBookmark[];
};

type CachedData = {
  data: PersistedData;
  etag?: string;
  loadedAt: number;
};

function deserialize(data: PersistedData): {
  users: User[];
  collections: Collection[];
  bookmarks: Bookmark[];
} {
  return {
    users: data.users.map((user) => ({
      ...user,
      emailVerified: user.emailVerified ? new Date(user.emailVerified) : null,
      resetTokenExpiry: user.resetTokenExpiry
        ? new Date(user.resetTokenExpiry)
        : null,
    })),
    collections: data.collections.map((collection) => ({
      ...collection,
      createdAt: new Date(collection.createdAt),
    })),
    bookmarks: data.bookmarks.map((bookmark) => ({
      ...bookmark,
      createdAt: new Date(bookmark.createdAt),
    })),
  };
}

function serialize(data: {
  users: User[];
  collections: Collection[];
  bookmarks: Bookmark[];
}): PersistedData {
  return {
    users: data.users.map((user) => ({
      ...user,
      emailVerified: user.emailVerified ? user.emailVerified.toISOString() : null,
      resetTokenExpiry: user.resetTokenExpiry
        ? user.resetTokenExpiry.toISOString()
        : null,
    })),
    collections: data.collections.map((collection) => ({
      ...collection,
      createdAt: collection.createdAt.toISOString(),
    })),
    bookmarks: data.bookmarks.map((bookmark) => ({
      ...bookmark,
      createdAt: bookmark.createdAt.toISOString(),
    })),
  };
}

async function streamToString(stream: any): Promise<string> {
  if (!stream) return "";

  if (typeof stream.transformToString === "function") {
    return stream.transformToString();
  }

  const chunks: Buffer[] = [];
  for await (const chunk of stream) {
    chunks.push(typeof chunk === "string" ? Buffer.from(chunk) : chunk);
  }
  return Buffer.concat(chunks).toString("utf-8");
}

export type S3StorageOptions = {
  bucket: string;
  key: string;
  region?: string;
  lambdaWriteUrl?: string;
  cacheTtlMs?: number;
};

export type S3StorageDependencies = {
  client?: Pick<S3Client, "send">;
  now?: () => number;
  fetchFn?: typeof fetch;
  randomUUID?: () => string;
};

export class S3Storage implements IStorage {
  private client: Pick<S3Client, "send">;
  private cache?: CachedData;
  private cacheTtlMs: number;
  private fetchFn: typeof fetch;
  private now: () => number;
  private generateId: () => string;

  constructor(private options: S3StorageOptions, deps: S3StorageDependencies = {}) {
    this.client = deps.client ?? new S3Client({ region: options.region ?? "us-east-1" });
    this.cacheTtlMs = options.cacheTtlMs ?? 30_000;
    this.fetchFn = deps.fetchFn ?? fetch;
    this.now = deps.now ?? Date.now;
    this.generateId = deps.randomUUID ?? randomUUID;
  }

  private get lambdaWriteUrl(): string | undefined {
    return this.options.lambdaWriteUrl;
  }

  private cloneData(data: PersistedData): PersistedData {
    return structuredClone(data);
  }

  private async fetchData(force = false): Promise<CachedData> {
    const now = this.now();
    if (!force && this.cache && now - this.cache.loadedAt < this.cacheTtlMs) {
      return this.cache;
    }

    try {
      const response = await this.client.send(
        new GetObjectCommand({ Bucket: this.options.bucket, Key: this.options.key }),
      );

      const body = await streamToString(response.Body);
      const parsed = body ? (JSON.parse(body) as PersistedData) : this.emptyData();
      const cached: CachedData = {
        data: parsed,
        etag: response.ETag,
        loadedAt: now,
      };
      this.cache = cached;
      return cached;
    } catch (error: any) {
      if (error?.name === "NoSuchKey" || error?.$metadata?.httpStatusCode === 404) {
        const cached: CachedData = {
          data: this.emptyData(),
          loadedAt: now,
        };
        this.cache = cached;
        return cached;
      }
      throw error;
    }
  }

  private emptyData(): PersistedData {
    return { users: [], collections: [], bookmarks: [] };
  }

  private async saveData(data: PersistedData, previousEtag?: string): Promise<void> {
    const serialized = JSON.stringify(data);
    const response = await this.client.send(
      new PutObjectCommand({
        Bucket: this.options.bucket,
        Key: this.options.key,
        Body: serialized,
        ContentType: "application/json",
        ...(previousEtag ? { IfMatch: previousEtag } : {}),
      }),
    );

    this.cache = {
      data,
      etag: response.ETag ?? previousEtag,
      loadedAt: this.now(),
    };
  }

  private async invokeLambda(
    operation: string,
    payload: Record<string, unknown>,
  ): Promise<any> {
    if (!this.lambdaWriteUrl) {
      throw new Error("LAMBDA_WRITE_URL is not configured");
    }

    const response = await this.fetchFn(this.lambdaWriteUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ operation, payload }),
    });

    if (!response.ok) {
      const text = await response.text();
      throw new Error(`Lambda write failed (${response.status}): ${text}`);
    }

    return response.json();
  }

  private async withWriteFallback<T>(
    operation: string,
    payload: Record<string, unknown>,
    localMutator: (data: PersistedData) => T,
  ): Promise<T> {
    if (this.lambdaWriteUrl) {
      const lambdaResult = await this.invokeLambda(operation, payload);
      // Force cache refresh after lambda writes
      this.cache = undefined;
      await this.fetchData(true);
      return lambdaResult?.result as T;
    }

    const cached = await this.fetchData();
    const nextData = this.cloneData(cached.data);
    const result = localMutator(nextData);
    await this.saveData(nextData, cached.etag);
    return result;
  }

  async getUser(id: string): Promise<User | undefined> {
    const data = deserialize((await this.fetchData()).data);
    return data.users.find((user) => user.id === id);
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    const data = deserialize((await this.fetchData()).data);
    return data.users.find((user) => user.username === username);
  }

  async getUserByEmail(email: string): Promise<User | undefined> {
    const data = deserialize((await this.fetchData()).data);
    return data.users.find((user) => user.email === email);
  }

  async getUserByVerificationToken(token: string): Promise<User | undefined> {
    const data = deserialize((await this.fetchData()).data);
    return data.users.find((user) => user.verificationToken === token);
  }

  async getUserByResetToken(token: string): Promise<User | undefined> {
    const data = deserialize((await this.fetchData()).data);
    const user = data.users.find((candidate) => candidate.resetToken === token);
    if (!user) return undefined;
    if (!user.resetTokenExpiry || user.resetTokenExpiry <= new Date()) {
      return undefined;
    }
    return user;
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    return this.withWriteFallback("createUser", { insertUser }, (data) => {
      const user: PersistedUser = {
        id: this.generateId(),
        username: insertUser.username,
        email: insertUser.email,
        password: insertUser.password,
        emailVerified: null,
        verificationToken: null,
        resetToken: null,
        resetTokenExpiry: null,
      };

      data.users.push(user);
      return deserialize({ ...data, users: [user] }).users[0]!;
    });
  }

  async updateUser(id: string, update: Partial<User>): Promise<User | undefined> {
    return this.withWriteFallback("updateUser", { id, update }, (data) => {
      const userIndex = data.users.findIndex((user) => user.id === id);
      if (userIndex === -1) return undefined;

      const existing = data.users[userIndex];
      const updated: PersistedUser = {
        ...existing,
        ...this.toPersistedUser(update),
      };

      data.users[userIndex] = updated;
      return deserialize({ ...data, users: [updated] }).users[0];
    });
  }

  private toPersistedUser(update: Partial<User>): Partial<PersistedUser> {
    const result: Partial<PersistedUser> = {};

    if (update.username !== undefined) result.username = update.username;
    if (update.email !== undefined) result.email = update.email;
    if (update.password !== undefined) result.password = update.password;
    if (update.emailVerified !== undefined)
      result.emailVerified = update.emailVerified ? update.emailVerified.toISOString() : null;
    if (update.verificationToken !== undefined)
      result.verificationToken = update.verificationToken ?? null;
    if (update.resetToken !== undefined) result.resetToken = update.resetToken ?? null;
    if (update.resetTokenExpiry !== undefined)
      result.resetTokenExpiry = update.resetTokenExpiry
        ? update.resetTokenExpiry.toISOString()
        : null;

    return result;
  }

  async getCollectionsByUserId(userId: string): Promise<Collection[]> {
    const data = deserialize((await this.fetchData()).data);
    return data.collections.filter((collection) => collection.userId === userId);
  }

  async getCollection(id: string): Promise<Collection | undefined> {
    const data = deserialize((await this.fetchData()).data);
    return data.collections.find((collection) => collection.id === id);
  }

  async createCollection(collection: InsertCollection): Promise<Collection> {
    return this.withWriteFallback("createCollection", { collection }, (data) => {
      const created: PersistedCollection = {
        id: this.generateId(),
        userId: collection.userId,
        name: collection.name,
        createdAt: new Date().toISOString(),
      };

      data.collections.push(created);
      return deserialize({ ...data, collections: [created] }).collections[0]!;
    });
  }

  async updateCollection(
    id: string,
    update: Partial<InsertCollection>,
  ): Promise<Collection | undefined> {
    return this.withWriteFallback("updateCollection", { id, update }, (data) => {
      const index = data.collections.findIndex((collection) => collection.id === id);
      if (index === -1) return undefined;

      const existing = data.collections[index];
      const updated: PersistedCollection = {
        ...existing,
        ...(update.name !== undefined ? { name: update.name } : {}),
        ...(update.userId !== undefined ? { userId: update.userId } : {}),
      };

      data.collections[index] = updated;
      return deserialize({ ...data, collections: [updated] }).collections[0];
    });
  }

  async deleteCollection(id: string): Promise<boolean> {
    return this.withWriteFallback("deleteCollection", { id }, (data) => {
      const existing = data.collections.find((collection) => collection.id === id);
      if (!existing) return false;

      data.collections = data.collections.filter((collection) => collection.id !== id);
      data.bookmarks = data.bookmarks.map((bookmark) =>
        bookmark.collectionId === id ? { ...bookmark, collectionId: null } : bookmark,
      );

      return true;
    });
  }

  async getBookmarksByUserId(
    userId: string,
    collectionId?: string | null,
  ): Promise<Bookmark[]> {
    const data = deserialize((await this.fetchData()).data);
    return data.bookmarks.filter((bookmark) => {
      if (bookmark.userId !== userId) return false;
      if (collectionId === undefined) return true;
      if (collectionId === null) return bookmark.collectionId === null;
      return bookmark.collectionId === collectionId;
    });
  }

  async getBookmark(id: string): Promise<Bookmark | undefined> {
    const data = deserialize((await this.fetchData()).data);
    return data.bookmarks.find((bookmark) => bookmark.id === id);
  }

  async createBookmark(insertBookmark: InsertBookmark): Promise<Bookmark> {
    return this.withWriteFallback("createBookmark", { insertBookmark }, (data) => {
      const bookmark: PersistedBookmark = {
        id: this.generateId(),
        userId: insertBookmark.userId,
        collectionId: insertBookmark.collectionId ?? null,
        url: insertBookmark.url,
        title: insertBookmark.title,
        domain: insertBookmark.domain,
        favicon: insertBookmark.favicon ?? null,
        memo: insertBookmark.memo ?? null,
        createdAt: new Date().toISOString(),
      };

      data.bookmarks.push(bookmark);
      return deserialize({ ...data, bookmarks: [bookmark] }).bookmarks[0]!;
    });
  }

  async updateBookmark(
    id: string,
    update: Partial<InsertBookmark>,
  ): Promise<Bookmark | undefined> {
    return this.withWriteFallback("updateBookmark", { id, update }, (data) => {
      const index = data.bookmarks.findIndex((bookmark) => bookmark.id === id);
      if (index === -1) return undefined;

      const existing = data.bookmarks[index];
      const updated: PersistedBookmark = {
        ...existing,
        ...(update.collectionId !== undefined
          ? { collectionId: update.collectionId ?? null }
          : {}),
        ...(update.url !== undefined ? { url: update.url } : {}),
        ...(update.title !== undefined ? { title: update.title } : {}),
        ...(update.domain !== undefined ? { domain: update.domain } : {}),
        ...(update.favicon !== undefined ? { favicon: update.favicon ?? null } : {}),
        ...(update.memo !== undefined ? { memo: update.memo ?? null } : {}),
      };

      data.bookmarks[index] = updated;
      return deserialize({ ...data, bookmarks: [updated] }).bookmarks[0];
    });
  }

  async deleteBookmark(id: string): Promise<boolean> {
    return this.withWriteFallback("deleteBookmark", { id }, (data) => {
      const existing = data.bookmarks.find((bookmark) => bookmark.id === id);
      if (!existing) return false;

      data.bookmarks = data.bookmarks.filter((bookmark) => bookmark.id !== id);
      return true;
    });
  }
}

function resolveEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`${name} must be set to use S3 storage`);
  }
  return value;
}

export function createS3StorageFromEnv(deps?: S3StorageDependencies): S3Storage {
  return new S3Storage(
    {
      bucket: resolveEnv("S3_BUCKET"),
      key: process.env.S3_KEY ?? "data.json",
      region: process.env.S3_REGION,
      lambdaWriteUrl: process.env.LAMBDA_WRITE_URL,
      cacheTtlMs: process.env.S3_CACHE_TTL_MS
        ? parseInt(process.env.S3_CACHE_TTL_MS, 10)
        : undefined,
    },
    deps,
  );
}

export const storage = createS3StorageFromEnv();
