class S3Client {
  constructor() {}

  async send() {
    throw new Error("@aws-sdk/client-s3 is stubbed; install the real package for production use.");
  }
}

class GetObjectCommand {
  constructor(input) {
    this.input = input;
  }
}

class PutObjectCommand {
  constructor(input) {
    this.input = input;
  }
}

export { GetObjectCommand, PutObjectCommand, S3Client };
