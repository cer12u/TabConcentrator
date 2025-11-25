import { exportUserToS3 } from "../server/exporter.js";
import { DbStorage, setStorageProvider } from "../server/storage.js";
import { pool } from "../server/db.js";

async function run() {
  const bucket = process.env.S3_EXPORT_BUCKET;
  if (!bucket) {
    throw new Error("S3_EXPORT_BUCKET must be set to export data");
  }

  const prefix = process.env.S3_EXPORT_PREFIX || "exports";
  const storage = new DbStorage();
  setStorageProvider(storage);

  const users = await storage.listUsers();
  if (users.length === 0) {
    console.warn("No users found to export");
  }

  for (const user of users) {
    const key = `${prefix}/${user.id}-migration.json`;
    await exportUserToS3(user.id, bucket, key);
    console.log(`Exported ${user.username} (${user.id}) to s3://${bucket}/${key}`);
  }
}

run()
  .catch((err) => {
    console.error("Migration export failed", err);
    process.exitCode = 1;
  })
  .finally(async () => {
    try {
      await pool.end();
    } catch {
      // ignore
    }
  });
