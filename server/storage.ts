import crypto from "crypto";
import {
  type Bookmark,
  type Collection,
  type InsertBookmark,
  type InsertCollection,
  type InsertUser,
  type User,
} from "@shared/schema";
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
    const { db } = await import("./db.js");
    await db
      .update(bookmarks)
      .set({ collectionId: null })
      .where(eq(bookmarks.collectionId, id));

      data.collections = data.collections.filter((collection) => collection.id !== id);
      data.bookmarks = data.bookmarks.map((bookmark) =>
        bookmark.collectionId === id ? { ...bookmark, collectionId: null } : bookmark,
      );

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
    const { db } = await import("./db.js");
    const filteredUpdate = filterUndefined(update);
    if (Object.keys(filteredUpdate).length === 0) {
      return this.getBookmark(id);
    }

      data.bookmarks[index] = updated;
      return deserialize({ ...data, bookmarks: [updated] }).bookmarks[0];
    });
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
