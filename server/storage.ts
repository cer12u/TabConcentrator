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
