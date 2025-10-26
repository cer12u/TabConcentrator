import { test } from "node:test";
import assert from "node:assert/strict";
import {
  insertUserSchema,
  loginSchema,
  USERNAME_MIN_LENGTH,
  USERNAME_MAX_LENGTH,
  PASSWORD_MIN_LENGTH,
} from "../shared/schema";

test("registration schema rejects username shorter than minimum", () => {
  const result = insertUserSchema.safeParse({
    username: "a".repeat(USERNAME_MIN_LENGTH - 1),
    email: "user@example.com",
    password: "x".repeat(PASSWORD_MIN_LENGTH + 2),
  });

  assert.equal(result.success, false);
  assert.match(result.error?.errors[0]?.message ?? "", /ユーザー名は/);
});

test("registration schema rejects username longer than maximum", () => {
  const result = insertUserSchema.safeParse({
    username: "a".repeat(USERNAME_MAX_LENGTH + 1),
    email: "user@example.com",
    password: "x".repeat(PASSWORD_MIN_LENGTH + 2),
  });

  assert.equal(result.success, false);
  assert.match(result.error?.errors[0]?.message ?? "", /ユーザー名は.*以下/);
});

test("registration schema rejects empty email", () => {
  const result = insertUserSchema.safeParse({
    username: "validName",
    email: "",
    password: "x".repeat(PASSWORD_MIN_LENGTH + 2),
  });

  assert.equal(result.success, false);
});

test("registration schema rejects short password", () => {
  const result = insertUserSchema.safeParse({
    username: "validName",
    email: "user@example.com",
    password: "a".repeat(PASSWORD_MIN_LENGTH - 1),
  });

  assert.equal(result.success, false);
  assert.match(result.error?.errors[0]?.message ?? "", /パスワードは/);
});

test("registration schema accepts valid payload", () => {
  const result = insertUserSchema.safeParse({
    username: "validName",
    email: "user@example.com",
    password: "a".repeat(PASSWORD_MIN_LENGTH + 2),
  });

  assert.equal(result.success, true);
});

test("login schema accepts trimmed username and password", () => {
  const result = loginSchema.safeParse({
    username: "  user  ",
    password: "secret",
  });

  assert.equal(result.success, true);
});

test("login schema rejects missing username", () => {
  const result = loginSchema.safeParse({ username: "", password: "secret" });
  assert.equal(result.success, false);
});

test("login schema rejects missing password", () => {
  const result = loginSchema.safeParse({ username: "user", password: "" });
  assert.equal(result.success, false);
});
