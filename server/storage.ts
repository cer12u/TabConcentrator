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
import { db } from "./db";
import { and, eq, isNull } from "drizzle-orm";

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
  async getUser(id: string): Promise<User | undefined> {
    return db.query.users.findFirst({ where: eq(users.id, id) });
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    return db.query.users.findFirst({ where: eq(users.username, username) });
  }

  async getUserByEmail(email: string): Promise<User | undefined> {
    return db.query.users.findFirst({ where: eq(users.email, email) });
  }

  async getUserByVerificationToken(token: string): Promise<User | undefined> {
    return db.query.users.findFirst({ where: eq(users.verificationToken, token) });
  }

  async getUserByResetToken(token: string): Promise<User | undefined> {
    const user = await db.query.users.findFirst({ where: eq(users.resetToken, token) });
    if (!user) return undefined;
    if (!user.resetTokenExpiry || user.resetTokenExpiry <= new Date()) {
      return undefined;
    }
    return user;
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const [user] = await db
      .insert(users)
      .values({
        ...insertUser,
      })
      .returning();
    return user;
  }

  async updateUser(id: string, update: Partial<User>): Promise<User | undefined> {
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
    return db.query.collections.findMany({ where: eq(collections.userId, userId) });
  }

  async getCollection(id: string): Promise<Collection | undefined> {
    return db.query.collections.findFirst({ where: eq(collections.id, id) });
  }

  async createCollection(collection: InsertCollection): Promise<Collection> {
    const [created] = await db.insert(collections).values(collection).returning();
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

    const [updated] = await db
      .update(collections)
      .set(filteredUpdate)
      .where(eq(collections.id, id))
      .returning();
    return updated;
  }

  async deleteCollection(id: string): Promise<boolean> {
    await db
      .update(bookmarks)
      .set({ collectionId: null })
      .where(eq(bookmarks.collectionId, id));

    const deleted = await db.delete(collections).where(eq(collections.id, id)).returning();
    return deleted.length > 0;
  }

  async getBookmarksByUserId(userId: string, collectionId?: string | null): Promise<Bookmark[]> {
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
    return db.query.bookmarks.findFirst({ where: eq(bookmarks.id, id) });
  }

  async createBookmark(insertBookmark: InsertBookmark): Promise<Bookmark> {
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
    const deleted = await db.delete(bookmarks).where(eq(bookmarks.id, id)).returning();
    return deleted.length > 0;
  }
}

export const storage = new DbStorage();
