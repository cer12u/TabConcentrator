declare module "@aws-sdk/client-s3" {
  export class S3Client {
    constructor(config?: Record<string, unknown>);
    send<T>(command: T): Promise<unknown>;
  }

  export class PutObjectCommand {
    constructor(input: Record<string, unknown>);
    readonly input: Record<string, unknown>;
  }
}
