import type { Express } from "express";
import { createServer, type Server } from "http";
import session from "express-session";
import createMemoryStore from "memorystore";
import { storage } from "./storage";
import { insertUserSchema, insertBookmarkSchema } from "@shared/schema";
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

  const httpServer = createServer(app);

  return httpServer;
}
