import { sql } from "drizzle-orm";
import { pgTable, text, varchar, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";
import {
  USERNAME_MIN_LENGTH,
  USERNAME_MAX_LENGTH,
  PASSWORD_MIN_LENGTH,
} from "./constants";

export { USERNAME_MIN_LENGTH, USERNAME_MAX_LENGTH, PASSWORD_MIN_LENGTH } from "./constants";

export const users = pgTable("users", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  username: text("username").notNull().unique(),
  email: text("email").notNull().unique(),
  password: text("password").notNull(),
  emailVerified: timestamp("email_verified"),
  verificationToken: varchar("verification_token"),
  resetToken: varchar("reset_token"),
  resetTokenExpiry: timestamp("reset_token_expiry"),
});

export const insertUserSchema = createInsertSchema(users).pick({
  username: true,
  email: true,
  password: true,
}).extend({
  username: z
    .string({ required_error: "ユーザー名を入力してください" })
    .trim()
    .min(USERNAME_MIN_LENGTH, `ユーザー名は${USERNAME_MIN_LENGTH}文字以上で入力してください`)
    .max(USERNAME_MAX_LENGTH, `ユーザー名は${USERNAME_MAX_LENGTH}文字以下で入力してください`),
  email: z.string().email("有効なメールアドレスを入力してください"),
  password: z
    .string({ required_error: "パスワードを入力してください" })
    .min(PASSWORD_MIN_LENGTH, `パスワードは${PASSWORD_MIN_LENGTH}文字以上で入力してください`),
});

export const loginSchema = z.object({
  username: z
    .string({ required_error: "ユーザー名を入力してください" })
    .trim()
    .min(1, "ユーザー名を入力してください")
    .max(USERNAME_MAX_LENGTH, `ユーザー名は${USERNAME_MAX_LENGTH}文字以下で入力してください`),
  password: z
    .string({ required_error: "パスワードを入力してください" })
    .min(1, "パスワードを入力してください"),
});

export type InsertUser = z.infer<typeof insertUserSchema>;
export type User = typeof users.$inferSelect;

export const collections = pgTable("collections", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertCollectionSchema = createInsertSchema(collections).omit({
  id: true,
  createdAt: true,
});

export type InsertCollection = z.infer<typeof insertCollectionSchema>;
export type Collection = typeof collections.$inferSelect;

export const bookmarks = pgTable("bookmarks", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  collectionId: varchar("collection_id").references(() => collections.id, { onDelete: "cascade" }),
  url: text("url").notNull(),
  title: text("title").notNull(),
  domain: text("domain").notNull(),
  favicon: text("favicon"),
  memo: text("memo"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertBookmarkSchema = createInsertSchema(bookmarks).omit({
  id: true,
  createdAt: true,
});

export type InsertBookmark = z.infer<typeof insertBookmarkSchema>;
export type Bookmark = typeof bookmarks.$inferSelect;
