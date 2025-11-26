declare module "@aws-sdk/client-s3" {
  export interface S3ClientConfig {
    region?: string;
    credentials?: unknown;
  }

  export class S3Client {
    constructor(config?: S3ClientConfig);
    send<T = any>(command: any): Promise<T>;
  }

  export class GetObjectCommand {
    constructor(input: Record<string, unknown>);
  }

  export class PutObjectCommand {
    constructor(input: Record<string, unknown>);
  }
}
