import crypto from "crypto";
import {
  bookmarks,
  collections,
  type Bookmark,
  type Collection,
  type InsertBookmark,
  type InsertCollection,
  type InsertUser,
  type User,
  users,
} from "@shared/schema";
import { GetObjectCommand, PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { and, eq, isNull } from "drizzle-orm";

export interface IStorage {
  listUsers(): Promise<User[]>;
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
  updateCollection(id: string, collection: Partial<InsertCollection>): Promise<Collection | undefined>;
  deleteCollection(id: string): Promise<boolean>;

  getBookmarksByUserId(userId: string, collectionId?: string | null): Promise<Bookmark[]>;
  getBookmark(id: string): Promise<Bookmark | undefined>;
  createBookmark(bookmark: InsertBookmark): Promise<Bookmark>;
  updateBookmark(id: string, bookmark: Partial<InsertBookmark>): Promise<Bookmark | undefined>;
  deleteBookmark(id: string): Promise<boolean>;
}

function filterUndefined<T extends Record<string, unknown>>(input: T): Partial<T> {
  return Object.fromEntries(
    Object.entries(input).filter(([, value]) => value !== undefined),
  ) as Partial<T>;
}

export class DbStorage implements IStorage {
  async listUsers(): Promise<User[]> {
    const { db } = await import("./db.js");
    return db.query.users.findMany();
  }

  async getUser(id: string): Promise<User | undefined> {
    const { db } = await import("./db.js");
    return db.query.users.findFirst({ where: eq(users.id, id) });
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    const { db } = await import("./db.js");
    return db.query.users.findFirst({ where: eq(users.username, username) });
  }

  async getUserByEmail(email: string): Promise<User | undefined> {
    const { db } = await import("./db.js");
    return db.query.users.findFirst({ where: eq(users.email, email) });
  }

  async getUserByVerificationToken(token: string): Promise<User | undefined> {
    const { db } = await import("./db.js");
    return db.query.users.findFirst({ where: eq(users.verificationToken, token) });
  }

  async getUserByResetToken(token: string): Promise<User | undefined> {
    const { db } = await import("./db.js");
    const user = await db.query.users.findFirst({ where: eq(users.resetToken, token) });
    if (!user) return undefined;
    if (!user.resetTokenExpiry || user.resetTokenExpiry <= new Date()) {
      return undefined;
    }
    return user;
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const { db } = await import("./db.js");
    const [user] = await db
      .insert(users)
      .values({
        ...insertUser,
      })
      .returning();
    return user;
  }

  async updateUser(id: string, update: Partial<User>): Promise<User | undefined> {
    const { db } = await import("./db.js");
    const filteredUpdate = filterUndefined(update);
    if (Object.keys(filteredUpdate).length === 0) {
      return this.getUser(id);
    }

    const [user] = await db
      .update(users)
      .set(filteredUpdate)
      .where(eq(users.id, id))
      .returning();
    return user;
  }

  async getCollectionsByUserId(userId: string): Promise<Collection[]> {
    const { db } = await import("./db.js");
    return db.query.collections.findMany({ where: eq(collections.userId, userId) });
  }

  async getCollection(id: string): Promise<Collection | undefined> {
    const { db } = await import("./db.js");
    return db.query.collections.findFirst({ where: eq(collections.id, id) });
  }

  async createCollection(collection: InsertCollection): Promise<Collection> {
    const { db } = await import("./db.js");
    const [created] = await db.insert(collections).values(collection).returning();
    return created;
  }

  async updateCollection(
    id: string,
    update: Partial<InsertCollection>,
  ): Promise<Collection | undefined> {
    const { db } = await import("./db.js");
    const filteredUpdate = filterUndefined(update);
    if (Object.keys(filteredUpdate).length === 0) {
      return this.getCollection(id);
    }

    const [updated] = await db
      .update(collections)
      .set(filteredUpdate)
      .where(eq(collections.id, id))
      .returning();
    return updated;
  }

  async deleteCollection(id: string): Promise<boolean> {
    const { db } = await import("./db.js");
    await db
      .update(bookmarks)
      .set({ collectionId: null })
      .where(eq(bookmarks.collectionId, id));

    const deleted = await db.delete(collections).where(eq(collections.id, id)).returning();
    return deleted.length > 0;
  }

  async getBookmarksByUserId(userId: string, collectionId?: string | null): Promise<Bookmark[]> {
    const { db } = await import("./db.js");
    const conditions = [eq(bookmarks.userId, userId)];

    if (collectionId !== undefined) {
      if (collectionId === null) {
        conditions.push(isNull(bookmarks.collectionId));
      } else {
        conditions.push(eq(bookmarks.collectionId, collectionId));
      }
    }

    const whereClause = conditions.length === 1 ? conditions[0] : and(...conditions);
    return db.query.bookmarks.findMany({ where: whereClause });
  }

  async getBookmark(id: string): Promise<Bookmark | undefined> {
    const { db } = await import("./db.js");
    return db.query.bookmarks.findFirst({ where: eq(bookmarks.id, id) });
  }

  async createBookmark(insertBookmark: InsertBookmark): Promise<Bookmark> {
    const { db } = await import("./db.js");
    const [bookmark] = await db
      .insert(bookmarks)
      .values({
        ...insertBookmark,
        collectionId: insertBookmark.collectionId ?? null,
        favicon: insertBookmark.favicon ?? null,
        memo: insertBookmark.memo ?? null,
      })
      .returning();
    return bookmark;
  }

  async updateBookmark(
    id: string,
    update: Partial<InsertBookmark>,
  ): Promise<Bookmark | undefined> {
    const { db } = await import("./db.js");
    const filteredUpdate = filterUndefined(update);
    if (Object.keys(filteredUpdate).length === 0) {
      return this.getBookmark(id);
    }

    const [bookmark] = await db
      .update(bookmarks)
      .set(filteredUpdate)
      .where(eq(bookmarks.id, id))
      .returning();
    return bookmark;
  }

  async deleteBookmark(id: string): Promise<boolean> {
    const { db } = await import("./db.js");
    const deleted = await db.delete(bookmarks).where(eq(bookmarks.id, id)).returning();
    return deleted.length > 0;
  }
}

export class InMemoryStorage implements IStorage {
  private users: User[] = [];
  private collections: Collection[] = [];
  private bookmarks: Bookmark[] = [];

  async listUsers(): Promise<User[]> {
    return [...this.users];
  }

  async getUser(id: string): Promise<User | undefined> {
    return this.users.find((user) => user.id === id);
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    return this.users.find((user) => user.username === username);
  }

  async getUserByEmail(email: string): Promise<User | undefined> {
    return this.users.find((user) => user.email === email);
  }

  async getUserByVerificationToken(token: string): Promise<User | undefined> {
    return this.users.find((user) => user.verificationToken === token);
  }

  async getUserByResetToken(token: string): Promise<User | undefined> {
    const user = this.users.find((candidate) => candidate.resetToken === token);
    if (!user) return undefined;
    if (!user.resetTokenExpiry || user.resetTokenExpiry <= new Date()) {
      return undefined;
    }
    return user;
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const user: User = {
      id: crypto.randomUUID(),
      emailVerified: null,
      resetToken: null,
      resetTokenExpiry: null,
      verificationToken: null,
      ...insertUser,
    };
    this.users.push(user);
    return user;
  }

  async updateUser(id: string, update: Partial<User>): Promise<User | undefined> {
    const user = await this.getUser(id);
    if (!user) return undefined;
    const filteredUpdate = filterUndefined(update);
    Object.assign(user, filteredUpdate);
    return user;
  }

  async getCollectionsByUserId(userId: string): Promise<Collection[]> {
    return this.collections.filter((collection) => collection.userId === userId);
  }

  async getCollection(id: string): Promise<Collection | undefined> {
    return this.collections.find((collection) => collection.id === id);
  }

  async createCollection(collection: InsertCollection): Promise<Collection> {
    const created: Collection = {
      id: crypto.randomUUID(),
      createdAt: new Date(),
      ...collection,
    };
    this.collections.push(created);
    return created;
  }

  async updateCollection(
    id: string,
    update: Partial<InsertCollection>,
  ): Promise<Collection | undefined> {
    const collection = await this.getCollection(id);
    if (!collection) return undefined;
    const filteredUpdate = filterUndefined(update);
    Object.assign(collection, filteredUpdate);
    return collection;
  }

  async deleteCollection(id: string): Promise<boolean> {
    const initialLength = this.collections.length;
    this.collections = this.collections.filter((collection) => collection.id !== id);
    this.bookmarks = this.bookmarks.map((bookmark) =>
      bookmark.collectionId === id ? { ...bookmark, collectionId: null } : bookmark,
    );
    return this.collections.length < initialLength;
  }

  async getBookmarksByUserId(userId: string, collectionId?: string | null): Promise<Bookmark[]> {
    return this.bookmarks.filter((bookmark) => {
      if (bookmark.userId !== userId) return false;
      if (collectionId === undefined) return true;
      if (collectionId === null) return bookmark.collectionId === null;
      return bookmark.collectionId === collectionId;
    });
  }

  async getBookmark(id: string): Promise<Bookmark | undefined> {
    return this.bookmarks.find((bookmark) => bookmark.id === id);
  }

  async createBookmark(insertBookmark: InsertBookmark): Promise<Bookmark> {
    const bookmark: Bookmark = {
      id: crypto.randomUUID(),
      createdAt: new Date(),
      favicon: insertBookmark.favicon ?? null,
      memo: insertBookmark.memo ?? null,
      collectionId: insertBookmark.collectionId ?? null,
      ...insertBookmark,
    };
    this.bookmarks.push(bookmark);
    return bookmark;
  }

  async updateBookmark(
    id: string,
    update: Partial<InsertBookmark>,
  ): Promise<Bookmark | undefined> {
    const bookmark = await this.getBookmark(id);
    if (!bookmark) return undefined;
    const filteredUpdate = filterUndefined(update);
    Object.assign(bookmark, filteredUpdate);
    return bookmark;
  }

  async deleteBookmark(id: string): Promise<boolean> {
    const initialLength = this.bookmarks.length;
    this.bookmarks = this.bookmarks.filter((bookmark) => bookmark.id !== id);
    return this.bookmarks.length < initialLength;
  }
}

export type S3StorageOptions = {
  bucket: string;
  key: string;
  cacheTtlMs: number;
  lambdaWriteUrl?: string;
};

type S3StorageDependencies = {
  client?: Pick<S3Client, "send">;
  now?: () => number;
  fetchFn?: typeof fetch;
  randomUUID?: () => string;
};

type PersistedData = {
  users: User[];
  collections: Collection[];
  bookmarks: Bookmark[];
};

type CachedData = {
  data: PersistedData;
  etag?: string;
  expiresAt: number;
};

export class S3Storage implements IStorage {
  private readonly client: Pick<S3Client, "send">;
  private readonly now: () => number;
  private readonly fetchFn: typeof fetch;
  private readonly randomUUID: () => string;
  private cache?: CachedData;

  constructor(
    private readonly options: S3StorageOptions,
    dependencies: S3StorageDependencies = {},
  ) {
    this.client = dependencies.client ?? new S3Client({});
    this.now = dependencies.now ?? Date.now;
    this.fetchFn = dependencies.fetchFn ?? fetch;
    this.randomUUID = dependencies.randomUUID ?? crypto.randomUUID;
  }

  async listUsers(): Promise<User[]> {
    const { data } = await this.loadData();
    return data.users;
  }

  async getUser(id: string): Promise<User | undefined> {
    const { data } = await this.loadData();
    return data.users.find((user) => user.id === id);
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    const { data } = await this.loadData();
    return data.users.find((user) => user.username === username);
  }

  async getUserByEmail(email: string): Promise<User | undefined> {
    const { data } = await this.loadData();
    return data.users.find((user) => user.email === email);
  }

  async getUserByVerificationToken(token: string): Promise<User | undefined> {
    const { data } = await this.loadData();
    return data.users.find((user) => user.verificationToken === token);
  }

  async getUserByResetToken(token: string): Promise<User | undefined> {
    const { data } = await this.loadData();
    const user = data.users.find((candidate) => candidate.resetToken === token);
    if (!user) return undefined;
    if (!user.resetTokenExpiry || user.resetTokenExpiry <= new Date()) {
      return undefined;
    }
    return user;
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    if (this.options.lambdaWriteUrl) {
      const user = await this.invokeLambda<User>("createUser", insertUser);
      await this.refreshCache();
      return user;
    }

    let created!: User;
    await this.writeData((data) => {
      created = {
        id: this.randomUUID(),
        emailVerified: null,
        resetToken: null,
        resetTokenExpiry: null,
        verificationToken: null,
        ...insertUser,
      };
      data.users.push(created);
    });
    return created;
  }

  async updateUser(id: string, update: Partial<User>): Promise<User | undefined> {
    const filteredUpdate = filterUndefined(update);
    if (Object.keys(filteredUpdate).length === 0) {
      return this.getUser(id);
    }

    let updated: User | undefined;
    await this.writeData((data) => {
      const user = data.users.find((candidate) => candidate.id === id);
      if (!user) return;
      Object.assign(user, filteredUpdate);
      updated = user;
    });
    return updated;
  }

  async getCollectionsByUserId(userId: string): Promise<Collection[]> {
    const { data } = await this.loadData();
    return data.collections.filter((collection) => collection.userId === userId);
  }

  async getCollection(id: string): Promise<Collection | undefined> {
    const { data } = await this.loadData();
    return data.collections.find((collection) => collection.id === id);
  }

  async createCollection(collection: InsertCollection): Promise<Collection> {
    if (this.options.lambdaWriteUrl) {
      const created = await this.invokeLambda<Collection>("createCollection", collection);
      await this.refreshCache();
      return created;
    }

    let created!: Collection;
    await this.writeData((data) => {
      created = {
        id: this.randomUUID(),
        createdAt: new Date(),
        ...collection,
      };
      data.collections.push(created);
    });
    return created;
  }

  async updateCollection(
    id: string,
    update: Partial<InsertCollection>,
  ): Promise<Collection | undefined> {
    const filteredUpdate = filterUndefined(update);
    if (Object.keys(filteredUpdate).length === 0) {
      return this.getCollection(id);
    }

    let updated: Collection | undefined;
    await this.writeData((data) => {
      const collection = data.collections.find((candidate) => candidate.id === id);
      if (!collection) return;
      Object.assign(collection, filteredUpdate);
      updated = collection;
    });
    return updated;
  }

  async deleteCollection(id: string): Promise<boolean> {
    let deleted = false;
    await this.writeData((data) => {
      const before = data.collections.length;
      data.collections = data.collections.filter((collection) => collection.id !== id);
      deleted = data.collections.length < before;
      data.bookmarks = data.bookmarks.map((bookmark) =>
        bookmark.collectionId === id ? { ...bookmark, collectionId: null } : bookmark,
      );
    });
    return deleted;
  }

  async getBookmarksByUserId(userId: string, collectionId?: string | null): Promise<Bookmark[]> {
    const { data } = await this.loadData();
    return data.bookmarks.filter((bookmark) => {
      if (bookmark.userId !== userId) return false;
      if (collectionId === undefined) return true;
      if (collectionId === null) return bookmark.collectionId === null;
      return bookmark.collectionId === collectionId;
    });
  }

  async getBookmark(id: string): Promise<Bookmark | undefined> {
    const { data } = await this.loadData();
    return data.bookmarks.find((bookmark) => bookmark.id === id);
  }

  async createBookmark(bookmark: InsertBookmark): Promise<Bookmark> {
    if (this.options.lambdaWriteUrl) {
      const created = await this.invokeLambda<Bookmark>("createBookmark", bookmark);
      await this.refreshCache();
      return created;
    }

    let created!: Bookmark;
    await this.writeData((data) => {
      created = {
        id: this.randomUUID(),
        createdAt: new Date(),
        favicon: bookmark.favicon ?? null,
        memo: bookmark.memo ?? null,
        collectionId: bookmark.collectionId ?? null,
        ...bookmark,
      };
      data.bookmarks.push(created);
    });
    return created;
  }

  async updateBookmark(
    id: string,
    update: Partial<InsertBookmark>,
  ): Promise<Bookmark | undefined> {
    const filteredUpdate = filterUndefined(update);
    if (Object.keys(filteredUpdate).length === 0) {
      return this.getBookmark(id);
    }

    let updated: Bookmark | undefined;
    await this.writeData((data) => {
      const bookmark = data.bookmarks.find((candidate) => candidate.id === id);
      if (!bookmark) return;
      Object.assign(bookmark, filteredUpdate);
      updated = bookmark;
    });
    return updated;
  }

  async deleteBookmark(id: string): Promise<boolean> {
    let deleted = false;
    await this.writeData((data) => {
      const before = data.bookmarks.length;
      data.bookmarks = data.bookmarks.filter((bookmark) => bookmark.id !== id);
      deleted = data.bookmarks.length < before;
    });
    return deleted;
  }

  private async loadData(): Promise<CachedData> {
    const now = this.now();
    if (this.cache && this.cache.expiresAt > now) {
      return this.cache;
    }

    const response = await this.client.send(
      new GetObjectCommand({ Bucket: this.options.bucket, Key: this.options.key }),
    );

    const body = await response.Body?.transformToString();
    const parsed = body ? (JSON.parse(body) as PersistedData) : this.emptyData();
    this.cache = {
      data: parsed,
      etag: response.ETag,
      expiresAt: now + this.options.cacheTtlMs,
    };
    return this.cache;
  }

  private async writeData(mutator: (data: PersistedData) => void): Promise<void> {
    const cached = await this.loadData();
    const cloned: PersistedData = {
      users: [...cached.data.users],
      collections: [...cached.data.collections],
      bookmarks: [...cached.data.bookmarks],
    };

    mutator(cloned);

    const result = await this.client.send(
      new PutObjectCommand({
        Bucket: this.options.bucket,
        Key: this.options.key,
        Body: JSON.stringify(cloned),
        ContentType: "application/json",
        IfMatch: cached.etag,
      }),
    );

    this.cache = {
      data: cloned,
      etag: result.ETag ?? cached.etag,
      expiresAt: this.now() + this.options.cacheTtlMs,
    };
  }

  private async invokeLambda<T>(operation: string, payload: unknown): Promise<T> {
    const response = await this.fetchFn(this.options.lambdaWriteUrl as string, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ operation, payload }),
    });

    if (!response.ok) {
      const message = await response.text();
      throw new Error(`Lambda write failed: ${response.status} ${message}`);
    }

    const json = (await response.json()) as { result: T };
    return json.result;
  }

  private async refreshCache(): Promise<void> {
    this.cache = undefined;
    await this.loadData();
  }

  private emptyData(): PersistedData {
    return { users: [], collections: [], bookmarks: [] };
  }
}

function createDefaultStorage(): IStorage {
  if (process.env.DATABASE_URL) {
    return new DbStorage();
  }
  return new InMemoryStorage();
}

let currentStorage: IStorage = createDefaultStorage();

export function setStorageProvider(storage: IStorage): void {
  currentStorage = storage;
}

export function getStorage(): IStorage {
  return currentStorage;
}
