import type { Express } from "express";
import session from "express-session";
import memorystore from "memorystore";
import connectPgSimple from "connect-pg-simple";
import { z } from "zod";
import bcrypt from "bcrypt";
import { randomBytes } from "crypto";
import { getStorage } from "./storage";
import { insertUserSchema, insertBookmarkSchema, insertCollectionSchema, loginSchema, PASSWORD_MIN_LENGTH } from "@shared/schema";
import { fromZodError } from "zod-validation-error";
import { fetchImageAsBase64, isBase64Image, isHttpUrl } from "./utils/imageUtils";
import { exportUserToS3 } from "./exporter";
import {
  cognitoConfirmForgotPassword,
  cognitoForgotPassword,
  cognitoGlobalSignOut,
  cognitoInitiateAuth,
  cognitoSignUp,
  getCognitoConfig,
  verifyCognitoIdToken,
} from "./utils/cognito";

const SALT_ROUNDS = 10;
const PLACEHOLDER_PASSWORD = bcrypt.hashSync("cognito-managed-password", SALT_ROUNDS);

declare module "express-session" {
  interface SessionData {
    userId?: string;
    csrfToken?: string;
    cognitoAccessToken?: string;
    cognitoIdToken?: string;
    cognitoRefreshToken?: string;
    cognitoUsername?: string;
    cognitoEmail?: string;
  }
}

declare module "express-serve-static-core" {
  interface Request {
    authUser?: {
      username?: string;
      email?: string;
      emailVerified?: boolean;
    };
  }
}

const MemoryStore = memorystore(session);
const PgSessionStore = connectPgSimple(session);

export async function registerRoutes(app: Express): Promise<void> {
  if (!process.env.SESSION_SECRET) {
    throw new Error("SESSION_SECRET environment variable is required");
  }

  // Validate Cognito configuration early so misconfiguration fails fast
  getCognitoConfig();


  const hasDatabase = Boolean(process.env.DATABASE_URL);
  const useMemorySession = process.env.SESSION_STORE_STRATEGY === "memory" || !hasDatabase;

  if (!hasDatabase && !useMemorySession) {
    throw new Error("DATABASE_URL environment variable is required for session storage");
  }

  if (useMemorySession && app.get("env") === "production") {
    console.warn("SESSION_STORE_STRATEGY=memory: sessions will reset when instances recycle.");
  }

  const sessionStore = useMemorySession
    ? new MemoryStore({ checkPeriod: 86400000 })
    : new PgSessionStore({
        conString: process.env.DATABASE_URL,
        tableName: "session",
        createTableIfMissing: true,
      });

  app.use(
    session({
      secret: process.env.SESSION_SECRET,
      resave: false,
      saveUninitialized: false,
      store: sessionStore,
      cookie: {
        secure: process.env.NODE_ENV === "production",
        httpOnly: true,
        maxAge: 7 * 24 * 60 * 60 * 1000,
        sameSite: "lax",
      },
    })
  );

  // CSRF token middleware - generate token for all sessions
  app.use((req, res, next) => {
    if (!req.session.csrfToken) {
      req.session.csrfToken = randomBytes(32).toString('hex');
    }
    next();
  });

  // Provide CSRF token endpoint (must be before CSRF validation)
  app.get("/api/csrf-token", (req, res) => {
    res.json({ csrfToken: req.session.csrfToken });
  });

  // CSRF validation middleware for state-changing methods only
  const validateCSRF = (req: any, res: any, next: any) => {
    // Skip validation for safe methods
    if (req.method === 'GET' || req.method === 'HEAD' || req.method === 'OPTIONS') {
      return next();
    }
    
    // Skip validation for CSRF token endpoint itself
    if (req.path === '/api/csrf-token') {
      return next();
    }
    
    const tokenFromHeader = req.headers['x-csrf-token'];
    const sessionToken = req.session.csrfToken;
    
    if (!tokenFromHeader || !sessionToken || tokenFromHeader !== sessionToken) {
      return res.status(403).json({ error: "Invalid CSRF token" });
    }
    
    next();
  };

  // Apply CSRF validation to all /api routes except those explicitly handled above
  app.use('/api', validateCSRF);

  const storage = getStorage();

  async function ensureLocalUser(
    username: string,
    email?: string,
    emailVerified?: boolean,
  ) {
    let user = await storage.getUserByUsername(username);
    if (!user) {
      user = await storage.createUser({
        username,
        email: email ?? `${username}@example.invalid`,
        password: PLACEHOLDER_PASSWORD,
      });
    }

    const updates: Record<string, unknown> = {};
    if (email && email !== user.email) {
      updates.email = email;
    }
    if (emailVerified && !user.emailVerified) {
      updates.emailVerified = new Date();
    }

    if (Object.keys(updates).length > 0) {
      user = (await storage.updateUser(user.id, updates)) ?? user;
    }

    return user;
  }

  app.post("/api/auth/register", async (req, res) => {
    try {
      const result = insertUserSchema.safeParse(req.body);
      if (!result.success) {
        return res.status(400).json({ error: fromZodError(result.error).message });
      }

      const { username, email, password } = result.data;
      const existingUser = await storage.getUserByUsername(username);
      if (existingUser) {
        return res.status(400).json({ error: "ユーザー名は既に使用されています" });
      }

      const existingEmail = await storage.getUserByEmail(email);
      if (existingEmail) {
        return res.status(400).json({ error: "このメールアドレスは既に使用されています" });
      }

      await cognitoSignUp({ username, password, email });
      await ensureLocalUser(username, email, false);

      res.json({
        username,
        email,
        emailVerified: false,
        message: "登録が完了しました。Cognitoからの確認メールをご確認ください。",
      });
    } catch (error) {
      console.error("Register error:", error);
      res.status(500).json({ error: "登録に失敗しました" });
    }
  });

  app.post("/api/auth/login", async (req, res) => {
    try {
      const result = loginSchema.safeParse(req.body);
      if (!result.success) {
        return res.status(400).json({ error: fromZodError(result.error).message });
      }

      const { username, password } = result.data;
      const authResult = await cognitoInitiateAuth({ username, password });
      const payload = await verifyCognitoIdToken(authResult.idToken);
      const email = typeof payload.email === "string" ? payload.email : undefined;
      const emailVerified = payload.email_verified === true;

      const user = await ensureLocalUser(username, email, emailVerified);

      await new Promise<void>((resolve, reject) => {
        req.session.regenerate((err) => {
          if (err) {
            reject(err);
          } else {
            resolve();
          }
        });
      });

      req.session.userId = user.id;
      req.session.csrfToken = randomBytes(32).toString('hex');
      req.session.cognitoAccessToken = authResult.accessToken;
      req.session.cognitoIdToken = authResult.idToken;
      req.session.cognitoRefreshToken = authResult.refreshToken;
      req.session.cognitoUsername = username;
      req.session.cognitoEmail = email;

      res.json({
        id: user.id,
        username: user.username,
        email: user.email,
        emailVerified,
      });
    } catch (error) {
      console.error("Login error:", error);
      res.status(500).json({ error: "ログインに失敗しました" });
    }
  });

  app.post("/api/auth/logout", (req, res) => {
    const accessToken = req.session.cognitoAccessToken;
    req.session.destroy(async (err) => {
      if (accessToken) {
        try {
          await cognitoGlobalSignOut(accessToken);
        } catch (signOutError) {
          console.warn("Cognito global sign-out failed", signOutError);
        }
      }

      if (err) {
        return res.status(500).json({ error: "ログアウトに失敗しました" });
      }
      res.json({ message: "ログアウトしました" });
    });
  });

  app.get("/api/auth/verify-email", async (req, res) => {
    try {
      if (!req.session.cognitoIdToken) {
        return res.status(401).json({ error: "ログインしていません" });
      }

      const payload = await verifyCognitoIdToken(req.session.cognitoIdToken);
      const username =
        (payload["cognito:username"] as string | undefined) ||
        (payload.username as string | undefined) ||
        req.session.cognitoUsername ||
        "";

      const emailVerified = payload.email_verified === true;
      if (emailVerified && req.session.userId) {
        await storage.updateUser(req.session.userId, { emailVerified: new Date() });
      }

      res.json({
        message: emailVerified ? "メールアドレスが確認されました" : "メールアドレスは未確認です",
        username,
        emailVerified,
      });
    } catch (error) {https://github.com/cer12u/TabConcentrator/pull/7/conflict?name=README.md&ancestor_oid=ec29a91666a61ab21e2cd7b255a79e7fc88670a4&base_oid=10cff75b01f16be55cf4e08d17ba0b4738681d8e&head_oid=c1f91745bdbca167e32f5e57676b47a1ae76ce85
      console.error("Email verification error:", error);
      res.status(500).json({ error: "メール確認に失敗しました" });
    }
  });

  app.post("/api/auth/request-password-reset", async (req, res) => {
    try {
      const { email, username } = req.body as { email?: string; username?: string };

      const targetUsername = username
        ? username
        : email
          ? (await storage.getUserByEmail(email))?.username
          : undefined;

      if (!targetUsername) {
        return res.status(400).json({ error: "ユーザー名またはメールアドレスを入力してください" });
      }

      await cognitoForgotPassword(targetUsername);

      res.json({ message: "リセットコードを送信しました（アカウントが存在する場合）" });
    } catch (error) {
      console.error("Password reset request error:", error);
      res.status(500).json({ error: "リセット要求に失敗しました" });
    }
  });

  app.post("/api/auth/reset-password", async (req, res) => {
    try {
      const { token, newPassword, username, email } = req.body as {
        token?: string;
        newPassword?: string;
        username?: string;
        email?: string;
      };

      if (!token || !newPassword) {
        return res.status(400).json({ error: "コードと新しいパスワードが必要です" });
      }

      if (newPassword.length < PASSWORD_MIN_LENGTH) {
        return res.status(400).json({ error: `パスワードは${PASSWORD_MIN_LENGTH}文字以上である必要があります` });
      }

      const targetUsername = username
        ? username
        : email
          ? (await storage.getUserByEmail(email))?.username
          : undefined;

      if (!targetUsername) {
        return res.status(400).json({ error: "ユーザー名を指定してください" });
      }

      await cognitoConfirmForgotPassword({ username: targetUsername, code: token, newPassword });

      res.json({ message: "パスワードがリセットされました" });
    } catch (error) {
      console.error("Password reset error:", error);
      res.status(500).json({ error: "パスワードのリセットに失敗しました" });
    }
  });

  app.get("/api/auth/me", async (req, res) => {
    if (!req.session.cognitoIdToken) {
      return res.status(401).json({ error: "ログインしていません" });
    }

    try {
      const payload = await verifyCognitoIdToken(req.session.cognitoIdToken);
      const username =
        (payload["cognito:username"] as string | undefined) ||
        (payload.username as string | undefined) ||
        req.session.cognitoUsername;
      const email = (payload.email as string | undefined) || req.session.cognitoEmail;
      const emailVerified = payload.email_verified === true;

      if (!username) {
        return res.status(401).json({ error: "ログインしていません" });
      }

      const user = await ensureLocalUser(username, email, emailVerified);
      req.session.userId = user.id;

      res.json({
        id: user.id,
        username: user.username,
        email: user.email,
        emailVerified,
      });
    } catch (error) {
      console.error("/api/auth/me error", error);
      return res.status(401).json({ error: "ログインしていません" });
    }
  });

  const requireAuth = (req: any, res: any, next: any) => {
    if (!req.session.cognitoIdToken) {
      return res.status(401).json({ error: "ログインしていません" });
    }

    verifyCognitoIdToken(req.session.cognitoIdToken)
      .then(async (payload) => {
        const username =
          (payload["cognito:username"] as string | undefined) ||
          (payload.username as string | undefined) ||
          req.session.cognitoUsername;
        const email = (payload.email as string | undefined) || req.session.cognitoEmail;
        const emailVerified = payload.email_verified === true;

        if (!username) {
          return res.status(401).json({ error: "ログインしていません" });
        }

        if (!req.session.userId) {
          const user = await ensureLocalUser(username, email, emailVerified);
          req.session.userId = user.id;
        } else if (emailVerified && req.session.userId) {
          await storage.updateUser(req.session.userId, { emailVerified: new Date() });
        }

        req.authUser = {
          username,
          email,
          emailVerified,
        };

        next();
        return null;
      })
      .catch((error) => {
        console.error("Cognito token verification failed", error);
        req.session.destroy(() => {});
        res.status(401).json({ error: "ログインしていません" });
      });
  };

  app.post("/api/exports/s3", requireAuth, async (req, res) => {
    if (!process.env.S3_EXPORT_BUCKET) {
      return res.status(500).json({ error: "S3_EXPORT_BUCKET is not configured" });
    }

    const requiredToken = process.env.EXPORT_ACCESS_TOKEN;
    const providedToken = req.headers["x-export-token"];
    if (requiredToken && providedToken !== requiredToken) {
      return res.status(401).json({ error: "export token is invalid" });
    }

    const userId = req.session.userId!;
    const prefix = process.env.S3_EXPORT_PREFIX || "exports";
    const key = `${prefix}/${userId}-${Date.now()}.json`;

    try {
      const result = await exportUserToS3(
        userId,
        process.env.S3_EXPORT_BUCKET,
        key,
      );
      res.json({
        message: "Exported data to S3",
        key: result.key,
        bucket: result.bucket,
      });
    } catch (error) {
      console.error("Export error:", error);
      res.status(502).json({ error: "Failed to export data to S3" });
    }
  });

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

      if (result.data.collectionId !== null && result.data.collectionId !== undefined) {
        const collection = await storage.getCollection(result.data.collectionId);
        if (!collection) {
          return res.status(404).json({ error: "指定されたコレクションが見つかりません" });
        }
        if (collection.userId !== userId) {
          return res.status(403).json({ error: "このコレクションにブックマークを追加する権限がありません" });
        }
      }

      let faviconData = result.data.favicon || null;
      
      if (faviconData && isHttpUrl(faviconData) && !isBase64Image(faviconData)) {
        const base64Image = await fetchImageAsBase64(faviconData);
        if (!base64Image) {
          return res.status(400).json({ 
            error: "画像のダウンロードに失敗しました。別の画像を選択してください。" 
          });
        }
        faviconData = base64Image;
      }

      const bookmark = await storage.createBookmark({
        ...result.data,
        favicon: faviconData,
      });
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

      let updateData = { ...result.data };
      
      if (updateData.favicon && isHttpUrl(updateData.favicon) && !isBase64Image(updateData.favicon)) {
        const base64Image = await fetchImageAsBase64(updateData.favicon);
        if (!base64Image) {
          return res.status(400).json({ 
            error: "画像のダウンロードに失敗しました。別の画像を選択してください。" 
          });
        }
        updateData.favicon = base64Image;
      }

      const bookmark = await storage.updateBookmark(id, updateData);
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

}
