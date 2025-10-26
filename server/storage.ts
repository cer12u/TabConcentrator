import { type User, type InsertUser, type Bookmark, type InsertBookmark, type Collection, type InsertCollection } from "@shared/schema";
import { randomUUID } from "crypto";

export interface IStorage {
  getUser(id: string): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;
  
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

export class MemStorage implements IStorage {
  private users: Map<string, User>;
  private collections: Map<string, Collection>;
  private bookmarks: Map<string, Bookmark>;

  constructor() {
    this.users = new Map();
    this.collections = new Map();
    this.bookmarks = new Map();
  }

  async getUser(id: string): Promise<User | undefined> {
    return this.users.get(id);
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    return Array.from(this.users.values()).find(
      (user) => user.username === username,
    );
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const id = randomUUID();
    const user: User = { ...insertUser, id };
    this.users.set(id, user);
    return user;
  }

  async getCollectionsByUserId(userId: string): Promise<Collection[]> {
    return Array.from(this.collections.values()).filter(
      (collection) => collection.userId === userId,
    );
  }

  async getCollection(id: string): Promise<Collection | undefined> {
    return this.collections.get(id);
  }

  async createCollection(insertCollection: InsertCollection): Promise<Collection> {
    const id = randomUUID();
    const collection: Collection = {
      userId: insertCollection.userId,
      name: insertCollection.name,
      id,
      createdAt: new Date(),
    };
    this.collections.set(id, collection);
    return collection;
  }

  async updateCollection(
    id: string,
    update: Partial<InsertCollection>,
  ): Promise<Collection | undefined> {
    const collection = this.collections.get(id);
    if (!collection) return undefined;

    const updated: Collection = { ...collection, ...update };
    this.collections.set(id, updated);
    return updated;
  }

  async deleteCollection(id: string): Promise<boolean> {
    const deleted = this.collections.delete(id);
    if (deleted) {
      for (const [bookmarkId, bookmark] of this.bookmarks.entries()) {
        if (bookmark.collectionId === id) {
          this.bookmarks.set(bookmarkId, { ...bookmark, collectionId: null });
        }
      }
    }
    return deleted;
  }

  async getBookmarksByUserId(userId: string, collectionId?: string | null): Promise<Bookmark[]> {
    return Array.from(this.bookmarks.values()).filter(
      (bookmark) => 
        bookmark.userId === userId && 
        (collectionId === undefined || bookmark.collectionId === collectionId)
    );
  }

  async getBookmark(id: string): Promise<Bookmark | undefined> {
    return this.bookmarks.get(id);
  }

  async createBookmark(insertBookmark: InsertBookmark): Promise<Bookmark> {
    const id = randomUUID();
    const bookmark: Bookmark = {
      userId: insertBookmark.userId,
      collectionId: insertBookmark.collectionId ?? null,
      url: insertBookmark.url,
      title: insertBookmark.title,
      domain: insertBookmark.domain,
      favicon: insertBookmark.favicon ?? null,
      memo: insertBookmark.memo ?? null,
      id,
      createdAt: new Date(),
    };
    this.bookmarks.set(id, bookmark);
    return bookmark;
  }

  async updateBookmark(
    id: string,
    update: Partial<InsertBookmark>,
  ): Promise<Bookmark | undefined> {
    const bookmark = this.bookmarks.get(id);
    if (!bookmark) return undefined;

    const updated: Bookmark = { ...bookmark, ...update };
    this.bookmarks.set(id, updated);
    return updated;
  }

  async deleteBookmark(id: string): Promise<boolean> {
    return this.bookmarks.delete(id);
  }
}

export const storage = new MemStorage();
