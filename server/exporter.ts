import { uploadJsonToS3 } from "./cloudStorage";
import { getStorage } from "./storage";

interface UserExportPayload {
  exportedAt: string;
  user: {
    id: string;
    username: string;
    email: string;
    emailVerified: Date | null;
  };
  collections: Awaited<ReturnType<ReturnType<typeof getStorage>["getCollectionsByUserId"]>>;
  bookmarks: Awaited<ReturnType<ReturnType<typeof getStorage>["getBookmarksByUserId"]>>;
}

export async function buildUserExport(userId: string): Promise<UserExportPayload> {
  const storage = getStorage();
  const user = await storage.getUser(userId);
  if (!user) {
    throw new Error("User not found");
  }

  const [collections, bookmarks] = await Promise.all([
    storage.getCollectionsByUserId(userId),
    storage.getBookmarksByUserId(userId),
  ]);

  return {
    exportedAt: new Date().toISOString(),
    user: {
      id: user.id,
      username: user.username,
      email: user.email,
      emailVerified: user.emailVerified ?? null,
    },
    collections,
    bookmarks,
  };
}

export async function exportUserToS3(
  userId: string,
  bucket: string,
  key: string,
): Promise<{ bucket: string; key: string }> {
  const payload = await buildUserExport(userId);
  return uploadJsonToS3(bucket, key, payload);
}
