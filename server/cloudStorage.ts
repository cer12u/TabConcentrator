export interface PutObjectInput {
  Bucket: string;
  Key: string;
  Body: string;
  ContentType?: string;
}

export interface S3LikeClient {
  send?: (command: { input: PutObjectInput }) => Promise<unknown>;
  putObject?: (input: PutObjectInput) => Promise<unknown>;
}

let clientOverride: S3LikeClient | null = null;

export function setS3Client(client: S3LikeClient | null): void {
  clientOverride = client;
}

async function createDefaultClient(): Promise<S3LikeClient> {
  try {
    const { S3Client, PutObjectCommand } = await import("@aws-sdk/client-s3");
    const region = process.env.AWS_REGION || "us-east-1";
    const sdkClient = new S3Client({ region });
    return {
      send: (command) => sdkClient.send(command as any),
      putObject: (input) => sdkClient.send(new PutObjectCommand(input as any) as any),
    };
  } catch (error) {
    throw new Error(
      "@aws-sdk/client-s3 is required to upload to S3. Install it in environments where S3 exports run.",
    );
  }
}

export async function uploadJsonToS3(
  bucket: string,
  key: string,
  payload: unknown,
): Promise<{ bucket: string; key: string }> {
  const client = clientOverride ?? (await createDefaultClient());
  const body = JSON.stringify(payload, null, 2);

  if (client.putObject) {
    await client.putObject({ Bucket: bucket, Key: key, Body: body, ContentType: "application/json" });
  } else if (client.send) {
    await client.send({ input: { Bucket: bucket, Key: key, Body: body, ContentType: "application/json" } });
  } else {
    throw new Error("S3 client does not support putObject/send");
  }

  return { bucket, key };
}
