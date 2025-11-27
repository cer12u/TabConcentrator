import crypto from "crypto";
import { createRemoteJWKSet, jwtVerify, type JWTPayload } from "jose";

type CognitoConfig = {
  userPoolId: string;
  clientId: string;
  region: string;
};

type CognitoAuthResult = {
  accessToken: string;
  idToken: string;
  refreshToken?: string;
};

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`${name} environment variable is required for Cognito integration`);
  }
  return value;
}

export function getCognitoConfig(): CognitoConfig {
  const userPoolId = requireEnv("COGNITO_USER_POOL_ID");
  const clientId = requireEnv("COGNITO_CLIENT_ID");
  const region = process.env.COGNITO_REGION || process.env.AWS_REGION || process.env.AWS_DEFAULT_REGION;

  if (!region) {
    throw new Error("COGNITO_REGION or AWS_REGION is required for Cognito integration");
  }

  return { userPoolId, clientId, region };
}

function getAwsCredentials() {
  const accessKeyId = process.env.AWS_ACCESS_KEY_ID;
  const secretAccessKey = process.env.AWS_SECRET_ACCESS_KEY;
  const sessionToken = process.env.AWS_SESSION_TOKEN;

  if (!accessKeyId || !secretAccessKey) {
    throw new Error("AWS_ACCESS_KEY_ID and AWS_SECRET_ACCESS_KEY are required for Cognito operations");
  }

  return { accessKeyId, secretAccessKey, sessionToken };
}

function hashSha256(data: string | Buffer): string {
  return crypto.createHash("sha256").update(data).digest("hex");
}

function hmac(key: Buffer | string, data: string) {
  return crypto.createHmac("sha256", key).update(data).digest();
}

function getSignatureKey(key: string, dateStamp: string, region: string, service: string): Buffer {
  const kDate = hmac(`AWS4${key}`, dateStamp);
  const kRegion = hmac(kDate, region);
  const kService = hmac(kRegion, service);
  return hmac(kService, "aws4_request");
}

async function callCognito<T>(action: string, body: Record<string, unknown>, config: CognitoConfig): Promise<T> {
  const { accessKeyId, secretAccessKey, sessionToken } = getAwsCredentials();
  const service = "cognito-idp";
  const host = `${service}.${config.region}.amazonaws.com`;
  const endpoint = `https://${host}/`;

  const payload = JSON.stringify(body);
  const now = new Date();
  const amzDate = now.toISOString().replace(/[:-]|\.\d{3}/g, "");
  const dateStamp = amzDate.slice(0, 8);

  const canonicalHeaderEntries: Array<[string, string]> = [
    ["content-type", "application/x-amz-json-1.1"],
    ["host", host],
    ["x-amz-date", amzDate],
    ["x-amz-target", `AWSCognitoIdentityProviderService.${action}`],
    ...(sessionToken ? [["x-amz-security-token", sessionToken]] : []),
  ];

  canonicalHeaderEntries.sort((a, b) => a[0].localeCompare(b[0]));

  const canonicalHeaders = canonicalHeaderEntries
    .map(([name, value]) => `${name}:${value}`)
    .join("\n");

  const signedHeaders = canonicalHeaderEntries.map(([name]) => name).join(";");

  const canonicalRequest = [
    "POST",
    "/",
    "",
    `${canonicalHeaders}\n`,
    signedHeaders,
    hashSha256(payload),
  ].join("\n");

  const credentialScope = `${dateStamp}/${config.region}/${service}/aws4_request`;
  const stringToSign = [
    "AWS4-HMAC-SHA256",
    amzDate,
    credentialScope,
    hashSha256(canonicalRequest),
  ].join("\n");

  const signingKey = getSignatureKey(secretAccessKey, dateStamp, config.region, service);
  const signature = crypto.createHmac("sha256", signingKey).update(stringToSign).digest("hex");

  const authorizationHeader = `AWS4-HMAC-SHA256 Credential=${accessKeyId}/${credentialScope}, SignedHeaders=${signedHeaders}, Signature=${signature}`;

  const response = await fetch(endpoint, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-amz-json-1.1",
      Host: host,
      "X-Amz-Date": amzDate,
      "X-Amz-Target": `AWSCognitoIdentityProviderService.${action}`,
      Authorization: authorizationHeader,
      ...(sessionToken ? { "X-Amz-Security-Token": sessionToken } : {}),
    },
    body: payload,
  });

  const text = await response.text();
  const parsed = text ? (JSON.parse(text) as Record<string, unknown>) : {};

  if (!response.ok) {
    const message = (parsed?.__type as string | undefined)?.split("#").pop() || (parsed?.message as string) || text;
    throw new Error(message || `Cognito request failed: ${response.statusText}`);
  }

  return parsed as T;
}

export async function cognitoSignUp({
  username,
  password,
  email,
}: {
  username: string;
  password: string;
  email: string;
}): Promise<{ userSub: string }> {
  const config = getCognitoConfig();

  const result = await callCognito<{ UserSub: string }>(
    "SignUp",
    {
      ClientId: config.clientId,
      Username: username,
      Password: password,
      UserAttributes: [
        { Name: "email", Value: email },
      ],
    },
    config,
  );

  return { userSub: result.UserSub };
}

export async function cognitoInitiateAuth({
  username,
  password,
}: {
  username: string;
  password: string;
}): Promise<CognitoAuthResult> {
  const config = getCognitoConfig();

  const result = await callCognito<{
    AuthenticationResult?: { AccessToken?: string; IdToken?: string; RefreshToken?: string };
  }>(
    "InitiateAuth",
    {
      AuthFlow: "USER_PASSWORD_AUTH",
      ClientId: config.clientId,
      AuthParameters: {
        USERNAME: username,
        PASSWORD: password,
      },
    },
    config,
  );

  const auth = result.AuthenticationResult;
  if (!auth?.AccessToken || !auth?.IdToken) {
    throw new Error("AuthenticationResult missing tokens");
  }

  return {
    accessToken: auth.AccessToken,
    idToken: auth.IdToken,
    refreshToken: auth.RefreshToken,
  };
}

export async function cognitoForgotPassword(username: string): Promise<void> {
  const config = getCognitoConfig();
  await callCognito("ForgotPassword", { ClientId: config.clientId, Username: username }, config);
}

export async function cognitoConfirmForgotPassword({
  username,
  code,
  newPassword,
}: {
  username: string;
  code: string;
  newPassword: string;
}): Promise<void> {
  const config = getCognitoConfig();
  await callCognito(
    "ConfirmForgotPassword",
    { ClientId: config.clientId, Username: username, ConfirmationCode: code, Password: newPassword },
    config,
  );
}

export async function cognitoGlobalSignOut(accessToken: string): Promise<void> {
  const config = getCognitoConfig();
  await callCognito("GlobalSignOut", { AccessToken: accessToken }, config);
}

let jwkSet: ReturnType<typeof createRemoteJWKSet> | null = null;

export async function verifyCognitoIdToken(token: string): Promise<JWTPayload> {
  const config = getCognitoConfig();
  if (!jwkSet) {
    jwkSet = createRemoteJWKSet(
      new URL(`https://cognito-idp.${config.region}.amazonaws.com/${config.userPoolId}/.well-known/jwks.json`),
    );
  }

  const result = await jwtVerify(token, jwkSet, {
    issuer: `https://cognito-idp.${config.region}.amazonaws.com/${config.userPoolId}`,
    audience: config.clientId,
  });

  return result.payload;
}
