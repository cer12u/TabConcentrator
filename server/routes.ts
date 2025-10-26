import type { Express } from "express";
import { createServer, type Server } from "http";
import session from "express-session";
import createMemoryStore from "memorystore";
import { z } from "zod";
import { storage } from "./storage";
import { insertUserSchema, insertBookmarkSchema, insertCollectionSchema } from "@shared/schema";
import { fromZodError } from "zod-validation-error";

const MemoryStore = createMemoryStore(session);

declare module "express-session" {
  interface SessionData {
    userId?: string;
  }
}

export async function registerRoutes(app: Express): Promise<Server> {
  app.use(
    session({
      secret: process.env.SESSION_SECRET || "bookmark-manager-secret-key",
      resave: false,
      saveUninitialized: false,
      store: new MemoryStore({
        checkPeriod: 86400000,
      }),
      cookie: {
        secure: process.env.NODE_ENV === "production",
        httpOnly: true,
        maxAge: 7 * 24 * 60 * 60 * 1000,
      },
    })
  );

  app.post("/api/auth/register", async (req, res) => {
    try {
      const result = insertUserSchema.safeParse(req.body);
      if (!result.success) {
        return res.status(400).json({ error: fromZodError(result.error).message });
      }

      const { username, password } = result.data;

      const existingUser = await storage.getUserByUsername(username);
      if (existingUser) {
        return res.status(400).json({ error: "ユーザー名は既に使用されています" });
      }

      const user = await storage.createUser({ username, password });

      req.session.userId = user.id;
      
      res.json({ 
        id: user.id, 
        username: user.username 
      });
    } catch (error) {
      console.error("Register error:", error);
      res.status(500).json({ error: "登録に失敗しました" });
    }
  });

  app.post("/api/auth/login", async (req, res) => {
    try {
      const result = insertUserSchema.safeParse(req.body);
      if (!result.success) {
        return res.status(400).json({ error: fromZodError(result.error).message });
      }

      const { username, password } = result.data;

      const user = await storage.getUserByUsername(username);
      if (!user || user.password !== password) {
        return res.status(401).json({ error: "ユーザー名またはパスワードが正しくありません" });
      }

      req.session.userId = user.id;

      res.json({ 
        id: user.id, 
        username: user.username 
      });
    } catch (error) {
      console.error("Login error:", error);
      res.status(500).json({ error: "ログインに失敗しました" });
    }
  });

  app.post("/api/auth/logout", (req, res) => {
    req.session.destroy((err) => {
      if (err) {
        return res.status(500).json({ error: "ログアウトに失敗しました" });
      }
      res.json({ message: "ログアウトしました" });
    });
  });

  app.get("/api/auth/me", async (req, res) => {
    if (!req.session.userId) {
      return res.status(401).json({ error: "ログインしていません" });
    }

    const user = await storage.getUser(req.session.userId);
    if (!user) {
      return res.status(404).json({ error: "ユーザーが見つかりません" });
    }

    res.json({ 
      id: user.id, 
      username: user.username 
    });
  });

  const requireAuth = (req: any, res: any, next: any) => {
    if (!req.session.userId) {
      return res.status(401).json({ error: "ログインしていません" });
    }
    next();
  };

  app.get("/api/collections", requireAuth, async (req, res) => {
    try {
      const userId = req.session.userId!;
      const collections = await storage.getCollectionsByUserId(userId);
      res.json(collections);
    } catch (error) {
      console.error("Get collections error:", error);
      res.status(500).json({ error: "コレクションの取得に失敗しました" });
    }
  });

  app.post("/api/collections", requireAuth, async (req, res) => {
    try {
      const userId = req.session.userId!;
      const result = insertCollectionSchema.safeParse({ ...req.body, userId });
      
      if (!result.success) {
        return res.status(400).json({ error: fromZodError(result.error).message });
      }

      const collection = await storage.createCollection(result.data);
      res.json(collection);
    } catch (error) {
      console.error("Create collection error:", error);
      res.status(500).json({ error: "コレクションの作成に失敗しました" });
    }
  });

  app.patch("/api/collections/:id", requireAuth, async (req, res) => {
    try {
      const { id } = req.params;
      const userId = req.session.userId!;

      const existingCollection = await storage.getCollection(id);
      if (!existingCollection) {
        return res.status(404).json({ error: "コレクションが見つかりません" });
      }

      if (existingCollection.userId !== userId) {
        return res.status(403).json({ error: "このコレクションを編集する権限がありません" });
      }

      const updateSchema = z.object({
        name: z.string().optional(),
      });

      const result = updateSchema.safeParse(req.body);
      if (!result.success) {
        return res.status(400).json({ error: fromZodError(result.error).message });
      }

      const collection = await storage.updateCollection(id, result.data);
      res.json(collection);
    } catch (error) {
      console.error("Update collection error:", error);
      res.status(500).json({ error: "コレクションの更新に失敗しました" });
    }
  });

  app.delete("/api/collections/:id", requireAuth, async (req, res) => {
    try {
      const { id } = req.params;
      const userId = req.session.userId!;

      const existingCollection = await storage.getCollection(id);
      if (!existingCollection) {
        return res.status(404).json({ error: "コレクションが見つかりません" });
      }

      if (existingCollection.userId !== userId) {
        return res.status(403).json({ error: "このコレクションを削除する権限がありません" });
      }

      await storage.deleteCollection(id);
      res.json({ message: "コレクションを削除しました" });
    } catch (error) {
      console.error("Delete collection error:", error);
      res.status(500).json({ error: "コレクションの削除に失敗しました" });
    }
  });

  app.get("/api/bookmarks", requireAuth, async (req, res) => {
    try {
      const userId = req.session.userId!;
      const collectionId = req.query.collectionId as string | undefined;
      const bookmarks = await storage.getBookmarksByUserId(userId, collectionId === "null" ? null : collectionId);
      res.json(bookmarks);
    } catch (error) {
      console.error("Get bookmarks error:", error);
      res.status(500).json({ error: "ブックマークの取得に失敗しました" });
    }
  });

  app.post("/api/bookmarks", requireAuth, async (req, res) => {
    try {
      const userId = req.session.userId!;
      const result = insertBookmarkSchema.safeParse({ ...req.body, userId });
      
      if (!result.success) {
        return res.status(400).json({ error: fromZodError(result.error).message });
      }

      const bookmark = await storage.createBookmark(result.data);
      res.json(bookmark);
    } catch (error) {
      console.error("Create bookmark error:", error);
      res.status(500).json({ error: "ブックマークの作成に失敗しました" });
    }
  });

  app.patch("/api/bookmarks/:id", requireAuth, async (req, res) => {
    try {
      const { id } = req.params;
      const userId = req.session.userId!;

      const existingBookmark = await storage.getBookmark(id);
      if (!existingBookmark) {
        return res.status(404).json({ error: "ブックマークが見つかりません" });
      }

      if (existingBookmark.userId !== userId) {
        return res.status(403).json({ error: "このブックマークを編集する権限がありません" });
      }

      const updateSchema = z.object({
        memo: z.string().optional(),
        favicon: z.string().optional(),
      });

      const result = updateSchema.safeParse(req.body);
      if (!result.success) {
        return res.status(400).json({ error: fromZodError(result.error).message });
      }

      const bookmark = await storage.updateBookmark(id, result.data);
      res.json(bookmark);
    } catch (error) {
      console.error("Update bookmark error:", error);
      res.status(500).json({ error: "ブックマークの更新に失敗しました" });
    }
  });

  app.delete("/api/bookmarks/:id", requireAuth, async (req, res) => {
    try {
      const { id } = req.params;
      const userId = req.session.userId!;

      const existingBookmark = await storage.getBookmark(id);
      if (!existingBookmark) {
        return res.status(404).json({ error: "ブックマークが見つかりません" });
      }

      if (existingBookmark.userId !== userId) {
        return res.status(403).json({ error: "このブックマークを削除する権限がありません" });
      }

      await storage.deleteBookmark(id);
      res.json({ message: "ブックマークを削除しました" });
    } catch (error) {
      console.error("Delete bookmark error:", error);
      res.status(500).json({ error: "ブックマークの削除に失敗しました" });
    }
  });

  const httpServer = createServer(app);

  return httpServer;
}
