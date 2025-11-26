import assert from "node:assert/strict";
import { afterEach, beforeEach, test } from "node:test";
import { AddressInfo } from "node:net";
import { buildApp } from "../server/app";
import { InMemoryStorage, setStorageProvider } from "../server/storage";
import { setS3Client, type PutObjectInput } from "../server/cloudStorage";

const defaultHeaders = { "content-type": "application/json" } as const;

function extractCookies(existing: string[], setCookieHeader: string[] | undefined): string[] {
  if (!setCookieHeader || setCookieHeader.length === 0) return existing;
  const updates = setCookieHeader.map((cookie) => cookie.split(";")[0]);
  const merged = [...existing];
  for (const cookie of updates) {
    const [name] = cookie.split("=");
    const index = merged.findIndex((item) => item.startsWith(`${name}=`));
    if (index >= 0) {
      merged[index] = cookie;
    } else {
      merged.push(cookie);
    }
  }
  return merged;
}

async function createAgent(baseUrl: string) {
  let cookies: string[] = [];

  async function request(path: string, init: RequestInit = {}) {
    const headers = new Headers(init.headers || {});
    headers.set("accept", "application/json");
    if (cookies.length > 0) {
      headers.set("cookie", cookies.join("; "));
    }

    const response = await fetch(`${baseUrl}${path}`, { ...init, headers });
    const setCookie = (response.headers as any).getSetCookie?.();
    if (setCookie) {
      cookies = extractCookies(cookies, setCookie);
    }
    return response;
  }

  async function json(path: string, init: RequestInit = {}) {
    const res = await request(path, init);
    const data = await res.json();
    return { res, data } as const;
  }

  return { request, json };
}

const runS3Tests = ["1", "true", "yes"].includes(String(process.env.RUN_S3_TESTS || "").toLowerCase());

if (!runS3Tests) {
  test.skip("S3 integration tests are disabled (set RUN_S3_TESTS=1 to enable)", () => {});
} else {
  type MockClientState = { calls: PutObjectInput[]; shouldFail?: boolean };

function createS3Mock(state: MockClientState) {
  return {
    putObject: async (input: PutObjectInput) => {
      state.calls.push(input);
      if (state.shouldFail) {
        throw new Error("mock failure");
      }
      return {};
    },
  };
}

beforeEach(() => {
  process.env.SESSION_SECRET = "test-secret";
  process.env.APP_BASE_URL = "http://localhost";
  process.env.SESSION_STORE_STRATEGY = "memory";
  process.env.S3_EXPORT_BUCKET = "export-bucket";
  delete process.env.EXPORT_ACCESS_TOKEN;
  setStorageProvider(new InMemoryStorage());
});

afterEach(() => {
  setS3Client(null);
});

test("exports to S3 when mock succeeds", async () => {
  const mockState: MockClientState = { calls: [] };
  setS3Client(createS3Mock(mockState));

  const app = await buildApp();
  const server = app.listen(0);
  const { port } = server.address() as AddressInfo;
  const agent = await createAgent(`http://127.0.0.1:${port}`);

  try {
    const csrfTokenRes = await agent.json("/api/csrf-token");
    const csrfToken = (csrfTokenRes.data as any).csrfToken as string;

    const registerResponse = await agent.json("/api/auth/register", {
      method: "POST",
      headers: { ...defaultHeaders, "x-csrf-token": csrfToken },
      body: JSON.stringify({ username: "tester", email: "tester@example.com", password: "password123" }),
    });

    assert.equal(registerResponse.res.status, 200);
    const userId = (registerResponse.data as any).id as string;

    const csrfAfterRegister = await agent.json("/api/csrf-token");
    const nextToken = (csrfAfterRegister.data as any).csrfToken as string;

    const collectionResponse = await agent.json("/api/collections", {
      method: "POST",
      headers: { ...defaultHeaders, "x-csrf-token": nextToken },
      body: JSON.stringify({ name: "Work" }),
    });
    assert.equal(collectionResponse.res.status, 200);
    const collectionId = (collectionResponse.data as any).id as string;

    const bookmarkResponse = await agent.json("/api/bookmarks", {
      method: "POST",
      headers: { ...defaultHeaders, "x-csrf-token": nextToken },
      body: JSON.stringify({
        url: "https://example.com",
        title: "Example",
        domain: "example.com",
        collectionId,
      }),
    });
    assert.equal(bookmarkResponse.res.status, 200);

    const exportResponse = await agent.json("/api/exports/s3", {
      method: "POST",
      headers: { ...defaultHeaders, "x-csrf-token": nextToken },
      body: JSON.stringify({}),
    });

    assert.equal(exportResponse.res.status, 200);
    assert.equal(mockState.calls.length, 1);
    const uploaded = mockState.calls[0];
    assert.equal(uploaded.Bucket, "export-bucket");
    assert(uploaded.Key.includes(userId));
    const body = JSON.parse(uploaded.Body);
    assert.equal(body.user.id, userId);
    assert.equal(body.collections.length, 1);
    assert.equal(body.bookmarks.length, 1);
  } finally {
    server.close();
  }
});

test("returns error when S3 upload fails", async () => {
  const mockState: MockClientState = { calls: [], shouldFail: true };
  setS3Client(createS3Mock(mockState));

  const app = await buildApp();
  const server = app.listen(0);
  const { port } = server.address() as AddressInfo;
  const agent = await createAgent(`http://127.0.0.1:${port}`);

  try {
    const csrfTokenRes = await agent.json("/api/csrf-token");
    const csrfToken = (csrfTokenRes.data as any).csrfToken as string;

    await agent.json("/api/auth/register", {
      method: "POST",
      headers: { ...defaultHeaders, "x-csrf-token": csrfToken },
      body: JSON.stringify({ username: "failing", email: "fail@example.com", password: "password123" }),
    });

    const csrfAfterRegister = await agent.json("/api/csrf-token");
    const nextToken = (csrfAfterRegister.data as any).csrfToken as string;

    const exportResponse = await agent.json("/api/exports/s3", {
      method: "POST",
      headers: { ...defaultHeaders, "x-csrf-token": nextToken },
      body: JSON.stringify({}),
    });

    assert.equal(exportResponse.res.status, 502);
    assert.equal(mockState.calls.length, 1);
  } finally {
    server.close();
  }
});
}
