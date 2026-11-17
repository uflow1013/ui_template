import "server-only";
import { createHash, createHmac, timingSafeEqual } from "node:crypto";

export const sessionMaxAge = 12 * 60 * 60;

export function validPasswordLength(password: string) {
  const length = [...password].length;
  return length >= 2 && length <= 32;
}

export function getCredentials() {
  const password = process.env.CHENGXU_PASSWORD;
  const secret = process.env.CHENGXU_SESSION_SECRET;
  if (!password || !validPasswordLength(password) || !secret || !/^[A-Za-z0-9_-]{43,128}$/.test(secret)) {
    return null;
  }
  return {
    password,
    signingKey: createHmac("sha256", Buffer.from(secret, "base64url"))
      .update("chengxu session key\0")
      .update(password, "utf16le")
      .digest(),
  };
}

export function matchesPassword(candidate: string, expected: string) {
  const digest = (value: string) => createHash("sha256").update(value, "utf16le").digest();
  return timingSafeEqual(digest(candidate), digest(expected));
}

function sessionSignature(expiration: string, key: Buffer) {
  return createHmac("sha256", key).update(`chengxu:v1:${expiration}`).digest();
}

export function createSession(signingKey: Buffer) {
  const expiration = String(Math.floor(Date.now() / 1000) + sessionMaxAge);
  return `${expiration}.${sessionSignature(expiration, signingKey).toString("base64url")}`;
}

export function hasSession(cookie: string | undefined) {
  if (!cookie || !/^\d{10,13}\.[A-Za-z0-9_-]{43}$/.test(cookie)) return false;
  const [expiration, signature] = cookie.split(".");
  const expiresIn = Number(expiration) - Math.floor(Date.now() / 1000);
  if (expiresIn <= 0 || expiresIn > sessionMaxAge) return false;
  const credentials = getCredentials();
  if (!credentials) return false;
  const expected = sessionSignature(expiration, credentials.signingKey);
  return timingSafeEqual(Buffer.from(signature, "base64url"), expected);
}

export function requestHost(headers: Pick<Headers, "get">) {
  return headers.get("x-forwarded-host")?.split(",", 1)[0].trim().toLowerCase()
    || headers.get("host")?.toLowerCase()
    || "";
}

export function sessionCookieOptions(headers: Pick<Headers, "get">) {
  const localhost = /^(?:localhost|127\.0\.0\.1|\[::1\])(?::\d+)?$/i.test(requestHost(headers));
  const https = headers.get("x-forwarded-proto")?.split(",", 1)[0].trim() === "https";
  return {
    httpOnly: true,
    sameSite: "lax" as const,
    path: process.env.NEXT_PUBLIC_BASE_PATH?.replace(/\/$/, "") || "/",
    secure: process.env.NODE_ENV === "production" && (https || !localhost),
  };
}
